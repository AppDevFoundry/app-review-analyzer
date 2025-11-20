/**
 * Tests for Apple Reviews Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ReviewSource } from "@prisma/client"
import {
  AppleReviewsClient,
  MockAppleReviewsClient,
  NormalizedReview,
  AppleApiError,
} from "@/lib/apple/reviews"
import { INGESTION_ERROR_CODES } from "@/config/ingestion"

// Sample review data for testing
const mockReview: NormalizedReview = {
  externalId: "review-001",
  author: "TestUser1",
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

const mockReviews: NormalizedReview[] = [
  mockReview,
  {
    ...mockReview,
    externalId: "review-002",
    author: "TestUser2",
    rating: 3,
    source: ReviewSource.MOST_RECENT,
  },
  {
    ...mockReview,
    externalId: "review-003",
    author: "TestUser3",
    rating: 5,
    source: ReviewSource.MOST_HELPFUL,
  },
]

describe("MockAppleReviewsClient", () => {
  let client: MockAppleReviewsClient

  beforeEach(() => {
    client = new MockAppleReviewsClient(mockReviews, "Test App")
  })

  describe("fetchSource", () => {
    it("should return reviews filtered by source", async () => {
      const result = await client.fetchSource("12345", "mostRecent")

      expect(result.reviews).toHaveLength(2) // Only MOST_RECENT reviews
      expect(result.reviews.every(r => r.source === ReviewSource.MOST_RECENT)).toBe(true)
      expect(result.appName).toBe("Test App")
    })

    it("should return helpful reviews when requested", async () => {
      const result = await client.fetchSource("12345", "mostHelpful")

      expect(result.reviews).toHaveLength(1) // Only MOST_HELPFUL reviews
      expect(result.reviews[0].source).toBe(ReviewSource.MOST_HELPFUL)
    })
  })

  describe("fetchAll", () => {
    it("should return deduplicated reviews from both sources", async () => {
      const result = await client.fetchAll("12345")

      // Should have all 3 unique reviews
      expect(result.reviews).toHaveLength(3)
      expect(result.stats.mostRecentCount).toBe(2)
      expect(result.stats.mostHelpfulCount).toBe(1)
      expect(result.stats.uniqueCount).toBe(3)
      expect(result.stats.duplicateCount).toBe(0)
    })

    it("should track duplicates correctly", async () => {
      // Add a duplicate review (same ID, different source)
      const reviewsWithDupe: NormalizedReview[] = [
        ...mockReviews,
        {
          ...mockReview,
          externalId: "review-001", // Same as first review
          source: ReviewSource.MOST_HELPFUL, // Different source
        },
      ]

      client.setMockData(reviewsWithDupe)
      const result = await client.fetchAll("12345")

      expect(result.stats.duplicateCount).toBe(1)
      expect(result.stats.uniqueCount).toBe(3)
    })
  })
})

describe("AppleApiError", () => {
  it("should create error with correct properties", () => {
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

  it("should include retryAfter for rate limit errors", () => {
    const error = new AppleApiError(
      "Rate limited",
      INGESTION_ERROR_CODES.APPLE_RATE_LIMITED,
      429,
      60
    )

    expect(error.retryAfter).toBe(60)
  })
})

describe("NormalizedReview", () => {
  it("should have all required fields", () => {
    expect(mockReview.externalId).toBeDefined()
    expect(mockReview.author).toBeDefined()
    expect(typeof mockReview.rating).toBe("number")
    expect(mockReview.rating).toBeGreaterThanOrEqual(1)
    expect(mockReview.rating).toBeLessThanOrEqual(5)
    expect(mockReview.content).toBeDefined()
    expect(mockReview.publishedAt).toBeInstanceOf(Date)
    expect(Object.values(ReviewSource)).toContain(mockReview.source)
  })
})
