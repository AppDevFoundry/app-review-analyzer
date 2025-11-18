import { describe, it, expect } from "vitest"
import { WorkspacePlan } from "@prisma/client"
import {
  PLAN_LIMITS,
  getPlanLimits,
  getEffectiveLimits,
  isUnlimited,
  exceedsLimit,
  remainingQuota,
  getDefaultWorkspaceFields,
  getLimitForMetric,
  METRIC_NAMES,
  type LimitMetric,
} from "@/config/plan-limits"

describe("PLAN_LIMITS constant", () => {
  it("should define limits for all plan tiers", () => {
    expect(PLAN_LIMITS[WorkspacePlan.STARTER]).toBeDefined()
    expect(PLAN_LIMITS[WorkspacePlan.PRO]).toBeDefined()
    expect(PLAN_LIMITS[WorkspacePlan.BUSINESS]).toBeDefined()
  })

  it("should have STARTER as the most restrictive plan", () => {
    const starter = PLAN_LIMITS[WorkspacePlan.STARTER]
    const pro = PLAN_LIMITS[WorkspacePlan.PRO]
    const business = PLAN_LIMITS[WorkspacePlan.BUSINESS]

    expect(starter.maxApps).toBeLessThanOrEqual(pro.maxApps)
    expect(starter.maxReviewsPerRun).toBeLessThanOrEqual(pro.maxReviewsPerRun)
    expect(pro.maxApps).toBeLessThanOrEqual(business.maxApps)
  })

  it("should have BUSINESS plan with unlimited analyses", () => {
    expect(PLAN_LIMITS[WorkspacePlan.BUSINESS].maxAnalysesPerMonth).toBe(-1)
  })
})

describe("getPlanLimits", () => {
  it("should return correct limits for STARTER plan", () => {
    const limits = getPlanLimits(WorkspacePlan.STARTER)
    expect(limits).toEqual({
      maxApps: 1,
      maxAnalysesPerMonth: 4,
      maxReviewsPerRun: 100,
    })
  })

  it("should return correct limits for PRO plan", () => {
    const limits = getPlanLimits(WorkspacePlan.PRO)
    expect(limits).toEqual({
      maxApps: 10,
      maxAnalysesPerMonth: 30,
      maxReviewsPerRun: 500,
    })
  })

  it("should return correct limits for BUSINESS plan", () => {
    const limits = getPlanLimits(WorkspacePlan.BUSINESS)
    expect(limits).toEqual({
      maxApps: 25,
      maxAnalysesPerMonth: -1,
      maxReviewsPerRun: 1000,
    })
  })
})

describe("getEffectiveLimits", () => {
  it("should use workspace overrides when provided", () => {
    const workspace = {
      plan: WorkspacePlan.STARTER,
      appLimit: 5,
      analysisLimitPerMonth: 10,
      reviewLimitPerRun: 200,
    }

    const limits = getEffectiveLimits(workspace)
    expect(limits).toEqual({
      maxApps: 5,
      maxAnalysesPerMonth: 10,
      maxReviewsPerRun: 200,
    })
  })

  it("should fall back to plan defaults when no overrides", () => {
    const workspace = {
      plan: WorkspacePlan.PRO,
      appLimit: 10,
      analysisLimitPerMonth: 30,
      reviewLimitPerRun: 500,
    }

    const limits = getEffectiveLimits(workspace)
    expect(limits).toEqual(getPlanLimits(WorkspacePlan.PRO))
  })

  it("should handle mixed overrides and defaults", () => {
    const workspace = {
      plan: WorkspacePlan.STARTER,
      appLimit: 3, // Override
      analysisLimitPerMonth: 4, // Default
      reviewLimitPerRun: 100, // Default
    }

    const limits = getEffectiveLimits(workspace)
    expect(limits.maxApps).toBe(3)
    expect(limits.maxAnalysesPerMonth).toBe(4)
    expect(limits.maxReviewsPerRun).toBe(100)
  })
})

describe("isUnlimited", () => {
  it("should return true for -1", () => {
    expect(isUnlimited(-1)).toBe(true)
  })

  it("should return false for positive numbers", () => {
    expect(isUnlimited(0)).toBe(false)
    expect(isUnlimited(1)).toBe(false)
    expect(isUnlimited(100)).toBe(false)
  })
})

describe("exceedsLimit", () => {
  it("should return false when usage is below limit", () => {
    expect(exceedsLimit(5, 10)).toBe(false)
    expect(exceedsLimit(0, 10)).toBe(false)
  })

  it("should return true when usage equals limit", () => {
    expect(exceedsLimit(10, 10)).toBe(true)
  })

  it("should return true when usage exceeds limit", () => {
    expect(exceedsLimit(15, 10)).toBe(true)
  })

  it("should return false for unlimited (-1)", () => {
    expect(exceedsLimit(1000, -1)).toBe(false)
    expect(exceedsLimit(999999, -1)).toBe(false)
  })
})

describe("remainingQuota", () => {
  it("should calculate remaining quota correctly", () => {
    expect(remainingQuota(3, 10)).toBe(7)
    expect(remainingQuota(0, 10)).toBe(10)
    expect(remainingQuota(10, 10)).toBe(0)
  })

  it("should return 0 when usage exceeds limit", () => {
    expect(remainingQuota(15, 10)).toBe(0)
  })

  it("should return -1 for unlimited", () => {
    expect(remainingQuota(100, -1)).toBe(-1)
    expect(remainingQuota(0, -1)).toBe(-1)
  })
})

describe("getDefaultWorkspaceFields", () => {
  it("should return correct defaults for STARTER", () => {
    const fields = getDefaultWorkspaceFields(WorkspacePlan.STARTER)
    expect(fields).toEqual({
      appLimit: 1,
      analysisLimitPerMonth: 4,
      reviewLimitPerRun: 100,
    })
  })

  it("should return correct defaults for BUSINESS", () => {
    const fields = getDefaultWorkspaceFields(WorkspacePlan.BUSINESS)
    expect(fields).toEqual({
      appLimit: 25,
      analysisLimitPerMonth: -1,
      reviewLimitPerRun: 1000,
    })
  })
})

describe("getLimitForMetric", () => {
  const limits = {
    maxApps: 10,
    maxAnalysesPerMonth: 30,
    maxReviewsPerRun: 500,
  }

  it("should return correct limit for apps metric", () => {
    expect(getLimitForMetric(limits, "apps")).toBe(10)
  })

  it("should return correct limit for analysesPerMonth metric", () => {
    expect(getLimitForMetric(limits, "analysesPerMonth")).toBe(30)
  })

  it("should return correct limit for reviewsPerRun metric", () => {
    expect(getLimitForMetric(limits, "reviewsPerRun")).toBe(500)
  })
})

describe("METRIC_NAMES constant", () => {
  it("should provide human-readable names for all metrics", () => {
    const metrics: LimitMetric[] = ["apps", "analysesPerMonth", "reviewsPerRun"]

    for (const metric of metrics) {
      expect(METRIC_NAMES[metric]).toBeDefined()
      expect(typeof METRIC_NAMES[metric]).toBe("string")
      expect(METRIC_NAMES[metric].length).toBeGreaterThan(0)
    }
  })
})
