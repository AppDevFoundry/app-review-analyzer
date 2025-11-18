import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  parseAppStoreId,
  isValidAppStoreIdentifier,
  isMockModeEnabled,
  getMockAppIds,
  getMockApp,
  fetchAppStoreMetadata,
  lookupApp,
  AppStoreError,
} from "@/lib/apple"

describe("parseAppStoreId", () => {
  describe("numeric IDs", () => {
    it("should return numeric ID as-is", () => {
      expect(parseAppStoreId("1570489264")).toBe("1570489264")
      expect(parseAppStoreId("355833469")).toBe("355833469")
    })

    it("should handle IDs with leading/trailing whitespace", () => {
      expect(parseAppStoreId("  1570489264  ")).toBe("1570489264")
      expect(parseAppStoreId("\t355833469\n")).toBe("355833469")
    })
  })

  describe("standard App Store URLs", () => {
    it("should extract ID from full URL with country and app name", () => {
      expect(
        parseAppStoreId(
          "https://apps.apple.com/us/app/the-storygraph/id1570489264"
        )
      ).toBe("1570489264")
    })

    it("should extract ID from URLs without app name", () => {
      expect(
        parseAppStoreId("https://apps.apple.com/us/app/id1570489264")
      ).toBe("1570489264")
    })

    it("should extract ID from short URLs", () => {
      expect(parseAppStoreId("https://apps.apple.com/app/id355833469")).toBe(
        "355833469"
      )
    })

    it("should handle different country codes", () => {
      expect(
        parseAppStoreId("https://apps.apple.com/gb/app/libby/id1076402606")
      ).toBe("1076402606")
      expect(
        parseAppStoreId("https://apps.apple.com/de/app/headspace/id493145008")
      ).toBe("493145008")
    })

    it("should handle URLs with query parameters", () => {
      expect(
        parseAppStoreId(
          "https://apps.apple.com/us/app/id1570489264?platform=iphone"
        )
      ).toBe("1570489264")
      expect(
        parseAppStoreId("https://apps.apple.com/us/app/id355833469?mt=8")
      ).toBe("355833469")
      expect(
        parseAppStoreId(
          "https://apps.apple.com/us/app/id1076402606?platform=ipad&mt=8"
        )
      ).toBe("1076402606")
    })

    it("should handle http URLs (non-https)", () => {
      expect(
        parseAppStoreId("http://apps.apple.com/us/app/id1570489264")
      ).toBe("1570489264")
    })
  })

  describe("edge cases", () => {
    it("should extract ID when id is in query string", () => {
      expect(parseAppStoreId("https://example.com/app?id=1570489264")).toBe(
        "1570489264"
      )
    })

    it("should handle URLs with trailing slashes", () => {
      expect(
        parseAppStoreId("https://apps.apple.com/us/app/id1570489264/")
      ).toBe("1570489264")
    })

    it("should handle URLs with hash fragments", () => {
      expect(
        parseAppStoreId("https://apps.apple.com/us/app/id1570489264#reviews")
      ).toBe("1570489264")
    })
  })

  describe("error cases", () => {
    it("should throw AppStoreError for invalid identifiers", () => {
      expect(() => parseAppStoreId("")).toThrow(AppStoreError)
      expect(() => parseAppStoreId("invalid")).toThrow(AppStoreError)
      expect(() => parseAppStoreId("abc123")).toThrow(AppStoreError)
      expect(() => parseAppStoreId("https://example.com")).toThrow(AppStoreError)
    })

    it("should throw with INVALID_ID code", () => {
      try {
        parseAppStoreId("not-a-valid-id")
        expect.fail("Should have thrown")
      } catch (error) {
        expect(error).toBeInstanceOf(AppStoreError)
        expect((error as AppStoreError).code).toBe("INVALID_ID")
      }
    })

    it("should include the invalid identifier in error message", () => {
      try {
        parseAppStoreId("bad-input")
        expect.fail("Should have thrown")
      } catch (error) {
        expect((error as AppStoreError).message).toContain("bad-input")
      }
    })

    it("should reject IDs that are too short", () => {
      // App Store IDs are typically 6+ digits
      expect(() => parseAppStoreId("https://example.com/12345")).toThrow(
        AppStoreError
      )
    })
  })
})

