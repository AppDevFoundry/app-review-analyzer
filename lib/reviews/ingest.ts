/**
 * Review Ingestion Service
 *
 * Orchestrates the fetching, deduplication, and storage of app reviews.
 * Also triggers snapshot creation for subsequent AI analysis.
 */

import { AppStatus, IngestionStatus, Prisma, ReviewSource } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  INGESTION_ERROR_CODES,
  IngestionErrorCode,
  getIngestionErrorMessage,
} from "@/config/ingestion"
import { AppleReviewsClient, NormalizedReview, createAppleReviewsClient } from "@/lib/apple/reviews"
import { ingestionLogger, logger } from "@/lib/logger"
import { canCallAppleApi } from "@/lib/rate-limiter"
import { canRunIngestion, getReviewsPerRunLimit } from "./quota"
import { queueReviewSnapshot } from "./snapshot-trigger"

// ============================================================================
// Types
// ============================================================================

export interface IngestionOptions {
  /** The app to ingest reviews for */
  appId: string
  /** The workspace the app belongs to */
  workspaceId: string
  /** User who triggered the ingestion (null for scheduled) */
  triggeredById?: string
  /** Reason for ingestion */
  reason: "manual" | "scheduled"
  /** Override the review limit (mainly for testing) */
  reviewLimit?: number
  /** Which sources to fetch from */
  sources?: ("mostRecent" | "mostHelpful")[]
  /** Abort signal for cancellation */
  signal?: AbortSignal
}

export interface IngestionResult {
  /** Whether ingestion succeeded */
  success: boolean
  /** The ingestion run ID */
  runId: string
  /** Final status of the run */
  status: IngestionStatus
  /** Number of reviews fetched from Apple */
  reviewsFetched: number
  /** Number of new reviews stored */
  reviewsNew: number
  /** Number of duplicate reviews skipped */
  reviewsDuplicate: number
  /** Number of pages processed */
  pagesProcessed: number
  /** Sources processed */
  sourcesProcessed: string[]
  /** Duration in milliseconds */
  durationMs: number
  /** Created snapshot ID (if any) */
  snapshotId?: string
  /** Error information (if failed) */
  error?: {
    code: IngestionErrorCode
    message: string
  }
}

// ============================================================================
// Error Class
// ============================================================================

export class IngestionError extends Error {
  code: IngestionErrorCode

