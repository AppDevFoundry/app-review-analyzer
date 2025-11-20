/**
 * Snapshot Trigger Service
 *
 * Creates pending ReviewSnapshot records after successful review ingestion.
 * Task 4 will implement the actual AI analysis processing.
 */

import { SnapshotStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"

// ============================================================================
// Types
// ============================================================================

export interface SnapshotTriggerResult {
  success: boolean
  snapshotId?: string
  error?: string
}

export interface SnapshotTriggerOptions {
  /** The ingestion run that triggered this snapshot */
  ingestionRunId: string
  /** The app to create a snapshot for */
  appId: string
  /** The workspace the app belongs to */
  workspaceId: string
  /** Number of reviews available for analysis */
  reviewCount: number
  /** Optional date range for the snapshot */
  analysisRangeStart?: Date
  analysisRangeEnd?: Date
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Queue a ReviewSnapshot for processing after successful review ingestion
 *
 * This creates a snapshot record with status=PENDING that Task 4's
 * analysis service will pick up and process.
 */
export async function queueReviewSnapshot(
  options: SnapshotTriggerOptions
): Promise<SnapshotTriggerResult> {
  const {
    ingestionRunId,
    appId,
    workspaceId,
    reviewCount,
    analysisRangeStart,
    analysisRangeEnd,
  } = options

  try {
    // Create the pending snapshot
    const snapshot = await prisma.reviewSnapshot.create({
      data: {
        workspaceId,
        appId,
        status: SnapshotStatus.PENDING,
        analysisDate: new Date(),
        analysisRangeStart,
        analysisRangeEnd,
        totalReviewsAnalyzed: 0, // Will be updated during analysis
        positiveCount: 0,
        neutralCount: 0,
        negativeCount: 0,
      },
    })

    // Link the snapshot to the ingestion run
    await prisma.reviewIngestionRun.update({
      where: { id: ingestionRunId },
      data: { snapshotId: snapshot.id },
    })

    logger.info("snapshot_queued", {
      snapshotId: snapshot.id,
      ingestionRunId,
      appId,
      workspaceId,
      reviewCount,
    })

    return {
      success: true,
      snapshotId: snapshot.id,
    }
  } catch (error) {
    logger.error("snapshot_queue_failed", error, {
      ingestionRunId,
      appId,
      workspaceId,
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Get pending snapshots for processing
 * Used by Task 4's analysis service to find work to do
 */
export async function getPendingSnapshots(limit: number = 10) {
  return prisma.reviewSnapshot.findMany({
    where: {
      status: SnapshotStatus.PENDING,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
    include: {
      app: {
        select: {
          id: true,
          appStoreId: true,
          name: true,
        },
      },
      workspace: {
        select: {
          id: true,
          plan: true,
        },
      },
    },
  })
}

/**
 * Mark a snapshot as processing
 */
export async function markSnapshotProcessing(snapshotId: string) {
  return prisma.reviewSnapshot.update({
    where: { id: snapshotId },
    data: {
      status: SnapshotStatus.PROCESSING,
    },
  })
}

/**
 * Mark a snapshot as completed with results
 */
export async function markSnapshotCompleted(
  snapshotId: string,
  results: {
    totalReviewsAnalyzed: number
    positiveCount: number
    neutralCount: number
    negativeCount: number
    averageRating?: number
    medianRating?: number
    recentTrend?: string
    promptTokens?: number
    completionTokens?: number
    costInCents?: number
  }
) {
  return prisma.reviewSnapshot.update({
    where: { id: snapshotId },
    data: {
      status: SnapshotStatus.SUCCEEDED,
      ...results,
    },
  })
}

/**
 * Mark a snapshot as failed
 */
export async function markSnapshotFailed(snapshotId: string, errorMessage: string) {
  return prisma.reviewSnapshot.update({
    where: { id: snapshotId },
    data: {
      status: SnapshotStatus.FAILED,
      errorMessage,
    },
  })
}

/**
 * Check if there's already a pending snapshot for an app
 */
export async function hasPendingSnapshot(appId: string): Promise<boolean> {
  const pending = await prisma.reviewSnapshot.findFirst({
    where: {
      appId,
      status: {
        in: [SnapshotStatus.PENDING, SnapshotStatus.PROCESSING],
      },
    },
  })

  return !!pending
}

/**
 * Get the most recent snapshot for an app
 */
export async function getLatestSnapshot(appId: string) {
  return prisma.reviewSnapshot.findFirst({
    where: {
      appId,
      status: SnapshotStatus.SUCCEEDED,
    },
    orderBy: {
      analysisDate: "desc",
    },
    include: {
      ratingDistribution: true,
      insights: {
        orderBy: { mentionCount: "desc" },
        take: 10,
      },
      positiveAspects: {
        orderBy: { mentionCount: "desc" },
        take: 5,
      },
      llmInsight: true,
    },
  })
}