describe("isValidAppStoreIdentifier", () => {
  it("should return true for valid numeric IDs", () => {
    expect(isValidAppStoreIdentifier("1570489264")).toBe(true)
    expect(isValidAppStoreIdentifier("355833469")).toBe(true)
  })

  it("should return true for valid URLs", () => {
    expect(
      isValidAppStoreIdentifier(
        "https://apps.apple.com/us/app/id1570489264"
      )
    ).toBe(true)
    expect(
      isValidAppStoreIdentifier(
        "https://apps.apple.com/us/app/the-storygraph/id1570489264"
      )
    ).toBe(true)
  })

  it("should return false for invalid identifiers", () => {
    expect(isValidAppStoreIdentifier("")).toBe(false)
    expect(isValidAppStoreIdentifier("invalid")).toBe(false)
    expect(isValidAppStoreIdentifier("https://example.com")).toBe(false)
    expect(isValidAppStoreIdentifier("not-an-app")).toBe(false)
  })
})

describe("AppStoreError", () => {
  it("should create error with correct properties", () => {
    const error = new AppStoreError("Test message", "NOT_FOUND")

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("AppStoreError")
    expect(error.message).toBe("Test message")
    expect(error.code).toBe("NOT_FOUND")
  })

  it("should support all error codes", () => {
    const codes = ["NOT_FOUND", "INVALID_ID", "NETWORK_ERROR", "API_ERROR"] as const

    for (const code of codes) {
      const error = new AppStoreError(`Error: ${code}`, code)
      expect(error.code).toBe(code)
    }
  })
})

describe("Mock mode functions", () => {
  const originalEnv = process.env.MOCK_APPLE_API

  beforeEach(() => {
    // Reset env before each test
    delete process.env.MOCK_APPLE_API
  })

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.MOCK_APPLE_API = originalEnv
    } else {
      delete process.env.MOCK_APPLE_API
    }
  })

  describe("isMockModeEnabled", () => {
    it("should return false when MOCK_APPLE_API is not set", () => {
      delete process.env.MOCK_APPLE_API
      expect(isMockModeEnabled()).toBe(false)
    })

    it("should return false when MOCK_APPLE_API is not 'true'", () => {
      process.env.MOCK_APPLE_API = "false"
      expect(isMockModeEnabled()).toBe(false)

      process.env.MOCK_APPLE_API = "1"
      expect(isMockModeEnabled()).toBe(false)

      process.env.MOCK_APPLE_API = "yes"
      expect(isMockModeEnabled()).toBe(false)
    })

    it("should return true when MOCK_APPLE_API is 'true'", () => {
      process.env.MOCK_APPLE_API = "true"
      expect(isMockModeEnabled()).toBe(true)
    })
  })

  describe("getMockAppIds", () => {
    it("should return array of mock app IDs", () => {
      const ids = getMockAppIds()
      expect(Array.isArray(ids)).toBe(true)
      expect(ids.length).toBeGreaterThan(0)
    })

    it("should include known mock app IDs", () => {
      const ids = getMockAppIds()
      expect(ids).toContain("1570489264") // The StoryGraph
      expect(ids).toContain("355833469") // Goodreads
      expect(ids).toContain("1076402606") // Libby
    })
  })

  describe("getMockApp", () => {
    it("should return mock app data for valid mock ID", () => {
      const app = getMockApp("1570489264")

      expect(app).toBeDefined()
      expect(app?.appStoreId).toBe("1570489264")
      expect(app?.name).toBe("The StoryGraph")
      expect(app?.developerName).toBe("The StoryGraph Ltd")
      expect(app?.primaryCategory).toBe("Books")
    })

    it("should return undefined for unknown IDs", () => {
      expect(getMockApp("9999999999")).toBeUndefined()
      expect(getMockApp("invalid")).toBeUndefined()
    })

    it("should include all required fields in mock data", () => {
      const app = getMockApp("355833469")

      expect(app).toBeDefined()
      expect(app?.appStoreId).toBeDefined()
      expect(app?.name).toBeDefined()
      expect(app?.developerName).toBeDefined()
      expect(app?.iconUrl).toBeDefined()
      expect(app?.storeUrl).toBeDefined()
      expect(app?.primaryCategory).toBeDefined()
      expect(app?.country).toBeDefined()
    })
  })
})

