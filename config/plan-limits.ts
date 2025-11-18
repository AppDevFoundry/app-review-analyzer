import { WorkspacePlan } from "@prisma/client"

/**
 * Plan limits configuration for different workspace tiers
 */
export interface PlanLimit {
  /** Maximum number of apps that can be tracked */
  maxApps: number
  /** Maximum number of analyses per month */
  maxAnalysesPerMonth: number
  /** Maximum number of reviews to analyze per run */
  maxReviewsPerRun: number
  /** Display name for the plan */
  displayName: string
  /** Features available in this plan */
  features: string[]
}

/**
 * Default limits for each workspace plan tier
 *
 * These limits are used as defaults when creating new workspaces.
 * Individual workspaces can have custom overrides stored in the database.
 */
export const PLAN_LIMITS: Record<WorkspacePlan, PlanLimit> = {
  [WorkspacePlan.STARTER]: {
    maxApps: 1,
    maxAnalysesPerMonth: 4, // ~1 per week
    maxReviewsPerRun: 100,
    displayName: "Starter",
    features: [
      "1 tracked app",
      "1 analysis per week",
      "Up to 100 reviews per analysis",
      "Basic insights and themes",
      "7-day history",
    ],
  },
  [WorkspacePlan.PRO]: {
    maxApps: 10,
    maxAnalysesPerMonth: 30, // ~1 per day
    maxReviewsPerRun: 1000,
    displayName: "Pro",
    features: [
      "Up to 10 tracked apps",
      "Daily analyses",
      "Up to 1,000 reviews per analysis",
      "Advanced insights and AI summaries",
      "Trend analysis over time",
      "90-day history",
      "Export reports",
    ],
  },
  [WorkspacePlan.BUSINESS]: {
    maxApps: 50,
    maxAnalysesPerMonth: 999, // Effectively unlimited
    maxReviewsPerRun: 5000,
    displayName: "Business",
    features: [
      "Up to 50 tracked apps",
      "Unlimited analyses",
      "Up to 5,000 reviews per analysis",
      "Premium AI insights",
      "Competitor analysis (coming soon)",
      "Multi-app niche reports (coming soon)",
      "Unlimited history",
      "Priority support",
      "Team collaboration",
    ],
  },
}

/**
 * Get plan limits for a given workspace plan
 */
export function getPlanLimits(plan: WorkspacePlan): PlanLimit {
  return PLAN_LIMITS[plan]
}

/**
 * Check if a plan allows a certain feature/limit
 */
export function checkPlanLimit(
  plan: WorkspacePlan,
  metric: keyof Pick<PlanLimit, "maxApps" | "maxAnalysesPerMonth" | "maxReviewsPerRun">,
  value: number
): boolean {
  const limits = getPlanLimits(plan)
  return value <= limits[metric]
}

/**
 * Get the next higher plan, or null if already at highest
 */
export function getNextPlan(currentPlan: WorkspacePlan): WorkspacePlan | null {
  const planOrder: WorkspacePlan[] = [
    WorkspacePlan.STARTER,
    WorkspacePlan.PRO,
    WorkspacePlan.BUSINESS,
  ]

  const currentIndex = planOrder.indexOf(currentPlan)
  if (currentIndex === -1 || currentIndex === planOrder.length - 1) {
    return null
  }

  return planOrder[currentIndex + 1]
}

/**
 * Get all plans ordered from lowest to highest
 */
export function getAllPlansOrdered(): WorkspacePlan[] {
  return [
    WorkspacePlan.STARTER,
    WorkspacePlan.PRO,
    WorkspacePlan.BUSINESS,
  ]
}
