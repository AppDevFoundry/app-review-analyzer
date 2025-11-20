/**
 * Quota management for review ingestion
 *
 * Tracks and enforces plan limits for review fetching operations.
 */

import { IngestionStatus, WorkspacePlan } from "@prisma/client"
import { prisma } from "@/lib/db"
import { MANUAL_INGESTION_LIMITS, getManualIngestionLimit } from "@/config/ingestion"
import { getPlanLimits } from "@/config/plan-limits"
import { ingestionLogger } from "@/lib/logger"

// ============================================================================
// Types
// ============================================================================

export interface QuotaStatus {
  /** Whether ingestion is allowed */
  allowed: boolean
  /** Reason if not allowed */
  reason?: string
  /** Error code if not allowed */
  code?: string
  /** Current usage count for the period */
  currentCount: number
  /** Maximum allowed for the period */
  limit: number
  /** Time until quota resets (ISO string) */
  resetAt?: string
}

export interface WorkspaceQuotaInfo {
  /** Workspace plan */
  plan: WorkspacePlan
  /** Manual runs allowed per day */
  manualRunsPerDay: number
  /** Manual runs used today */
  manualRunsUsedToday: number
  /** Reviews allowed per run */
  reviewsPerRun: number
  /** Whether manual ingestion is allowed */
  canRunManualIngestion: boolean
  /** Next reset time for daily limit */
  dailyResetAt: Date
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the start of the current day in UTC
 */
function getStartOfDay(): Date {
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)
  return now
}

/**
 * Get the start of the next day in UTC
 */
function getStartOfNextDay(): Date {
  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)
  return tomorrow
}

// ============================================================================
// Quota Functions
// ============================================================================

/**
 * Count manual ingestion runs for a workspace today
 */
export async function countTodayManualRuns(workspaceId: string): Promise<number> {
  const startOfDay = getStartOfDay()

  const count = await prisma.reviewIngestionRun.count({
    where: {
      workspaceId,
      reason: "manual",
      startedAt: {
        gte: startOfDay,
      },
      // Only count runs that weren't cancelled
      status: {
        not: IngestionStatus.CANCELLED,
      },
    },
  })

  return count
}

/**
 * Count all ingestion runs for a workspace in the current month
 */
export async function countMonthlyRuns(workspaceId: string): Promise<number> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const count = await prisma.reviewIngestionRun.count({
    where: {
      workspaceId,
      startedAt: {
        gte: startOfMonth,
      },
      status: {
        in: [IngestionStatus.COMPLETED, IngestionStatus.IN_PROGRESS],
      },
    },
  })

  return count
}

/**
 * Check if a workspace can run a manual ingestion
 */
export async function checkManualIngestionQuota(
  workspaceId: string,
  plan: WorkspacePlan
): Promise<QuotaStatus> {
  const limit = getManualIngestionLimit(plan)
  const currentCount = await countTodayManualRuns(workspaceId)
  const resetAt = getStartOfNextDay()

  if (currentCount >= limit) {
    ingestionLogger.dailyLimitExceeded(workspaceId, currentCount, limit)

    return {
      allowed: false,
      reason: `You've reached the daily limit of ${limit} manual review fetches for the ${plan} plan. Try again tomorrow or upgrade your plan.`,
      code: "DAILY_LIMIT_EXCEEDED",
      currentCount,
      limit,
      resetAt: resetAt.toISOString(),
    }
  }

  return {
    allowed: true,
    currentCount,
    limit,
    resetAt: resetAt.toISOString(),
  }
}

/**
 * Get review limit per run for a workspace
 * Uses custom workspace limit if set, otherwise falls back to plan default
 */
export async function getReviewsPerRunLimit(workspaceId: string): Promise<number> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      plan: true,
      reviewLimitPerRun: true,
    },
  })

  if (!workspace) {
    throw new Error("Workspace not found")
  }

  // Use custom limit if set, otherwise use plan default
  if (workspace.reviewLimitPerRun > 0) {
    return workspace.reviewLimitPerRun
  }

  const planLimits = getPlanLimits(workspace.plan)
  return planLimits.maxReviewsPerRun
}