describe("fetchAppStoreMetadata", () => {
  const originalMockEnv = process.env.MOCK_APPLE_API
  const originalAllowAnyEnv = process.env.MOCK_APPLE_API_ALLOW_ANY

  beforeEach(() => {
    // Enable mock mode for these tests
    process.env.MOCK_APPLE_API = "true"
    delete process.env.MOCK_APPLE_API_ALLOW_ANY
  })

  afterEach(() => {
    // Restore original env
    if (originalMockEnv !== undefined) {
      process.env.MOCK_APPLE_API = originalMockEnv
    } else {
      delete process.env.MOCK_APPLE_API
    }
    if (originalAllowAnyEnv !== undefined) {
      process.env.MOCK_APPLE_API_ALLOW_ANY = originalAllowAnyEnv
    } else {
      delete process.env.MOCK_APPLE_API_ALLOW_ANY
    }
  })

  describe("mock mode", () => {
    it("should return mock data for known app ID", async () => {
      const metadata = await fetchAppStoreMetadata("1570489264")

      expect(metadata.appStoreId).toBe("1570489264")
      expect(metadata.name).toBe("The StoryGraph")
      expect(metadata.developerName).toBe("The StoryGraph Ltd")
      expect(metadata.primaryCategory).toBe("Books")
    })

    it("should use provided country code", async () => {
      const metadata = await fetchAppStoreMetadata("1570489264", "gb")
      expect(metadata.country).toBe("gb")
    })

    it("should default to US country", async () => {
      const metadata = await fetchAppStoreMetadata("1570489264")
      expect(metadata.country).toBe("us")
    })

    it("should throw NOT_FOUND for unknown app ID in mock mode", async () => {
      await expect(fetchAppStoreMetadata("9999999999")).rejects.toThrow(
        AppStoreError
      )

      try {
        await fetchAppStoreMetadata("9999999999")
        expect.fail("Should have thrown")
      } catch (error) {
        expect((error as AppStoreError).code).toBe("NOT_FOUND")
        expect((error as AppStoreError).message).toContain("9999999999")
      }
    })

    it("should include available mock app IDs in error message", async () => {
      try {
        await fetchAppStoreMetadata("9999999999")
        expect.fail("Should have thrown")
      } catch (error) {
        expect((error as AppStoreError).message).toContain("Available mock apps")
      }
    })

    describe("MOCK_APPLE_API_ALLOW_ANY mode", () => {
      beforeEach(() => {
        process.env.MOCK_APPLE_API_ALLOW_ANY = "true"
      })

      it("should generate fake data for any ID", async () => {
        const metadata = await fetchAppStoreMetadata("9999999999")

        expect(metadata.appStoreId).toBe("9999999999")
        expect(metadata.name).toBe("Test App 9999999999")
        expect(metadata.developerName).toBe("Test Developer")
        expect(metadata.primaryCategory).toBe("Utilities")
      })

      it("should still return real mock data for known IDs", async () => {
        const metadata = await fetchAppStoreMetadata("1570489264")
        expect(metadata.name).toBe("The StoryGraph")
      })
    })
  })

  describe("skipMock option", () => {
    // Mock global fetch for real API test
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn())
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it("should call real API when skipMock is true", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          resultCount: 1,
          results: [
            {
              trackId: 1570489264,
              trackName: "Real App Name",
              artistName: "Real Developer",
              trackViewUrl: "https://apps.apple.com/app/id1570489264",
              primaryGenreName: "Books",
              artworkUrl100: "https://example.com/icon.png",
            },
          ],
        }),
      }
      ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      const metadata = await fetchAppStoreMetadata("1570489264", "us", {
        skipMock: true,
      })

      expect(fetch).toHaveBeenCalled()
      expect(metadata.name).toBe("Real App Name")
    })

    it("should throw NOT_FOUND when API returns no results", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          resultCount: 0,
          results: [],
        }),
      }
      ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      await expect(
        fetchAppStoreMetadata("9999999999", "us", { skipMock: true })
      ).rejects.toThrow(AppStoreError)

      try {
        await fetchAppStoreMetadata("9999999999", "us", { skipMock: true })
      } catch (error) {
        expect((error as AppStoreError).code).toBe("NOT_FOUND")
      }
    })

    it("should throw API_ERROR when response is not ok", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      }
      ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse)

      await expect(
        fetchAppStoreMetadata("1570489264", "us", { skipMock: true })
      ).rejects.toThrow(AppStoreError)

      try {
        await fetchAppStoreMetadata("1570489264", "us", { skipMock: true })
      } catch (error) {
        expect((error as AppStoreError).code).toBe("API_ERROR")
      }
    })

    it("should throw NETWORK_ERROR on fetch failure", async () => {
      ;(fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network failure")
      )

      await expect(
        fetchAppStoreMetadata("1570489264", "us", { skipMock: true })
      ).rejects.toThrow(AppStoreError)

      try {
        await fetchAppStoreMetadata("1570489264", "us", { skipMock: true })
      } catch (error) {
        expect((error as AppStoreError).code).toBe("NETWORK_ERROR")
      }
    })

    it("should throw NETWORK_ERROR on timeout", async () => {
      // Create an abort error
      const abortError = new Error("Aborted")
      abortError.name = "AbortError"
      ;(fetch as ReturnType<typeof vi.fn>).mockRejectedValue(abortError)

      await expect(
        fetchAppStoreMetadata("1570489264", "us", { skipMock: true, timeout: 100 })
      ).rejects.toThrow(AppStoreError)

      try {
        await fetchAppStoreMetadata("1570489264", "us", { skipMock: true })
      } catch (error) {
        expect((error as AppStoreError).code).toBe("NETWORK_ERROR")
        expect((error as AppStoreError).message).toContain("timed out")
      }
    })
  })
})

describe("lookupApp", () => {
  const originalEnv = process.env.MOCK_APPLE_API

  beforeEach(() => {
    process.env.MOCK_APPLE_API = "true"
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MOCK_APPLE_API = originalEnv
    } else {
      delete process.env.MOCK_APPLE_API
    }
  })

  it("should parse URL and fetch metadata in one call", async () => {
    const metadata = await lookupApp(
      "https://apps.apple.com/us/app/the-storygraph/id1570489264"
    )

    expect(metadata.appStoreId).toBe("1570489264")
    expect(metadata.name).toBe("The StoryGraph")
  })

  it("should accept numeric ID directly", async () => {
    const metadata = await lookupApp("355833469")

    expect(metadata.appStoreId).toBe("355833469")
    expect(metadata.name).toBe("Goodreads: Book Reviews")
  })

  it("should throw for invalid identifiers", async () => {
    await expect(lookupApp("invalid-url")).rejects.toThrow(AppStoreError)
  })

  it("should use provided country code", async () => {
    const metadata = await lookupApp("1570489264", "de")
    expect(metadata.country).toBe("de")
  })
})
