/**
 * Sample test to validate Vitest setup
 * Tests the plan limits configuration
 */

import { describe, it, expect } from "vitest"
import {
  PLAN_LIMITS,
  getPlanLimits,
  checkPlanLimit,
  getNextPlan,
  getAllPlansOrdered,
} from "@/config/plan-limits"
import { WorkspacePlan } from "@prisma/client"

describe("Plan Limits Configuration", () => {
  describe("PLAN_LIMITS constant", () => {
    it("should define limits for all plan tiers", () => {
      expect(PLAN_LIMITS).toBeDefined()
      expect(PLAN_LIMITS.STARTER).toBeDefined()
      expect(PLAN_LIMITS.PRO).toBeDefined()
      expect(PLAN_LIMITS.BUSINESS).toBeDefined()
    })

    it("should have correct STARTER plan limits", () => {
      const starter = PLAN_LIMITS.STARTER
      expect(starter.maxApps).toBe(1)
      expect(starter.maxAnalysesPerMonth).toBe(4)
      expect(starter.maxReviewsPerRun).toBe(100)
      expect(starter.displayName).toBe("Starter")
      expect(starter.features).toBeInstanceOf(Array)
      expect(starter.features.length).toBeGreaterThan(0)
    })

    it("should have correct PRO plan limits", () => {
      const pro = PLAN_LIMITS.PRO
      expect(pro.maxApps).toBe(10)
      expect(pro.maxAnalysesPerMonth).toBe(30)
      expect(pro.maxReviewsPerRun).toBe(1000)
      expect(pro.displayName).toBe("Pro")
    })

    it("should have correct BUSINESS plan limits", () => {
      const business = PLAN_LIMITS.BUSINESS
      expect(business.maxApps).toBe(50)
      expect(business.maxAnalysesPerMonth).toBe(999)
      expect(business.maxReviewsPerRun).toBe(5000)
      expect(business.displayName).toBe("Business")
    })

    it("should have increasing limits across tiers", () => {
      expect(PLAN_LIMITS.PRO.maxApps).toBeGreaterThan(PLAN_LIMITS.STARTER.maxApps)
      expect(PLAN_LIMITS.BUSINESS.maxApps).toBeGreaterThan(PLAN_LIMITS.PRO.maxApps)

      expect(PLAN_LIMITS.PRO.maxAnalysesPerMonth).toBeGreaterThan(
        PLAN_LIMITS.STARTER.maxAnalysesPerMonth
      )
      expect(PLAN_LIMITS.BUSINESS.maxAnalysesPerMonth).toBeGreaterThan(
        PLAN_LIMITS.PRO.maxAnalysesPerMonth
      )
    })
  })

  describe("getPlanLimits()", () => {
    it("should return correct limits for each plan", () => {
      const starter = getPlanLimits(WorkspacePlan.STARTER)
      expect(starter).toEqual(PLAN_LIMITS.STARTER)

      const pro = getPlanLimits(WorkspacePlan.PRO)
      expect(pro).toEqual(PLAN_LIMITS.PRO)

      const business = getPlanLimits(WorkspacePlan.BUSINESS)
      expect(business).toEqual(PLAN_LIMITS.BUSINESS)
    })
  })

  describe("checkPlanLimit()", () => {
    it("should return true when within limits", () => {
      expect(checkPlanLimit(WorkspacePlan.STARTER, "maxApps", 1)).toBe(true)
      expect(checkPlanLimit(WorkspacePlan.PRO, "maxApps", 5)).toBe(true)
      expect(checkPlanLimit(WorkspacePlan.BUSINESS, "maxApps", 30)).toBe(true)
    })

    it("should return false when exceeding limits", () => {
      expect(checkPlanLimit(WorkspacePlan.STARTER, "maxApps", 2)).toBe(false)
      expect(checkPlanLimit(WorkspacePlan.PRO, "maxApps", 11)).toBe(false)
      expect(checkPlanLimit(WorkspacePlan.BUSINESS, "maxApps", 51)).toBe(false)
    })

    it("should return true when exactly at limit", () => {
      expect(checkPlanLimit(WorkspacePlan.STARTER, "maxApps", 1)).toBe(true)
      expect(checkPlanLimit(WorkspacePlan.PRO, "maxAnalysesPerMonth", 30)).toBe(true)
      expect(checkPlanLimit(WorkspacePlan.BUSINESS, "maxReviewsPerRun", 5000)).toBe(true)
    })
  })

  describe("getNextPlan()", () => {
    it("should return PRO when on STARTER", () => {
      expect(getNextPlan(WorkspacePlan.STARTER)).toBe(WorkspacePlan.PRO)
    })

    it("should return BUSINESS when on PRO", () => {
      expect(getNextPlan(WorkspacePlan.PRO)).toBe(WorkspacePlan.BUSINESS)
    })

    it("should return null when on BUSINESS (highest tier)", () => {
      expect(getNextPlan(WorkspacePlan.BUSINESS)).toBeNull()
    })
  })

  describe("getAllPlansOrdered()", () => {
    it("should return all plans in correct order", () => {
      const plans = getAllPlansOrdered()
      expect(plans).toEqual([
        WorkspacePlan.STARTER,
        WorkspacePlan.PRO,
        WorkspacePlan.BUSINESS,
      ])
    })

    it("should return array of length 3", () => {
      expect(getAllPlansOrdered()).toHaveLength(3)
    })
  })
})
