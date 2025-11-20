/**
 * Review Ingestion Service
 *
 * Main orchestrator for fetching and storing app reviews.
 * Handles eligibility checks, rate limiting, plan enforcement,
 * deduplication, and triggers snapshot generation.
 */

import type {
  App,
  IngestionReason,
  IngestionStatus,
  ReviewSource,
} from "@prisma/client"

import {
  INGESTION_ERROR_CODES,
  type IngestionErrorCode,
} from "@/config/ingestion"
import {
  assertWithinPlanLimit,
  getWorkspaceWithPlan,
  type WorkspaceWithPlan,
} from "@/lib/workspaces"
import { canCallAppleReviewsApi } from "@/lib/rate-limiter"
import {
  fetchReviewsFromRSS,
  type FetchReviewsResult,
  type NormalizedReview,
} from "@/lib/apple/reviews"
import { prisma } from "@/lib/db"
import { queueReviewSnapshot } from "./snapshot-trigger"

/**
 * Ingestion options
 */
export interface IngestionOptions {
  appId: string
  limit?: number // Override plan default
  sources?: ("mostRecent" | "mostHelpful")[]
  triggeredByUserId?: string
  reason: IngestionReason
  skipPlanCheck?: boolean // Internal testing only
}

/**
 * Ingestion result
 */
export interface IngestionResult {
  success: boolean
  runId: string
  snapshotId?: string
  reviewsFetched: number
  reviewsInserted: number
  duplicateCount: number
  durationMs: number
  error?: {
    message: string
    code: IngestionErrorCode
  }
}

/**
 * Main ingestion function
 *
 * Orchestrates the entire review ingestion process:
 * 1. Eligibility checks
 * 2. Create ingestion run record
 * 3. Fetch reviews from Apple
 * 4. Deduplicate and insert
 * 5. Update app metadata
 * 6. Trigger snapshot generation
 * 7. Record metrics
 */
export async function ingestReviews(
  options: IngestionOptions
): Promise<IngestionResult> {
  const startTime = Date.now()
  let run: { id: string; workspaceId: string; appId: string } | null = null

  try {
    // Step 1: Get app and workspace info
    const app = await prisma.app.findUnique({
      where: { id: options.appId },
      include: {
        workspace: true,
      },
    })

    if (!app) {
      throw new IngestionError(
        `App not found: ${options.appId}`,
        INGESTION_ERROR_CODES.APP_NOT_FOUND
      )
    }

    // Step 2: Check eligibility
    await checkEligibility(app, options)

    // Step 3: Get workspace with plan info
    const workspaceWithPlan = await getWorkspaceWithPlan(app.workspaceId)
    if (!workspaceWithPlan) {
      throw new IngestionError(
        "Workspace not found",
        INGESTION_ERROR_CODES.UNKNOWN
      )
    }

    // Step 4: Create ingestion run record
    run = await prisma.reviewIngestionRun.create({
      data: {
        workspaceId: app.workspaceId,
        appId: app.id,
        reason: options.reason,
        triggeredByUserId: options.triggeredByUserId || null,
        status: "PENDING",
        requestedAt: new Date(),
      },
      select: {
        id: true,
        workspaceId: true,
        appId: true,
      },
    })

    // Step 5: Update status to PROCESSING
    await prisma.reviewIngestionRun.update({
      where: { id: run.id },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
      },
    })

    // Step 6: Determine review limit
    const reviewLimit =
      options.limit ||
      workspaceWithPlan.workspace.reviewLimitPerRun ||
      100

    // Step 7: Fetch reviews from Apple
    const fetchResult = await fetchReviewsFromRSS({
      appStoreId: app.appStoreId,
      country: app.country || undefined,
      sources: options.sources,
      limit: reviewLimit,
      workspaceId: app.workspaceId,
    })

    // Step 8: Insert reviews into database
    const insertResult = await insertReviews(
      app.id,
      app.workspaceId,
      fetchResult.reviews
    )

    // Step 9: Update app metadata
    await prisma.app.update({
      where: { id: app.id },
      data: {
        lastSyncedAt: new Date(),
        consecutiveFailures: 0,
        lastFailureReason: null,
        nextRetryAt: null,
      },
    })

    // Step 10: Update run record with final metrics
    const finishedAt = new Date()
    const durationMs = finishedAt.getTime() - startTime

    await prisma.reviewIngestionRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        finishedAt,
        durationMs,
        reviewsFetched: fetchResult.totalFetched,
        reviewsInserted: insertResult.inserted,
        duplicateCount: insertResult.duplicates,
        reviewsSkipped: insertResult.skipped,
        sourcesProcessed: fetchResult.sourcesProcessed,
        metadata: {
          errors: fetchResult.errors,
        },
      },
    })

    // Step 11: Trigger snapshot generation
    let snapshotId: string | undefined
    try {
      snapshotId = await queueReviewSnapshot(app.id, run.id)

      // Link snapshot to run
      await prisma.reviewIngestionRun.update({
        where: { id: run.id },
        data: { snapshotId },
      })
    } catch (error) {
      console.error("[Ingestion] Failed to queue snapshot:", error)
      // Don't fail the ingestion if snapshot creation fails
    }

    // Step 12: Record success metrics (if metrics module exists)
    await recordMetrics({
      workspaceId: app.workspaceId,
      success: true,
      durationMs,
      reviewsInserted: insertResult.inserted,
    })

    return {
      success: true,
      runId: run.id,
      snapshotId,
      reviewsFetched: fetchResult.totalFetched,
      reviewsInserted: insertResult.inserted,
      duplicateCount: insertResult.duplicates,
      durationMs,
    }
  } catch (error) {
    const errorInfo = categorizeIngestionError(error)
    const finishedAt = new Date()
    const durationMs = finishedAt.getTime() - startTime

    // Update run record if it was created
    if (run) {
      await prisma.reviewIngestionRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          finishedAt,
          durationMs,
          errorMessage: errorInfo.message,
          errorCode: errorInfo.code,
        },
      })

      // Update app failure tracking
      const app = await prisma.app.findUnique({
        where: { id: run.appId },
        select: { consecutiveFailures: true },
      })

      if (app) {
        const newFailureCount = app.consecutiveFailures + 1
        const retryDelay = calculateRetryDelay(newFailureCount)

        await prisma.app.update({
          where: { id: run.appId },
          data: {
            consecutiveFailures: newFailureCount,
            lastFailureReason: errorInfo.message,
            nextRetryAt: retryDelay
              ? new Date(Date.now() + retryDelay)
              : null,
          },
        })
      }

      // Record failure metrics
      await recordMetrics({
        workspaceId: run.workspaceId,
        success: false,
        durationMs,
        reviewsInserted: 0,
        errorCode: errorInfo.code,
      })
    }

    return {
      success: false,
      runId: run?.id || "",
      reviewsFetched: 0,
      reviewsInserted: 0,
      duplicateCount: 0,
      durationMs,
      error: errorInfo,
    }
  }
}

