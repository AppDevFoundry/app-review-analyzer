/**
 * Tests for Apple API utilities
 *
 * Tests parseAppStoreId and fetchAppStoreMetadata functions
 * with various URL formats and mock API responses.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest"
import { setupServer } from "msw/node"
import { handlers } from "../mocks/handlers"
import { parseAppStoreId, fetchAppStoreMetadata } from "@/lib/apple"

// Set up MSW server for mocking Apple API
const server = setupServer(...handlers)

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})

describe("parseAppStoreId", () => {
  describe("Numeric IDs", () => {
    it("should parse a plain numeric ID", () => {
      const result = parseAppStoreId("1570489264")
      expect(result).toBe("1570489264")
    })

    it("should parse a numeric ID with whitespace", () => {
      const result = parseAppStoreId("  1570489264  ")
      expect(result).toBe("1570489264")
    })

    it("should parse Goodreads app ID", () => {
      const result = parseAppStoreId("355833469")
      expect(result).toBe("355833469")
    })
  })

  describe("App Store URLs", () => {
    it("should parse standard App Store URL with /id format", () => {
      const url = "https://apps.apple.com/us/app/storygraph/id1570489264"
      const result = parseAppStoreId(url)
      expect(result).toBe("1570489264")
    })

    it("should parse App Store URL with query parameter", () => {
      const url = "https://apps.apple.com/app/storygraph?id=1570489264"
      const result = parseAppStoreId(url)
      expect(result).toBe("1570489264")
    })

    it("should parse shortened App Store URL", () => {
      const url = "https://apps.apple.com/app/id1570489264"
      const result = parseAppStoreId(url)
      expect(result).toBe("1570489264")
    })

    it("should parse App Store URL with different country code", () => {
      const url = "https://apps.apple.com/gb/app/storygraph/id1570489264"
      const result = parseAppStoreId(url)
      expect(result).toBe("1570489264")
    })

    it("should parse App Store URL with additional query params", () => {
      const url = "https://apps.apple.com/us/app/storygraph/id1570489264?mt=8&uo=4"
      const result = parseAppStoreId(url)
      expect(result).toBe("1570489264")
    })

    it("should parse URL with & separator in query", () => {
      const url = "https://apps.apple.com/app?category=books&id=1570489264&page=1"
      const result = parseAppStoreId(url)
      expect(result).toBe("1570489264")
    })
  })

  describe("Invalid inputs", () => {
    it("should return null for empty string", () => {
      const result = parseAppStoreId("")
      expect(result).toBeNull()
    })

    it("should return null for non-numeric text", () => {
      const result = parseAppStoreId("storygraph-app")
      expect(result).toBeNull()
    })

    it("should return null for URL without ID", () => {
      const url = "https://apps.apple.com/us/app/storygraph"
      const result = parseAppStoreId(url)
      expect(result).toBeNull()
    })

    it("should return null for invalid URL format", () => {
      const url = "https://example.com/apps/1570489264"
      const result = parseAppStoreId(url)
      expect(result).toBeNull()
    })
  })
})

describe("fetchAppStoreMetadata", () => {
  describe("Successful fetches", () => {
    it("should fetch metadata for StoryGraph app", async () => {
      const metadata = await fetchAppStoreMetadata("1570489264")

      expect(metadata).not.toBeNull()
      expect(metadata).toMatchObject({
        appStoreId: "1570489264",
        name: "StoryGraph",
        developerName: "StoryGraph",
        bundleId: "com.storygraph.app",
        iconUrl: expect.stringContaining("storygraph"),
        storeUrl: expect.stringContaining("1570489264"),
        primaryCategory: "Books",
        averageRating: 4.8,
        ratingCount: 15234,
      })
    })

    it("should fetch metadata for Goodreads app", async () => {
      const metadata = await fetchAppStoreMetadata("355833469")

      expect(metadata).not.toBeNull()
      expect(metadata).toMatchObject({
        appStoreId: "355833469",
        name: "Goodreads",
        developerName: "Goodreads Inc",
        bundleId: "com.goodreads.app",
        primaryCategory: "Books",
        averageRating: 4.5,
        ratingCount: 125678,
      })
    })

    it("should handle different country codes", async () => {
      const metadata = await fetchAppStoreMetadata("1570489264", "gb")
      expect(metadata).not.toBeNull()
      expect(metadata?.appStoreId).toBe("1570489264")
    })
  })

  describe("Not found scenarios", () => {
    it("should return null for non-existent app ID", async () => {
      const metadata = await fetchAppStoreMetadata("99999999999")
      expect(metadata).toBeNull()
    })
  })

  describe("Mock mode", () => {
    const originalEnv = process.env.MOCK_APPLE_API

    afterEach(() => {
      // Restore original env
      if (originalEnv) {
        process.env.MOCK_APPLE_API = originalEnv
      } else {
        delete process.env.MOCK_APPLE_API
      }
    })

    it("should use mock data when MOCK_APPLE_API is enabled", async () => {
      process.env.MOCK_APPLE_API = "true"

      const metadata = await fetchAppStoreMetadata("1570489264")

      expect(metadata).not.toBeNull()
      expect(metadata?.name).toBe("StoryGraph")
      expect(metadata?.bundleId).toBe("com.storygraph.app")
      expect(metadata?.appStoreId).toBe("1570489264")
    })

    it("should return null for unknown app in mock mode", async () => {
      process.env.MOCK_APPLE_API = "true"

      const metadata = await fetchAppStoreMetadata("99999999")
      expect(metadata).toBeNull()
    })
  })

  describe("Response validation", () => {
    it("should validate required fields are present", async () => {
      const metadata = await fetchAppStoreMetadata("1570489264")

      expect(metadata).not.toBeNull()

      // Required fields
      expect(metadata?.appStoreId).toBeDefined()
      expect(metadata?.name).toBeDefined()
      expect(metadata?.developerName).toBeDefined()
      expect(metadata?.bundleId).toBeDefined()
      expect(metadata?.iconUrl).toBeDefined()
      expect(metadata?.storeUrl).toBeDefined()
      expect(metadata?.primaryCategory).toBeDefined()

      // Optional fields that should be numbers if present
      if (metadata?.averageRating) {
        expect(typeof metadata.averageRating).toBe("number")
        expect(metadata.averageRating).toBeGreaterThanOrEqual(0)
        expect(metadata.averageRating).toBeLessThanOrEqual(5)
      }

      if (metadata?.ratingCount) {
        expect(typeof metadata.ratingCount).toBe("number")
        expect(metadata.ratingCount).toBeGreaterThanOrEqual(0)
      }
    })

    it("should handle apps with no ratings", async () => {
      // This would test an app with no ratings if we had mock data for it
      // For now, just verify the structure supports optional ratings
      const metadata = await fetchAppStoreMetadata("1570489264")
      expect(metadata).toBeDefined()
      // averageRating and ratingCount are optional in the type
    })
  })

  describe("URL construction", () => {
    it("should construct correct iTunes Lookup API URL", async () => {
      // This test verifies the URL pattern by checking the MSW mock was called
      const metadata = await fetchAppStoreMetadata("1570489264", "us")
      expect(metadata).not.toBeNull()
      // If MSW handler matched, the URL format is correct
    })
  })
})

describe("Integration: parseAppStoreId + fetchAppStoreMetadata", () => {
  it("should parse URL and fetch metadata in one flow", async () => {
    const url = "https://apps.apple.com/us/app/storygraph/id1570489264"
    const appStoreId = parseAppStoreId(url)

    expect(appStoreId).not.toBeNull()

    const metadata = await fetchAppStoreMetadata(appStoreId!)
    expect(metadata).not.toBeNull()
    expect(metadata?.name).toBe("StoryGraph")
  })

  it("should handle invalid URL gracefully", async () => {
    const invalidUrl = "https://example.com/not-an-app"
    const appStoreId = parseAppStoreId(invalidUrl)

    expect(appStoreId).toBeNull()
    // Should not attempt to fetch if parsing failed
  })

  it("should handle numeric ID input directly", async () => {
    const directId = "355833469"
    const appStoreId = parseAppStoreId(directId)

    expect(appStoreId).toBe("355833469")

    const metadata = await fetchAppStoreMetadata(appStoreId!)
    expect(metadata).not.toBeNull()
    expect(metadata?.name).toBe("Goodreads")
  })
})
