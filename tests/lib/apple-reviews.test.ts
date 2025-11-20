/**
 * Tests for Apple RSS Reviews Fetcher
 *
 * Tests fetchReviewsFromRSS function with various scenarios including
 * pagination, multi-source fetching, retry logic, and error handling.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest"
import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"
import { handlers } from "../mocks/handlers"
import { fetchReviewsFromRSS, parseAppleRSSResponse } from "@/lib/apple/reviews"
import { generateMockRSSFeed } from "../mocks/apple-reviews-rss"

// Set up MSW server for mocking Apple API
const server = setupServer(...handlers)

beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})

describe("fetchReviewsFromRSS", () => {
  describe("Basic functionality", () => {
    it("should fetch reviews from Apple RSS API", async () => {
      const result = await fetchReviewsFromRSS({
        appStoreId: "1570489264",
        limit: 10,
        workspaceId: "workspace-1",
      })

      expect(result.reviews.length).toBeGreaterThan(0)
      expect(result.totalFetched).toBeGreaterThan(0)
      expect(result.sourcesProcessed).toContain("mostRecent")
    })

    it("should fetch from both sources by default", async () => {
      const result = await fetchReviewsFromRSS({
        appStoreId: "1570489264",
        limit: 20,
        workspaceId: "workspace-1",
      })

      expect(result.sourcesProcessed).toContain("mostRecent")
      expect(result.sourcesProcessed).toContain("mostHelpful")
    })

    it("should fetch from single source when specified", async () => {
      const result = await fetchReviewsFromRSS({
        appStoreId: "1570489264",
        sources: ["mostRecent"],
        limit: 10,
        workspaceId: "workspace-1",
      })

      expect(result.sourcesProcessed).toEqual(["mostRecent"])
      expect(result.sourcesProcessed).not.toContain("mostHelpful")
    })

    it("should respect the limit parameter", async () => {
      const result = await fetchReviewsFromRSS({
        appStoreId: "1570489264",
        limit: 5,
        workspaceId: "workspace-1",
      })

      expect(result.reviews.length).toBeLessThanOrEqual(5)
    })

    it("should handle different country codes", async () => {
      const result = await fetchReviewsFromRSS({
        appStoreId: "1570489264",
        country: "gb",
        limit: 10,
        workspaceId: "workspace-1",
      })

      expect(result.reviews.length).toBeGreaterThan(0)
    })
  })

  describe("Pagination", () => {
    it("should fetch multiple pages when needed", async () => {
      const result = await fetchReviewsFromRSS({
        appStoreId: "1570489264",
        limit: 25, // More than one page (10 per page in mock)
        sources: ["mostRecent"],
        workspaceId: "workspace-1",
      })

      expect(result.totalFetched).toBeGreaterThanOrEqual(20)
    })

    it("should stop fetching when limit is reached", async () => {
      const result = await fetchReviewsFromRSS({
        appStoreId: "1570489264",
        limit: 15,
        sources: ["mostRecent"],
        workspaceId: "workspace-1",
      })

      expect(result.reviews.length).toBeLessThanOrEqual(15)
    })

    it("should handle reaching end of available reviews", async () => {
      const result = await fetchReviewsFromRSS({
        appStoreId: "1570489264",
        limit: 1000, // More than available
        sources: ["mostRecent"],
        workspaceId: "workspace-1",
      })

      // Should stop when no more pages available
      expect(result.reviews.length).toBeGreaterThan(0)
    })
  })

  describe("Review structure", () => {
    it("should return properly structured review objects", async () => {
      const result = await fetchReviewsFromRSS({
        appStoreId: "1570489264",
        limit: 5,
        workspaceId: "workspace-1",
      })

      expect(result.reviews.length).toBeGreaterThan(0)

      const review = result.reviews[0]
      expect(review).toHaveProperty("externalReviewId")
      expect(review).toHaveProperty("rating")
      expect(review).toHaveProperty("title")
      expect(review).toHaveProperty("content")
      expect(review).toHaveProperty("author")
      expect(review).toHaveProperty("publishedAt")
      expect(review).toHaveProperty("source")

      // Validate types
      expect(typeof review.externalReviewId).toBe("string")
      expect(typeof review.rating).toBe("number")
      expect(review.rating).toBeGreaterThanOrEqual(1)
      expect(review.rating).toBeLessThanOrEqual(5)
      expect(typeof review.title).toBe("string")
      expect(typeof review.content).toBe("string")
      expect(review.publishedAt).toBeInstanceOf(Date)
    })

    it("should include source information", async () => {
      const result = await fetchReviewsFromRSS({
        appStoreId: "1570489264",
        sources: ["mostRecent"],
        limit: 5,
        workspaceId: "workspace-1",
      })

      result.reviews.forEach((review) => {
        expect(review.source).toBe("APPLE_RSS_MOST_RECENT")
      })
    })
  })

  describe("Deduplication", () => {
    it("should deduplicate reviews within same fetch", async () => {
      const result = await fetchReviewsFromRSS({
        appStoreId: "1570489264",
        limit: 30,
        workspaceId: "workspace-1",
      })

      // Check for unique external review IDs
      const ids = result.reviews.map((r) => r.externalReviewId)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe("Error handling", () => {
    it("should handle app with no reviews", async () => {
      const result = await fetchReviewsFromRSS({
        appStoreId: "99999999999",
        limit: 10,
        workspaceId: "workspace-1",
      })

      expect(result.reviews.length).toBe(0)
      expect(result.totalFetched).toBe(0)
    })

    it("should handle network errors with retry", async () => {
      let attemptCount = 0

      server.use(
        http.get("https://itunes.apple.com/us/rss/customerreviews/*", () => {
          attemptCount++
          if (attemptCount < 2) {
            return HttpResponse.error()
          }
          // Success on second attempt
          return HttpResponse.json(generateMockRSSFeed("1570489264", "mostrecent", 1, 10))
        })
      )

      const result = await fetchReviewsFromRSS({
        appStoreId: "1570489264",
        limit: 10,
        sources: ["mostRecent"],
        workspaceId: "workspace-1",
      })

      expect(attemptCount).toBeGreaterThan(1) // Retry occurred
      expect(result.reviews.length).toBeGreaterThan(0)
    })

    it("should handle rate limit errors", async () => {
      server.use(
        http.get("https://itunes.apple.com/us/rss/customerreviews/*", () => {
          return HttpResponse.json(
            { error: "Rate limit exceeded" },
            { status: 429 }
          )
        })
      )

      const result = await fetchReviewsFromRSS({
        appStoreId: "1570489264",
        limit: 10,
        workspaceId: "workspace-1",
      })

      expect(result.errors).toBeDefined()
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it("should collect partial results when one source fails", async () => {
      server.use(
        http.get("https://itunes.apple.com/us/rss/customerreviews/*/mostrecent/*", () => {
          return HttpResponse.json(generateMockRSSFeed("1570489264", "mostrecent", 1, 10))
        }),
        http.get("https://itunes.apple.com/us/rss/customerreviews/*/mosthelpful/*", () => {
          return HttpResponse.error()
        })
      )

      const result = await fetchReviewsFromRSS({
        appStoreId: "1570489264",
        limit: 20,
        workspaceId: "workspace-1",
      })

      // Should still have partial results
      expect(result.reviews.length).toBeGreaterThan(0)
      expect(result.errors).toBeDefined()
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe("Mock mode", () => {
    const originalEnv = process.env.MOCK_APPLE_API

    afterEach(() => {
      if (originalEnv) {
        process.env.MOCK_APPLE_API = originalEnv
      } else {
        delete process.env.MOCK_APPLE_API
      }
    })

    it("should use mock data when MOCK_APPLE_API is enabled", async () => {
      process.env.MOCK_APPLE_API = "true"

      const result = await fetchReviewsFromRSS({
        appStoreId: "1570489264",
        limit: 10,
        workspaceId: "workspace-1",
      })

      expect(result.reviews.length).toBeGreaterThan(0)
      // Mock reviews should have consistent structure
      expect(result.reviews[0].content).toContain("Mock review")
    })
  })
})

describe("parseAppleRSSResponse", () => {
  it("should parse valid RSS feed", () => {
    const mockFeed = generateMockRSSFeed("1570489264", "mostrecent", 1, 5)
    const reviews = parseAppleRSSResponse(mockFeed, "APPLE_RSS_MOST_RECENT")

    expect(reviews).toHaveLength(5)
    reviews.forEach((review) => {
      expect(review.externalReviewId).toBeDefined()
      expect(review.rating).toBeGreaterThanOrEqual(1)
      expect(review.rating).toBeLessThanOrEqual(5)
    })
  })

  it("should handle feed with no entries", () => {
    const emptyFeed = {
      feed: {
        author: { name: { label: "iTunes Store" }, uri: { label: "http://www.apple.com/itunes/" } },
        link: [],
      },
    }
    const reviews = parseAppleRSSResponse(emptyFeed, "APPLE_RSS_MOST_RECENT")
    expect(reviews).toHaveLength(0)
  })

  it("should skip entries with missing required fields", () => {
    const invalidFeed = {
      feed: {
        author: { name: { label: "iTunes Store" }, uri: { label: "http://www.apple.com/itunes/" } },
        entry: [
          {
            id: "test-1",
            // Missing other required fields
          },
        ],
        link: [],
      },
    }
    const reviews = parseAppleRSSResponse(invalidFeed as any, "APPLE_RSS_MOST_RECENT")
    expect(reviews).toHaveLength(0)
  })
})