/**
 * Check if ingestion is allowed for this app
 */
async function checkEligibility(
  app: App & { workspace: { deletedAt: Date | null } },
  options: IngestionOptions
): Promise<void> {
  // Check app status
  if (app.status === "PAUSED") {
    throw new IngestionError(
      "App is paused. Cannot fetch reviews for paused apps.",
      INGESTION_ERROR_CODES.APP_NOT_FOUND
    )
  }

  if (app.status === "ARCHIVED") {
    throw new IngestionError(
      "App is archived. Cannot fetch reviews for archived apps.",
      INGESTION_ERROR_CODES.APP_NOT_FOUND
    )
  }

  // Check workspace deletion
  if (app.workspace.deletedAt) {
    throw new IngestionError(
      "Workspace is deleted.",
      INGESTION_ERROR_CODES.UNKNOWN
    )
  }

  // Check if app is in retry backoff
  if (app.nextRetryAt && app.nextRetryAt > new Date()) {
    const minutesUntilRetry = Math.ceil(
      (app.nextRetryAt.getTime() - Date.now()) / 60000
    )
    throw new IngestionError(
      `App is in retry backoff. Next retry in ${minutesUntilRetry} minutes.`,
      INGESTION_ERROR_CODES.RATE_LIMIT_EXCEEDED
    )
  }

  // Check plan limits (unless explicitly skipped)
  if (!options.skipPlanCheck) {
    // Check if within monthly analysis limit
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const analysesThisMonth = await prisma.reviewIngestionRun.count({
      where: {
        workspaceId: app.workspaceId,
        requestedAt: {
          gte: startOfMonth,
        },
        status: {
          in: ["SUCCEEDED", "PARTIAL"],
        },
      },
    })

    try {
      await assertWithinPlanLimit(
        app.workspaceId,
        "analyses",
        analysesThisMonth + 1
      )
    } catch (error) {
      throw new IngestionError(
        error instanceof Error
          ? error.message
          : "Plan limit exceeded for analyses",
        INGESTION_ERROR_CODES.PLAN_LIMIT_EXCEEDED
      )
    }
  }

  // Check rate limit
  if (!canCallAppleReviewsApi(app.workspaceId)) {
    throw new IngestionError(
      "Rate limit exceeded. Please try again later.",
      INGESTION_ERROR_CODES.RATE_LIMIT_EXCEEDED
    )
  }
}

