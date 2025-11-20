/**
 * Tests for Quota Management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { WorkspacePlan, IngestionStatus } from "@prisma/client"
import { MANUAL_INGESTION_LIMITS, getManualIngestionLimit } from "@/config/ingestion"

// Mock server-only module
vi.mock("server-only", () => ({}))

describe("getManualIngestionLimit", () => {
  it("should return correct limit for STARTER plan", () => {
    const limit = getManualIngestionLimit(WorkspacePlan.STARTER)
    expect(limit).toBe(MANUAL_INGESTION_LIMITS[WorkspacePlan.STARTER])
    expect(limit).toBe(1)
  })

  it("should return correct limit for PRO plan", () => {
    const limit = getManualIngestionLimit(WorkspacePlan.PRO)
    expect(limit).toBe(MANUAL_INGESTION_LIMITS[WorkspacePlan.PRO])
    expect(limit).toBe(5)
  })

  it("should return correct limit for BUSINESS plan", () => {
    const limit = getManualIngestionLimit(WorkspacePlan.BUSINESS)
    expect(limit).toBe(MANUAL_INGESTION_LIMITS[WorkspacePlan.BUSINESS])
    expect(limit).toBe(20)
  })
})

describe("MANUAL_INGESTION_LIMITS", () => {
  it("should have limits for all workspace plans", () => {
    expect(MANUAL_INGESTION_LIMITS[WorkspacePlan.STARTER]).toBeDefined()
    expect(MANUAL_INGESTION_LIMITS[WorkspacePlan.PRO]).toBeDefined()
    expect(MANUAL_INGESTION_LIMITS[WorkspacePlan.BUSINESS]).toBeDefined()
  })

  it("should have ascending limits from STARTER to BUSINESS", () => {
    expect(MANUAL_INGESTION_LIMITS[WorkspacePlan.STARTER]).toBeLessThan(
      MANUAL_INGESTION_LIMITS[WorkspacePlan.PRO]
    )
    expect(MANUAL_INGESTION_LIMITS[WorkspacePlan.PRO]).toBeLessThan(
      MANUAL_INGESTION_LIMITS[WorkspacePlan.BUSINESS]
    )
  })
})