/**
 * Get comprehensive quota information for a workspace
 */
export async function getWorkspaceQuotaInfo(workspaceId: string): Promise<WorkspaceQuotaInfo> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      plan: true,
      reviewLimitPerRun: true,
    },
  })

  if (!workspace) {
    throw new Error("Workspace not found")
  }

  const plan = workspace.plan
  const manualRunsPerDay = getManualIngestionLimit(plan)
  const manualRunsUsedToday = await countTodayManualRuns(workspaceId)
  const planLimits = getPlanLimits(plan)
  const reviewsPerRun = workspace.reviewLimitPerRun > 0
    ? workspace.reviewLimitPerRun
    : planLimits.maxReviewsPerRun

  return {
    plan,
    manualRunsPerDay,
    manualRunsUsedToday,
    reviewsPerRun,
    canRunManualIngestion: manualRunsUsedToday < manualRunsPerDay,
    dailyResetAt: getStartOfNextDay(),
  }
}

/**
 * Check if ingestion can proceed for a workspace
 * Combines all quota checks
 */
export async function canRunIngestion(
  workspaceId: string,
  reason: "manual" | "scheduled"
): Promise<QuotaStatus> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  })

  if (!workspace) {
    return {
      allowed: false,
      reason: "Workspace not found",
      code: "NOT_FOUND",
      currentCount: 0,
      limit: 0,
    }
  }

  // For manual runs, check daily quota
  if (reason === "manual") {
    return checkManualIngestionQuota(workspaceId, workspace.plan)
  }

  // For scheduled runs, always allow (controlled by cron frequency)
  return {
    allowed: true,
    currentCount: 0,
    limit: Infinity,
  }
}

/**
 * Get recent ingestion runs for an app
 */
export async function getRecentIngestionRuns(
  appId: string,
  limit: number = 10
) {
  return prisma.reviewIngestionRun.findMany({
    where: { appId },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      triggeredBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })
}

/**
 * Get the most recent successful ingestion run for an app
 */
export async function getLastSuccessfulIngestion(appId: string) {
  return prisma.reviewIngestionRun.findFirst({
    where: {
      appId,
      status: IngestionStatus.COMPLETED,
    },
    orderBy: { completedAt: "desc" },
  })
}

/**
 * Get ingestion statistics for a workspace
 */
export async function getWorkspaceIngestionStats(workspaceId: string) {
  const now = new Date()
  const startOfDay = getStartOfDay()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [todayRuns, monthRuns, totalRuns, successfulRuns, failedRuns] = await Promise.all([
    prisma.reviewIngestionRun.count({
      where: {
        workspaceId,
        startedAt: { gte: startOfDay },
      },
    }),
    prisma.reviewIngestionRun.count({
      where: {
        workspaceId,
        startedAt: { gte: startOfMonth },
      },
    }),
    prisma.reviewIngestionRun.count({
      where: { workspaceId },
    }),
    prisma.reviewIngestionRun.count({
      where: {
        workspaceId,
        status: IngestionStatus.COMPLETED,
      },
    }),
    prisma.reviewIngestionRun.count({
      where: {
        workspaceId,
        status: IngestionStatus.FAILED,
      },
    }),
  ])

  // Calculate average duration for successful runs
  const avgDuration = await prisma.reviewIngestionRun.aggregate({
    where: {
      workspaceId,
      status: IngestionStatus.COMPLETED,
      durationMs: { not: null },
    },
    _avg: {
      durationMs: true,
    },
  })

  // Calculate total reviews ingested
  const totalReviews = await prisma.reviewIngestionRun.aggregate({
    where: {
      workspaceId,
      status: IngestionStatus.COMPLETED,
    },
    _sum: {
      reviewsNew: true,
    },
  })

  return {
    todayRuns,
    monthRuns,
    totalRuns,
    successfulRuns,
    failedRuns,
    successRate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
    averageDurationMs: avgDuration._avg.durationMs || 0,
    totalReviewsIngested: totalReviews._sum.reviewsNew || 0,
  }
}
