/**
 * Tests for Ingestion Configuration
 */

import { describe, it, expect } from "vitest"
import {
  INGESTION_CONFIG,
  INGESTION_ERROR_CODES,
  INGESTION_ERROR_MESSAGES,
  getIngestionErrorMessage,
} from "@/config/ingestion"

describe("INGESTION_CONFIG", () => {
  it("should have valid maxPagesPerSource", () => {
    expect(INGESTION_CONFIG.maxPagesPerSource).toBeGreaterThan(0)
    expect(INGESTION_CONFIG.maxPagesPerSource).toBeLessThanOrEqual(100)
  })

  it("should have valid timeout settings", () => {
    expect(INGESTION_CONFIG.requestTimeoutMs).toBeGreaterThan(0)
    expect(INGESTION_CONFIG.requestTimeoutMs).toBeLessThanOrEqual(60000)
  })

  it("should have valid delay settings", () => {
    expect(INGESTION_CONFIG.delayBetweenPagesMs).toBeGreaterThan(0)
    expect(INGESTION_CONFIG.delayBetweenSourcesMs).toBeGreaterThan(
      INGESTION_CONFIG.delayBetweenPagesMs
    )
  })

  it("should have retry delays defined", () => {
    expect(INGESTION_CONFIG.retryDelaysMs).toHaveLength(3)
    expect(INGESTION_CONFIG.retryDelaysMs.every(d => d > 0)).toBe(true)
  })

  it("should have valid Apple base URL", () => {
    expect(INGESTION_CONFIG.appleBaseUrl).toMatch(/^https:\/\//)
    expect(INGESTION_CONFIG.appleBaseUrl).toContain("itunes.apple.com")
  })
})

describe("INGESTION_ERROR_CODES", () => {
  it("should have all required error codes", () => {
    const requiredCodes = [
      "INVALID_APP_ID",
      "APP_NOT_FOUND",
      "APP_PAUSED",
      "APP_ARCHIVED",
      "PERMISSION_DENIED",
      "PLAN_LIMIT_EXCEEDED",
      "DAILY_LIMIT_EXCEEDED",
      "RATE_LIMIT_EXCEEDED",
      "APPLE_API_ERROR",
      "APPLE_RATE_LIMITED",
      "APPLE_NOT_FOUND",
      "APPLE_TIMEOUT",
      "DATABASE_ERROR",
      "INTERNAL_ERROR",
      "INGESTION_CANCELLED",
    ]

    requiredCodes.forEach(code => {
      expect(Object.values(INGESTION_ERROR_CODES)).toContain(code)
    })
  })
})

describe("getIngestionErrorMessage", () => {
  it("should return message for valid error code", () => {
    const message = getIngestionErrorMessage(INGESTION_ERROR_CODES.APP_NOT_FOUND)
    expect(message).toBeTruthy()
    expect(typeof message).toBe("string")
    expect(message.length).toBeGreaterThan(0)
  })

  it("should return internal error message for unknown code", () => {
    const message = getIngestionErrorMessage("UNKNOWN_CODE" as any)
    expect(message).toBe(INGESTION_ERROR_MESSAGES[INGESTION_ERROR_CODES.INTERNAL_ERROR])
  })

  it("should have messages for all error codes", () => {
    Object.values(INGESTION_ERROR_CODES).forEach(code => {
      const message = getIngestionErrorMessage(code)
      expect(message).toBeTruthy()
      expect(typeof message).toBe("string")
    })
  })
})
