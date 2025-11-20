/**
 * Metrics and Health Monitoring Actions
 *
 * Server actions for accessing system health metrics.
 * Super admin only for system-wide metrics.
 * Users can access their own workspace metrics.
 */

"use server"

import { auth } from "@/auth"
import { assertSuperAdmin, isSuperAdmin } from "@/lib/permissions"
import {
  getSystemHealthMetrics,
  calculateSuccessRate,
  getAverageIngestionDuration,
  getTopErrors,
  getWorkspaceUsageStats,
  getAppsWithFailures,
  getIngestionTimeline,
} from "@/lib/metrics/health-tracker"
import { prisma } from "@/lib/db"

/**
 * Action result type
 */
type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code: string }

/**
 * Get system-wide health overview
 * Super admin only
 */
export async function getSystemHealth(): Promise<
  ActionResult<{
    successRate: number
    avgDuration: number
    totalIngestions24h: number
    totalIngestions7d: number
    totalIngestions30d: number
    topErrors: Array<{ errorCode: string; count: number }>
    failingApps: number
  }>
> {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return {
        success: false,
        error: "You must be logged in",
        code: "UNAUTHORIZED",
      }
    }

    assertSuperAdmin(session.user.email)

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      successRate,
      avgDuration,
      topErrors,
      failingApps,
      runs24h,
      runs7d,
      runs30d,
    ] = await Promise.all([
      calculateSuccessRate({ startDate: sevenDaysAgo }),
      getAverageIngestionDuration({ startDate: sevenDaysAgo }),
      getTopErrors({ startDate: sevenDaysAgo, limit: 5 }),
      getAppsWithFailures(3),
      prisma.reviewIngestionRun.count({
        where: {
          requestedAt: { gte: oneDayAgo },
        },
      }),
      prisma.reviewIngestionRun.count({
        where: {
          requestedAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.reviewIngestionRun.count({
        where: {
          requestedAt: { gte: thirtyDaysAgo },
        },
      }),
    ])

    return {
      success: true,
      data: {
        successRate,
        avgDuration,
        totalIngestions24h: runs24h,
        totalIngestions7d: runs7d,
        totalIngestions30d: runs30d,
        topErrors,
        failingApps: failingApps.length,
      },
    }
  } catch (error) {
    console.error("[Action] Error fetching system health:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch system health",
      code: "PERMISSION_DENIED",
    }
  }
}

/**
 * Get detailed metrics for super admin dashboard
 * Super admin only
 */
export async function getDetailedMetrics(options: {
  startDate?: string
  endDate?: string
}): Promise<
  ActionResult<{
    metrics: Array<{
      metricType: string
      avgValue: number
      minValue: number
      maxValue: number
      count: number
      sumValue: number
    }>
    timeline: Array<{
      timestamp: Date
      successes: number
      failures: number
      avgDuration: number
    }>
    failingApps: Array<{
      id: string
      name: string
      appStoreId: string
      consecutiveFailures: number
      lastFailureReason: string | null
      nextRetryAt: Date | null
    }>
  }>
> {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return {
        success: false,
        error: "You must be logged in",
        code: "UNAUTHORIZED",
      }
    }

    assertSuperAdmin(session.user.email)

    const startDate = options.startDate ? new Date(options.startDate) : undefined
    const endDate = options.endDate ? new Date(options.endDate) : undefined

    const [metrics, timeline, failingApps] = await Promise.all([
      getSystemHealthMetrics({ startDate, endDate }),
      getIngestionTimeline({ startDate, endDate, intervalHours: 24 }),
      getAppsWithFailures(3),
    ])

    return {
      success: true,
      data: {
        metrics,
        timeline,
        failingApps,
      },
    }
  } catch (error) {
    console.error("[Action] Error fetching detailed metrics:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch metrics",
      code: "PERMISSION_DENIED",
    }
  }
}

/**
 * Get workspace-specific ingestion statistics
 * Available to workspace members
 */
export async function getWorkspaceIngestionStats(
  workspaceId: string
): Promise<
  ActionResult<{
    totalIngestions: number
    successfulIngestions: number
    failedIngestions: number
    successRate: number
    avgDuration: number
    totalReviewsFetched: number
    rateLimitHits: number
    planLimitHits: number
    recentTimeline: Array<{
      timestamp: Date
      successes: number
      failures: number
      avgDuration: number
    }>
  }>
> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: "You must be logged in",
        code: "UNAUTHORIZED",
      }
    }

    // Verify workspace membership
    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    })

    if (!member) {
      return {
        success: false,
        error: "Workspace not found or access denied",
        code: "NOT_FOUND",
      }
    }

    const [stats, timeline] = await Promise.all([
      getWorkspaceUsageStats(workspaceId),
      getIngestionTimeline({
        workspaceId,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        intervalHours: 24,
      }),
    ])

    return {
      success: true,
      data: {
        ...stats,
        recentTimeline: timeline,
      },
    }
  } catch (error) {
    console.error("[Action] Error fetching workspace stats:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch workspace stats",
      code: "UNKNOWN",
    }
  }
}

/**
 * Get app-specific ingestion history with charts data
 */
export async function getAppIngestionHistory(
  appId: string
): Promise<
  ActionResult<{
    timeline: Array<{
      timestamp: Date
      successes: number
      failures: number
      avgDuration: number
    }>
    recentRuns: Array<{
      id: string
      status: string
      requestedAt: Date
      durationMs: number | null
      reviewsInserted: number
    }>
  }>
> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: "You must be logged in",
        code: "UNAUTHORIZED",
      }
    }

    // Get app and verify access
    const app = await prisma.app.findUnique({
      where: { id: appId },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    })

    if (!app || app.workspace.members.length === 0) {
      return {
        success: false,
        error: "App not found or access denied",
        code: "NOT_FOUND",
      }
    }

    const [timeline, recentRuns] = await Promise.all([
      getIngestionTimeline({
        workspaceId: app.workspaceId,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        intervalHours: 24,
      }),
      prisma.reviewIngestionRun.findMany({
        where: { appId },
        orderBy: { requestedAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          requestedAt: true,
          durationMs: true,
          reviewsInserted: true,
        },
      }),
    ])

    return {
      success: true,
      data: {
        timeline,
        recentRuns,
      },
    }
  } catch (error) {
    console.error("[Action] Error fetching app history:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch app history",
      code: "UNKNOWN",
    }
  }
}