  constructor(code: IngestionErrorCode, message?: string) {
    super(message || getIngestionErrorMessage(code))
    this.name = "IngestionError"
    this.code = code
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new ingestion run record
 */
async function createIngestionRun(
  workspaceId: string,
  appId: string,
  reason: string,
  triggeredById?: string
) {
  return prisma.reviewIngestionRun.create({
    data: {
      workspaceId,
      appId,
      reason,
      triggeredById,
      status: IngestionStatus.PENDING,
    },
  })
}

/**
 * Update ingestion run status
 */
async function updateIngestionRun(
  runId: string,
  data: Partial<{
    status: IngestionStatus
    completedAt: Date
    durationMs: number
    reviewsFetched: number
    reviewsNew: number
    reviewsDuplicate: number
    pagesProcessed: number
    sourcesProcessed: string[]
    errorCode: string
    errorMessage: string
    snapshotId: string
  }>
) {
  return prisma.reviewIngestionRun.update({
    where: { id: runId },
    data,
  })
}

/**
 * Convert normalized reviews to Prisma create input
 */
function reviewsToPrismaInput(
  reviews: NormalizedReview[],
  workspaceId: string,
  appId: string
): Prisma.ReviewCreateManyInput[] {
  return reviews.map((review) => ({
    workspaceId,
    appId,
    externalReviewId: review.externalId,
    rating: review.rating,
    title: review.title || null,
    content: review.content,
    author: review.author || null,
    version: review.version,
    publishedAt: review.publishedAt,
    voteSum: review.voteSum,
    voteCount: review.voteCount,
    source: review.source,
    metadata: JSON.parse(JSON.stringify(review.raw)) as Prisma.JsonObject,
  }))
}

/**
 * Batch insert reviews with duplicate handling
 */
async function insertReviews(
  reviews: Prisma.ReviewCreateManyInput[]
): Promise<{ inserted: number; duplicates: number }> {
  if (reviews.length === 0) {
    return { inserted: 0, duplicates: 0 }
  }

  // Use createMany with skipDuplicates
  const result = await prisma.review.createMany({
    data: reviews,
    skipDuplicates: true,
  })

  const inserted = result.count
  const duplicates = reviews.length - inserted

  return { inserted, duplicates }
}

// ============================================================================
// Main Ingestion Function
// ============================================================================

/**
 * Ingest reviews for an app
 *
 * This is the main entry point for the ingestion service.
 * It handles:
 * 1. Validation (app exists, is active, quotas)
 * 2. Fetching reviews from Apple
 * 3. Deduplication and storage
 * 4. Triggering snapshot creation
 * 5. Updating run status and metrics
 */
export async function ingestReviews(options: IngestionOptions): Promise<IngestionResult> {
  const startTime = Date.now()
  let runId = ""

  try {
    // 1. Validate the app exists and is active
    const app = await prisma.app.findUnique({
      where: { id: options.appId },
      include: {
        workspace: {
          select: { plan: true },
        },
      },
    })

    if (!app) {
      throw new IngestionError(INGESTION_ERROR_CODES.APP_NOT_FOUND)
    }

    if (app.workspaceId !== options.workspaceId) {
      throw new IngestionError(INGESTION_ERROR_CODES.PERMISSION_DENIED)
    }

    if (app.status === AppStatus.PAUSED) {
      throw new IngestionError(INGESTION_ERROR_CODES.APP_PAUSED)
    }

    if (app.status === AppStatus.ARCHIVED || app.deletedAt) {
      throw new IngestionError(INGESTION_ERROR_CODES.APP_ARCHIVED)
    }

    // 2. Check quotas
    const quotaStatus = await canRunIngestion(options.workspaceId, options.reason)
    if (!quotaStatus.allowed) {
      throw new IngestionError(
        quotaStatus.code as IngestionErrorCode || INGESTION_ERROR_CODES.DAILY_LIMIT_EXCEEDED,
        quotaStatus.reason
      )
    }

    // 3. Check rate limits
    if (!canCallAppleApi(options.workspaceId)) {
      ingestionLogger.rateLimited(options.workspaceId, "apple")
      throw new IngestionError(INGESTION_ERROR_CODES.RATE_LIMIT_EXCEEDED)
    }

    // 4. Create ingestion run record
    const run = await createIngestionRun(
      options.workspaceId,
      options.appId,
      options.reason,
      options.triggeredById
    )
    runId = run.id

    // 5. Update status to IN_PROGRESS
    await updateIngestionRun(runId, { status: IngestionStatus.IN_PROGRESS })
    ingestionLogger.started(runId, options.appId, options.workspaceId, options.reason)

    // 6. Get review limit for this workspace
    const reviewLimit = options.reviewLimit || await getReviewsPerRunLimit(options.workspaceId)

    // 7. Fetch reviews from Apple
    const client = createAppleReviewsClient({
      country: app.country || "us",
    })

    const fetchResult = await client.fetchAll(app.appStoreId, {
      maxReviews: reviewLimit,
      runId,
      signal: options.signal,
    })

    // 8. Check for cancellation
    if (options.signal?.aborted) {
      await updateIngestionRun(runId, {
        status: IngestionStatus.CANCELLED,
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        errorCode: INGESTION_ERROR_CODES.INGESTION_CANCELLED,
        errorMessage: "Ingestion was cancelled",
      })

      return {
        success: false,
        runId,
        status: IngestionStatus.CANCELLED,
        reviewsFetched: fetchResult.reviews.length,
        reviewsNew: 0,
        reviewsDuplicate: 0,
        pagesProcessed: fetchResult.totalPagesProcessed,
        sourcesProcessed: fetchResult.sourcesProcessed.map(String),
        durationMs: Date.now() - startTime,
        error: {
          code: INGESTION_ERROR_CODES.INGESTION_CANCELLED,
          message: "Ingestion was cancelled",
        },
      }
    }

    // 9. Convert and insert reviews
    const reviewInputs = reviewsToPrismaInput(
      fetchResult.reviews,
      options.workspaceId,
      options.appId
    )

    const { inserted, duplicates } = await insertReviews(reviewInputs)

    // 10. Update app last synced time
    await prisma.app.update({
      where: { id: options.appId },
      data: { lastSyncedAt: new Date() },
    })

    // 11. Queue snapshot for analysis (if we got new reviews)
    let snapshotId: string | undefined
    if (inserted > 0) {
      // Get date range of fetched reviews
      const dates = fetchResult.reviews.map((r) => r.publishedAt)
      const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
      const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

      const snapshotResult = await queueReviewSnapshot({
        ingestionRunId: runId,
        appId: options.appId,
        workspaceId: options.workspaceId,
        reviewCount: inserted,
        analysisRangeStart: minDate,
        analysisRangeEnd: maxDate,
      })

      if (snapshotResult.success) {
        snapshotId = snapshotResult.snapshotId
      }
    }

    // 12. Update run with final results
    const durationMs = Date.now() - startTime
    const sourcesProcessed = fetchResult.sourcesProcessed.map((s) =>
      s === ReviewSource.MOST_RECENT ? "mostRecent" : "mostHelpful"
    )

    await updateIngestionRun(runId, {
      status: IngestionStatus.COMPLETED,
      completedAt: new Date(),
      durationMs,
      reviewsFetched: fetchResult.reviews.length,
      reviewsNew: inserted,
      reviewsDuplicate: duplicates,
      pagesProcessed: fetchResult.totalPagesProcessed,
      sourcesProcessed,
      snapshotId,
    })

    // 13. Log completion
    ingestionLogger.completed(runId, options.appId, options.workspaceId, {
      reviewsFetched: fetchResult.reviews.length,
      reviewsNew: inserted,
      reviewsDuplicate: duplicates,
      pagesProcessed: fetchResult.totalPagesProcessed,
      durationMs,
    })

    return {
      success: true,
      runId,
      status: IngestionStatus.COMPLETED,
      reviewsFetched: fetchResult.reviews.length,
      reviewsNew: inserted,
      reviewsDuplicate: duplicates,
      pagesProcessed: fetchResult.totalPagesProcessed,
      sourcesProcessed,
      durationMs,
      snapshotId,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    let errorCode: IngestionErrorCode = INGESTION_ERROR_CODES.INTERNAL_ERROR
    let errorMessage = "An unexpected error occurred"

    if (error instanceof IngestionError) {
      errorCode = error.code
      errorMessage = error.message
    } else if (error instanceof Error) {
      errorMessage = error.message

      // Map known error types
      if (error.name === "AbortError") {
        errorCode = INGESTION_ERROR_CODES.INGESTION_CANCELLED
        errorMessage = "Ingestion was cancelled"
      } else if (error.message.includes("timeout")) {
        errorCode = INGESTION_ERROR_CODES.APPLE_TIMEOUT
      }
    }

    // Update run record if it was created
    if (runId) {
      await updateIngestionRun(runId, {
        status: IngestionStatus.FAILED,
        completedAt: new Date(),
        durationMs,
        errorCode,
        errorMessage,
      })

      ingestionLogger.failed(runId, options.appId, options.workspaceId, error, errorCode)
    } else {
      // Log error without run ID
      logger.error("ingestion_failed_early", error, {
        appId: options.appId,
        workspaceId: options.workspaceId,
        errorCode,
      })
    }

    return {
      success: false,
      runId,
      status: IngestionStatus.FAILED,
      reviewsFetched: 0,
      reviewsNew: 0,
      reviewsDuplicate: 0,
      pagesProcessed: 0,
      sourcesProcessed: [],
      durationMs,
      error: {
        code: errorCode,
        message: errorMessage,
      },
    }
  }
}

/**
 * Cancel an in-progress ingestion run
 */
export async function cancelIngestion(runId: string): Promise<boolean> {
  const run = await prisma.reviewIngestionRun.findUnique({
    where: { id: runId },
  })

  if (!run) {
    return false
  }

  if (run.status !== IngestionStatus.IN_PROGRESS && run.status !== IngestionStatus.PENDING) {
    return false
  }

  await prisma.reviewIngestionRun.update({
    where: { id: runId },
    data: {
      status: IngestionStatus.CANCELLED,
      completedAt: new Date(),
      errorCode: INGESTION_ERROR_CODES.INGESTION_CANCELLED,
      errorMessage: "Ingestion was manually cancelled",
    },
  })

  return true
}

/**
 * Get an ingestion run by ID
 */
export async function getIngestionRun(runId: string) {
  return prisma.reviewIngestionRun.findUnique({
    where: { id: runId },
    include: {
      app: {
        select: {
          id: true,
          name: true,
          appStoreId: true,
        },
      },
      triggeredBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      snapshot: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  })
}
