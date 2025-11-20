/**
 * System Health Metrics Tracker
 *
 * Records and aggregates health metrics for monitoring system performance.
 * Used by review ingestion service and super admin dashboard.
 */

import type { MetricType } from "@prisma/client"

import { prisma } from "@/lib/db"

/**
 * Record a health metric
 *
 * @param type - Metric type
 * @param value - Metric value
 * @param metadata - Optional metadata
 * @param workspaceId - Optional workspace (null for system-wide)
 */
export async function recordMetric(
  type: MetricType,
  value: number,
  metadata?: Record<string, unknown>,
  workspaceId?: string | null
): Promise<void> {
  try {
    await prisma.systemHealthMetric.create({
      data: {
        metricType: type,
        value,
        metadata: metadata || null,
        workspaceId: workspaceId || null,
        recordedAt: new Date(),
      },
    })
  } catch (error) {
    console.error("[Metrics] Failed to record metric:", error)
    // Don't throw - metrics failures shouldn't break the app
  }
}

/**
 * Record ingestion success
 */
export async function recordIngestionSuccess(data: {
  workspaceId: string
  durationMs: number
  reviewsInserted: number
}): Promise<void> {
  await Promise.all([
    recordMetric(
      "INGESTION_SUCCESS_RATE",
      1,
      { durationMs: data.durationMs, reviewsInserted: data.reviewsInserted },
      data.workspaceId
    ),
    recordMetric(
      "AVG_INGESTION_DURATION",
      data.durationMs,
      undefined,
      data.workspaceId
    ),
    recordMetric(
      "TOTAL_REVIEWS_INSERTED",
      data.reviewsInserted,
      undefined,
      data.workspaceId
    ),
  ])
}

/**
 * Record ingestion failure
 */
export async function recordIngestionFailure(data: {
  workspaceId: string
  durationMs: number
  errorCode: string
}): Promise<void> {
  await Promise.all([
    recordMetric(
      "INGESTION_FAILURE_RATE",
      1,
      { errorCode: data.errorCode },
      data.workspaceId
    ),
    recordMetric(
      "API_ERROR_RATE",
      1,
      { errorCode: data.errorCode },
      data.workspaceId
    ),
  ])
}

/**
 * Record rate limit hit
 */
export async function recordRateLimitHit(
  workspaceId: string,
  apiType: "APPLE_API" | "APPLE_REVIEWS"
): Promise<void> {
  await recordMetric(
    "RATE_LIMIT_HITS",
    1,
    { apiType },
    workspaceId
  )
}

/**
 * Record plan limit hit
 */
export async function recordPlanLimitHit(
  workspaceId: string,
  limitType: string
): Promise<void> {
  await recordMetric(
    "PLAN_LIMIT_HITS",
    1,
    { limitType },
    workspaceId
  )
}

/**
 * Get system health metrics
 *
 * @param options - Query options
 * @returns Aggregated metrics
 */
export async function getSystemHealthMetrics(options: {
  startDate?: Date
  endDate?: Date
  metricTypes?: MetricType[]
  workspaceId?: string
}): Promise<
  Array<{
    metricType: MetricType
    avgValue: number
    minValue: number
    maxValue: number
    count: number
    sumValue: number
  }>
> {
  const startDate = options.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Default: last 7 days
  const endDate = options.endDate || new Date()

  const metrics = await prisma.systemHealthMetric.groupBy({
    by: ["metricType"],
    where: {
      recordedAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(options.metricTypes && {
        metricType: {
          in: options.metricTypes,
        },
      }),
      ...(options.workspaceId && {
        workspaceId: options.workspaceId,
      }),
    },
    _avg: {
      value: true,
    },
    _min: {
      value: true,
    },
    _max: {
      value: true,
    },
    _count: {
      value: true,
    },
    _sum: {
      value: true,
    },
  })

  return metrics.map((m) => ({
    metricType: m.metricType,
    avgValue: m._avg.value || 0,
    minValue: m._min.value || 0,
    maxValue: m._max.value || 0,
    count: m._count.value,
    sumValue: m._sum.value || 0,
  }))
}

/**
 * Calculate ingestion success rate
 *
 * @param options - Query options
 * @returns Success rate percentage
 */
export async function calculateSuccessRate(options: {
  startDate?: Date
  endDate?: Date
  workspaceId?: string
}): Promise<number> {
  const startDate = options.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const endDate = options.endDate || new Date()

  const [successes, failures] = await Promise.all([
    prisma.systemHealthMetric.count({
      where: {
        metricType: "INGESTION_SUCCESS_RATE",
        recordedAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(options.workspaceId && {
          workspaceId: options.workspaceId,
        }),
      },
    }),
    prisma.systemHealthMetric.count({
      where: {
        metricType: "INGESTION_FAILURE_RATE",
        recordedAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(options.workspaceId && {
          workspaceId: options.workspaceId,
        }),
      },
    }),
  ])

  const total = successes + failures
  if (total === 0) return 0

  return (successes / total) * 100
}

/**
 * Get average ingestion duration
 */
export async function getAverageIngestionDuration(options: {
  startDate?: Date
  endDate?: Date
  workspaceId?: string
}): Promise<number> {
  const startDate = options.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const endDate = options.endDate || new Date()

  const result = await prisma.systemHealthMetric.aggregate({
    where: {
      metricType: "AVG_INGESTION_DURATION",
      recordedAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(options.workspaceId && {
        workspaceId: options.workspaceId,
      }),
    },
    _avg: {
      value: true,
    },
  })

  return result._avg.value || 0
}

/**
 * Get top error codes
 */
