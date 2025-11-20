/**
 * Integration Tests for Review Ingestion Service
 *
 * Tests the Apple Reviews client and ingestion configuration.
 * Note: Full end-to-end ingestion tests require complex mocking
 * and are covered by the cron-api integration tests.
 *
 * Run with: pnpm test tests/integration/review-ingestion.test.ts
 */

import { describe, it, expect, vi } from "vitest"
import { ReviewSource } from "@prisma/client"

// Mock server-only
vi.mock("server-only", () => ({}))

// Enable mock mode for Apple API
process.env.MOCK_APPLE_API = "true"

describe("Review Ingestion Components", () => {
  describe("MockAppleReviewsClient", () => {
    it("should return mock reviews", async () => {
      const { MockAppleReviewsClient, NormalizedReview } = await import("@/lib/apple/reviews")

      const mockReview: NormalizedReview = {
        externalId: "test-review-001",
        author: "TestUser",
        rating: 5,
        title: "Great app!",
        content: "This app is fantastic.",
        version: "1.0.0",
        voteSum: 10,
        voteCount: 12,
        publishedAt: new Date("2024-01-15T10:00:00Z"),
        source: ReviewSource.MOST_RECENT,
        raw: {} as any,
      }

      const client = new MockAppleReviewsClient([mockReview], "Test App")
      const result = await client.fetchAll("12345")

      expect(result.reviews).toHaveLength(1)
      expect(result.appName).toBe("Test App")
      expect(result.stats.uniqueCount).toBe(1)
    })

    it("should deduplicate reviews from multiple sources", async () => {
      const { MockAppleReviewsClient, NormalizedReview } = await import("@/lib/apple/reviews")

      const reviews: NormalizedReview[] = [
        {
          externalId: "review-001",
          author: "User1",
          rating: 5,
          title: "Great!",
          content: "Love it",
          version: "1.0",
          voteSum: 5,
          voteCount: 5,
          publishedAt: new Date(),
          source: ReviewSource.MOST_RECENT,
          raw: {} as any,
        },
        {
          externalId: "review-001", // Same ID - duplicate
          author: "User1",
          rating: 5,
          title: "Great!",
          content: "Love it",
          version: "1.0",
          voteSum: 5,
          voteCount: 5,
          publishedAt: new Date(),
          source: ReviewSource.MOST_HELPFUL, // Different source
          raw: {} as any,
        },
        {
          externalId: "review-002", // Different review
          author: "User2",
          rating: 4,
          title: "Good",
          content: "Nice app",
          version: "1.0",
          voteSum: 3,
          voteCount: 3,
          publishedAt: new Date(),
          source: ReviewSource.MOST_RECENT,
          raw: {} as any,
        },
      ]

      const client = new MockAppleReviewsClient(reviews, "Test App")
      const result = await client.fetchAll("12345")

      expect(result.stats.uniqueCount).toBe(2)
      expect(result.stats.duplicateCount).toBe(1)
    })
  })

  describe("Ingestion Configuration", () => {
    it("should have valid configuration values", async () => {
      const { INGESTION_CONFIG, MANUAL_INGESTION_LIMITS } = await import("@/config/ingestion")
      const { WorkspacePlan } = await import("@prisma/client")

      expect(INGESTION_CONFIG.maxPagesPerSource).toBeGreaterThan(0)
      expect(INGESTION_CONFIG.requestTimeoutMs).toBeGreaterThan(0)
      expect(INGESTION_CONFIG.delayBetweenPagesMs).toBeGreaterThan(0)
      expect(INGESTION_CONFIG.retryDelaysMs).toHaveLength(3)

      // Plan limits should be ascending
      expect(MANUAL_INGESTION_LIMITS[WorkspacePlan.STARTER]).toBeLessThan(
        MANUAL_INGESTION_LIMITS[WorkspacePlan.PRO]
      )
      expect(MANUAL_INGESTION_LIMITS[WorkspacePlan.PRO]).toBeLessThan(
        MANUAL_INGESTION_LIMITS[WorkspacePlan.BUSINESS]
      )
    })

    it("should provide error messages for all error codes", async () => {
      const { INGESTION_ERROR_CODES, getIngestionErrorMessage } = await import("@/config/ingestion")

      Object.values(INGESTION_ERROR_CODES).forEach((code) => {
        const message = getIngestionErrorMessage(code)
        expect(message).toBeTruthy()
        expect(typeof message).toBe("string")
      })
    })
  })

  describe("createAppleReviewsClient factory", () => {
    it("should return MockAppleReviewsClient when MOCK_APPLE_API is true", async () => {
      process.env.MOCK_APPLE_API = "true"

      const { createAppleReviewsClient, MockAppleReviewsClient } = await import("@/lib/apple/reviews")
      const client = createAppleReviewsClient()

      expect(client).toBeInstanceOf(MockAppleReviewsClient)
    })

    it("should return AppleReviewsClient when MOCK_APPLE_API is false", async () => {
      process.env.MOCK_APPLE_API = "false"

      const { createAppleReviewsClient, AppleReviewsClient } = await import("@/lib/apple/reviews")
      const client = createAppleReviewsClient()

      expect(client).toBeInstanceOf(AppleReviewsClient)

      // Reset to mock mode
      process.env.MOCK_APPLE_API = "true"
    })
  })

  describe("AppleApiError", () => {
    it("should create error with correct properties", async () => {
      const { AppleApiError } = await import("@/lib/apple/reviews")
      const { INGESTION_ERROR_CODES } = await import("@/config/ingestion")

      const error = new AppleApiError(
        "Not found",
        INGESTION_ERROR_CODES.APPLE_NOT_FOUND,
        404
      )

      expect(error.message).toBe("Not found")
      expect(error.code).toBe(INGESTION_ERROR_CODES.APPLE_NOT_FOUND)
      expect(error.status).toBe(404)
      expect(error.name).toBe("AppleApiError")
    })

    it("should include retryAfter for rate limit errors", async () => {
      const { AppleApiError } = await import("@/lib/apple/reviews")
      const { INGESTION_ERROR_CODES } = await import("@/config/ingestion")

      const error = new AppleApiError(
        "Rate limited",
        INGESTION_ERROR_CODES.APPLE_RATE_LIMITED,
        429,
        60
      )

      expect(error.retryAfter).toBe(60)
    })
  })
})