/**
 * Insert reviews into database with deduplication
 */
async function insertReviews(
  appId: string,
  workspaceId: string,
  reviews: NormalizedReview[]
): Promise<{
  inserted: number
  duplicates: number
  skipped: number
}> {
  if (reviews.length === 0) {
    return { inserted: 0, duplicates: 0, skipped: 0 }
  }

  // Batch insert reviews in chunks to avoid timeout
  const batchSize = 100
  let totalInserted = 0
  let totalDuplicates = 0
  let totalSkipped = 0

  for (let i = 0; i < reviews.length; i += batchSize) {
    const batch = reviews.slice(i, i + batchSize)

    try {
      // Use createMany with skipDuplicates
      const result = await prisma.review.createMany({
        data: batch.map((review) => ({
          workspaceId,
          appId,
          externalReviewId: review.externalReviewId,
          rating: review.rating,
          title: review.title,
          content: review.content,
          author: review.author,
          country: review.country,
          language: review.language,
          version: review.version,
          publishedAt: review.publishedAt,
          voteSum: review.voteSum,
          voteCount: review.voteCount,
          source: review.source,
          metadata: review.metadata as any,
        })),
        skipDuplicates: true,
      })

      totalInserted += result.count
      totalDuplicates += batch.length - result.count
    } catch (error) {
      console.error(`[Ingestion] Error inserting batch ${i}-${i + batchSize}:`, error)
      totalSkipped += batch.length
    }
  }

  return {
    inserted: totalInserted,
    duplicates: totalDuplicates,
    skipped: totalSkipped,
  }
}

/**
 * Calculate retry delay based on consecutive failures
 * Exponential backoff: 5min, 15min, 1hr, 6hr, 24hr
 */
function calculateRetryDelay(failures: number): number | null {
  const delays = [
    5 * 60 * 1000, // 5 minutes
    15 * 60 * 1000, // 15 minutes
    60 * 60 * 1000, // 1 hour
    6 * 60 * 60 * 1000, // 6 hours
    24 * 60 * 60 * 1000, // 24 hours
  ]

  if (failures < 1) return null
  if (failures > delays.length) return delays[delays.length - 1]
  return delays[failures - 1]
}

/**
 * Record health metrics
 */
async function recordMetrics(data: {
  workspaceId: string
  success: boolean
  durationMs: number
  reviewsInserted: number
  errorCode?: IngestionErrorCode
}): Promise<void> {
  try {
    const { recordIngestionSuccess, recordIngestionFailure } = await import(
      "@/lib/metrics/health-tracker"
    )

    if (data.success) {
      await recordIngestionSuccess({
        workspaceId: data.workspaceId,
        durationMs: data.durationMs,
        reviewsInserted: data.reviewsInserted,
      })
    } else if (data.errorCode) {
      await recordIngestionFailure({
        workspaceId: data.workspaceId,
        durationMs: data.durationMs,
        errorCode: data.errorCode,
      })
    }
  } catch (error) {
    console.error("[Ingestion] Failed to record metrics:", error)
    // Don't fail the ingestion if metrics fail
  }
}

/**
 * Custom error class for ingestion errors
 */
class IngestionError extends Error {
  constructor(
    message: string,
    public code: IngestionErrorCode
  ) {
    super(message)
    this.name = "IngestionError"
  }
}

/**
 * Categorize errors for reporting
 */
function categorizeIngestionError(error: unknown): {
  message: string
  code: IngestionErrorCode
} {
  if (error instanceof IngestionError) {
    return {
      message: error.message,
      code: error.code,
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes("rate limit")) {
      return {
        message: error.message,
        code: INGESTION_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      }
    }
    if (message.includes("plan limit")) {
      return {
        message: error.message,
        code: INGESTION_ERROR_CODES.PLAN_LIMIT_EXCEEDED,
      }
    }
    if (message.includes("not found")) {
      return {
        message: error.message,
        code: INGESTION_ERROR_CODES.APP_NOT_FOUND,
      }
    }

    return {
      message: error.message,
      code: INGESTION_ERROR_CODES.UNKNOWN,
    }
  }

  return {
    message: "Unknown error occurred",
    code: INGESTION_ERROR_CODES.UNKNOWN,
  }
}