export async function getTopErrors(options: {
  startDate?: Date
  endDate?: Date
  limit?: number
}): Promise<Array<{ errorCode: string; count: number }>> {
  const startDate = options.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const endDate = options.endDate || new Date()

  const metrics = await prisma.systemHealthMetric.findMany({
    where: {
      metricType: "API_ERROR_RATE",
      recordedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      metadata: true,
    },
  })

  // Count error codes
  const errorCounts = new Map<string, number>()
  for (const metric of metrics) {
    const errorCode = (metric.metadata as any)?.errorCode || "UNKNOWN"
    errorCounts.set(errorCode, (errorCounts.get(errorCode) || 0) + 1)
  }

  // Sort and limit
  return Array.from(errorCounts.entries())
    .map(([errorCode, count]) => ({ errorCode, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, options.limit || 10)
}

/**
 * Get workspace usage statistics
 */
export async function getWorkspaceUsageStats(
  workspaceId: string,
  options: {
    startDate?: Date
    endDate?: Date
  } = {}
): Promise<{
  totalIngestions: number
  successfulIngestions: number
  failedIngestions: number
  successRate: number
  avgDuration: number
  totalReviewsFetched: number
  rateLimitHits: number
  planLimitHits: number
}> {
  const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Default: last 30 days
  const endDate = options.endDate || new Date()

  const [
    successCount,
    failureCount,
    avgDuration,
    totalReviews,
    rateLimits,
    planLimits,
  ] = await Promise.all([
    prisma.systemHealthMetric.count({
      where: {
        workspaceId,
        metricType: "INGESTION_SUCCESS_RATE",
        recordedAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.systemHealthMetric.count({
      where: {
        workspaceId,
        metricType: "INGESTION_FAILURE_RATE",
        recordedAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.systemHealthMetric.aggregate({
      where: {
        workspaceId,
        metricType: "AVG_INGESTION_DURATION",
        recordedAt: { gte: startDate, lte: endDate },
      },
      _avg: { value: true },
    }),
    prisma.systemHealthMetric.aggregate({
      where: {
        workspaceId,
        metricType: "TOTAL_REVIEWS_INSERTED",
        recordedAt: { gte: startDate, lte: endDate },
      },
      _sum: { value: true },
    }),
    prisma.systemHealthMetric.count({
      where: {
        workspaceId,
        metricType: "RATE_LIMIT_HITS",
        recordedAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.systemHealthMetric.count({
      where: {
        workspaceId,
        metricType: "PLAN_LIMIT_HITS",
        recordedAt: { gte: startDate, lte: endDate },
      },
    }),
  ])

  const total = successCount + failureCount

  return {
    totalIngestions: total,
    successfulIngestions: successCount,
    failedIngestions: failureCount,
    successRate: total > 0 ? (successCount / total) * 100 : 0,
    avgDuration: avgDuration._avg.value || 0,
    totalReviewsFetched: totalReviews._sum.value || 0,
    rateLimitHits: rateLimits,
    planLimitHits: planLimits,
  }
}

/**
 * Get apps with consecutive failures
 */
export async function getAppsWithFailures(
  minFailures: number = 3
): Promise<
  Array<{
    id: string
    name: string
    appStoreId: string
    workspaceId: string
    consecutiveFailures: number
    lastFailureReason: string | null
    nextRetryAt: Date | null
  }>
> {
  return prisma.app.findMany({
    where: {
      consecutiveFailures: {
        gte: minFailures,
      },
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      appStoreId: true,
      workspaceId: true,
      consecutiveFailures: true,
      lastFailureReason: true,
      nextRetryAt: true,
    },
    orderBy: {
      consecutiveFailures: "desc",
    },
  })
}

/**
 * Get ingestion timeline data for charts
 */
export async function getIngestionTimeline(options: {
  startDate?: Date
  endDate?: Date
  workspaceId?: string
  intervalHours?: number
}): Promise<
  Array<{
    timestamp: Date
    successes: number
    failures: number
    avgDuration: number
  }>
> {
  const startDate = options.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const endDate = options.endDate || new Date()
  const intervalMs = (options.intervalHours || 24) * 60 * 60 * 1000

  // Get all metrics in range
  const metrics = await prisma.systemHealthMetric.findMany({
    where: {
      recordedAt: {
        gte: startDate,
        lte: endDate,
      },
      metricType: {
        in: [
          "INGESTION_SUCCESS_RATE",
          "INGESTION_FAILURE_RATE",
          "AVG_INGESTION_DURATION",
        ],
      },
      ...(options.workspaceId && {
        workspaceId: options.workspaceId,
      }),
    },
    select: {
      metricType: true,
      value: true,
      recordedAt: true,
    },
    orderBy: {
      recordedAt: "asc",
    },
  })

  // Group by time buckets
  const buckets = new Map<
    number,
    { successes: number; failures: number; durations: number[] }
  >()

  for (const metric of metrics) {
    const bucketTime = Math.floor(metric.recordedAt.getTime() / intervalMs) * intervalMs
    const bucket = buckets.get(bucketTime) || { successes: 0, failures: 0, durations: [] }

    if (metric.metricType === "INGESTION_SUCCESS_RATE") {
      bucket.successes++
    } else if (metric.metricType === "INGESTION_FAILURE_RATE") {
      bucket.failures++
    } else if (metric.metricType === "AVG_INGESTION_DURATION") {
      bucket.durations.push(metric.value)
    }

    buckets.set(bucketTime, bucket)
  }

  // Convert to array
  return Array.from(buckets.entries())
    .map(([timestamp, data]) => ({
      timestamp: new Date(timestamp),
      successes: data.successes,
      failures: data.failures,
      avgDuration:
        data.durations.length > 0
          ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
          : 0,
    }))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}
