import { WorkspacePlan, type Workspace } from "@prisma/client"

/**
 * Defines the resource limits for each workspace plan tier.
 */
export type PlanLimit = {
  /** Maximum number of apps that can be tracked in the workspace */
  maxApps: number
  /** Maximum number of analysis runs per month (-1 = unlimited) */
  maxAnalysesPerMonth: number
  /** Maximum number of reviews to include per analysis run */
  maxReviewsPerRun: number
}

/**
 * Default limits for each plan tier.
 * These are used when creating new workspaces and as fallbacks.
 */
export const PLAN_LIMITS: Record<WorkspacePlan, PlanLimit> = {
  [WorkspacePlan.STARTER]: {
    maxApps: 1,
    maxAnalysesPerMonth: 4,
    maxReviewsPerRun: 100,
  },
  [WorkspacePlan.PRO]: {
    maxApps: 10,
    maxAnalysesPerMonth: 30,
    maxReviewsPerRun: 500,
  },
  [WorkspacePlan.BUSINESS]: {
    maxApps: 25,
    maxAnalysesPerMonth: -1, // Unlimited
    maxReviewsPerRun: 1000,
  },
}

/**
 * Get the default limits for a plan tier.
 */
export function getPlanLimits(plan: WorkspacePlan): PlanLimit {
  return PLAN_LIMITS[plan]
}

/**
 * Get the effective limits for a workspace, accounting for custom overrides.
 * Workspace-level overrides take precedence over plan defaults.
 */
export function getEffectiveLimits(workspace: Pick<Workspace, "plan" | "appLimit" | "analysisLimitPerMonth" | "reviewLimitPerRun">): PlanLimit {
  const planDefaults = getPlanLimits(workspace.plan)

  return {
    maxApps: workspace.appLimit ?? planDefaults.maxApps,
    maxAnalysesPerMonth: workspace.analysisLimitPerMonth ?? planDefaults.maxAnalysesPerMonth,
    maxReviewsPerRun: workspace.reviewLimitPerRun ?? planDefaults.maxReviewsPerRun,
  }
}

/**
 * Check if a limit value represents "unlimited" (-1).
 */
export function isUnlimited(limit: number): boolean {
  return limit === -1
}

/**
 * Check if a usage value exceeds the limit.
 * Returns false if the limit is unlimited (-1).
 */
export function exceedsLimit(usage: number, limit: number): boolean {
  if (isUnlimited(limit)) {
    return false
  }
  return usage >= limit
}

/**
 * Calculate remaining quota for a given limit and current usage.
 * Returns -1 if the limit is unlimited.
 */
export function remainingQuota(usage: number, limit: number): number {
  if (isUnlimited(limit)) {
    return -1
  }
  return Math.max(0, limit - usage)
}

/**
 * Get the default workspace field values for a given plan.
 * Used when creating new workspaces.
 */
export function getDefaultWorkspaceFields(plan: WorkspacePlan): {
  appLimit: number
  analysisLimitPerMonth: number
  reviewLimitPerRun: number
} {
  const limits = getPlanLimits(plan)
  return {
    appLimit: limits.maxApps,
    analysisLimitPerMonth: limits.maxAnalysesPerMonth,
    reviewLimitPerRun: limits.maxReviewsPerRun,
  }
}

/**
 * Metrics that can be checked against plan limits.
 */
export type LimitMetric = "apps" | "analysesPerMonth" | "reviewsPerRun"

/**
 * Map a metric type to its corresponding limit field.
 */
export function getLimitForMetric(limits: PlanLimit, metric: LimitMetric): number {
  switch (metric) {
    case "apps":
      return limits.maxApps
    case "analysesPerMonth":
      return limits.maxAnalysesPerMonth
    case "reviewsPerRun":
      return limits.maxReviewsPerRun
  }
}

/**
 * Human-readable names for limit metrics.
 */
export const METRIC_NAMES: Record<LimitMetric, string> = {
  apps: "tracked apps",
  analysesPerMonth: "analyses per month",
  reviewsPerRun: "reviews per analysis",
}
