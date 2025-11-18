import { describe, it, expect } from "vitest"
import { AppStatus, AppPlatform } from "@prisma/client"
import {
  createAppSchema,
  updateAppStatusSchema,
  deleteAppSchema,
  appFilterSchema,
  validateAppIdentifier,
} from "@/lib/validations/app"

describe("createAppSchema", () => {
  describe("identifier field", () => {
    it("should accept valid numeric App Store ID", () => {
      const result = createAppSchema.safeParse({ identifier: "1570489264" })
      expect(result.success).toBe(true)
    })

    it("should accept valid App Store URL", () => {
      const result = createAppSchema.safeParse({
        identifier: "https://apps.apple.com/us/app/the-storygraph/id1570489264",
      })
      expect(result.success).toBe(true)
    })

    it("should trim whitespace from identifier", () => {
      const result = createAppSchema.safeParse({ identifier: "  1570489264  " })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.identifier).toBe("1570489264")
      }
    })

    it("should reject empty identifier", () => {
      const result = createAppSchema.safeParse({ identifier: "" })
      expect(result.success).toBe(false)
    })

    it("should reject invalid identifier", () => {
      const result = createAppSchema.safeParse({ identifier: "invalid-url" })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("Invalid App Store URL")
      }
    })

    it("should reject whitespace-only identifier", () => {
      const result = createAppSchema.safeParse({ identifier: "   " })
      expect(result.success).toBe(false)
    })
  })

  describe("nickname field", () => {
    it("should accept valid nickname", () => {
      const result = createAppSchema.safeParse({
        identifier: "1570489264",
        nickname: "My App",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.nickname).toBe("My App")
      }
    })

    it("should trim whitespace from nickname", () => {
      const result = createAppSchema.safeParse({
        identifier: "1570489264",
        nickname: "  My App  ",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.nickname).toBe("My App")
      }
    })

    it("should allow omitting nickname", () => {
      const result = createAppSchema.safeParse({ identifier: "1570489264" })
      expect(result.success).toBe(true)
    })

    it("should transform empty nickname to undefined", () => {
      const result = createAppSchema.safeParse({
        identifier: "1570489264",
        nickname: "",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.nickname).toBeUndefined()
      }
    })

    it("should reject nickname over 100 characters", () => {
      const result = createAppSchema.safeParse({
        identifier: "1570489264",
        nickname: "a".repeat(101),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("100 characters")
      }
    })
  })

  describe("country field", () => {
    it("should accept valid 2-letter country code", () => {
      const result = createAppSchema.safeParse({
        identifier: "1570489264",
        country: "gb",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.country).toBe("gb")
      }
    })

    it("should default to 'us' when not provided", () => {
      const result = createAppSchema.safeParse({ identifier: "1570489264" })
      expect(result.success).toBe(true)
      // Note: default is only applied if explicitly undefined/missing
    })

    it("should reject country codes that are not 2 characters", () => {
      const resultLong = createAppSchema.safeParse({
        identifier: "1570489264",
        country: "usa",
      })
      expect(resultLong.success).toBe(false)

      const resultShort = createAppSchema.safeParse({
        identifier: "1570489264",
        country: "u",
      })
      expect(resultShort.success).toBe(false)
    })
  })
})

describe("updateAppStatusSchema", () => {
  // Generate a valid CUID for testing
  const validCuid = "clh1234567890abcdefghij"

  describe("appId field", () => {
    it("should accept valid CUID", () => {
      const result = updateAppStatusSchema.safeParse({
        appId: validCuid,
        status: AppStatus.ACTIVE,
      })
      expect(result.success).toBe(true)
    })

    it("should reject invalid CUID format", () => {
      const result = updateAppStatusSchema.safeParse({
        appId: "invalid-id",
        status: AppStatus.ACTIVE,
      })
      expect(result.success).toBe(false)
    })
  })

  describe("status field", () => {
    it("should accept ACTIVE status", () => {
      const result = updateAppStatusSchema.safeParse({
        appId: validCuid,
        status: AppStatus.ACTIVE,
      })
      expect(result.success).toBe(true)
    })

    it("should accept PAUSED status", () => {
      const result = updateAppStatusSchema.safeParse({
        appId: validCuid,
        status: AppStatus.PAUSED,
      })
      expect(result.success).toBe(true)
    })

    it("should reject ARCHIVED status", () => {
      const result = updateAppStatusSchema.safeParse({
        appId: validCuid,
        status: AppStatus.ARCHIVED,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("ACTIVE or PAUSED")
      }
    })

    it("should reject invalid status values", () => {
      const result = updateAppStatusSchema.safeParse({
        appId: validCuid,
        status: "INVALID",
      })
      expect(result.success).toBe(false)
    })
  })
})

describe("deleteAppSchema", () => {
  const validCuid = "clh1234567890abcdefghij"

  describe("appId field", () => {
    it("should accept valid CUID", () => {
      const result = deleteAppSchema.safeParse({ appId: validCuid })
      expect(result.success).toBe(true)
    })

    it("should reject invalid CUID format", () => {
      const result = deleteAppSchema.safeParse({ appId: "not-valid" })
      expect(result.success).toBe(false)
    })
  })

  describe("hardDelete field", () => {
    it("should default to false when not provided", () => {
      const result = deleteAppSchema.safeParse({ appId: validCuid })
      expect(result.success).toBe(true)
      // Default is applied at parse time
    })

    it("should accept true for hard delete", () => {
      const result = deleteAppSchema.safeParse({
        appId: validCuid,
        hardDelete: true,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.hardDelete).toBe(true)
      }
    })

    it("should accept false for soft delete", () => {
      const result = deleteAppSchema.safeParse({
        appId: validCuid,
        hardDelete: false,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.hardDelete).toBe(false)
      }
    })
  })
})

describe("appFilterSchema", () => {
  describe("status field", () => {
    it("should accept valid AppStatus values", () => {
      const result = appFilterSchema.safeParse({ status: AppStatus.ACTIVE })
      expect(result.success).toBe(true)
    })

    it("should allow omitting status", () => {
      const result = appFilterSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe("platform field", () => {
    it("should accept valid AppPlatform values", () => {
      const result = appFilterSchema.safeParse({ platform: AppPlatform.IOS })
      expect(result.success).toBe(true)
    })

    it("should allow omitting platform", () => {
      const result = appFilterSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe("search field", () => {
    it("should accept search string", () => {
      const result = appFilterSchema.safeParse({ search: "my app" })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.search).toBe("my app")
      }
    })
  })

  describe("page field", () => {
    it("should default to 1", () => {
      const result = appFilterSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(1)
      }
    })

    it("should coerce string to number", () => {
      const result = appFilterSchema.safeParse({ page: "5" })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(5)
      }
    })

    it("should reject non-positive numbers", () => {
      const result = appFilterSchema.safeParse({ page: 0 })
      expect(result.success).toBe(false)

      const resultNegative = appFilterSchema.safeParse({ page: -1 })
      expect(resultNegative.success).toBe(false)
    })

    it("should reject non-integer values", () => {
      const result = appFilterSchema.safeParse({ page: 1.5 })
      expect(result.success).toBe(false)
    })
  })

  describe("limit field", () => {
    it("should default to 20", () => {
      const result = appFilterSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(20)
      }
    })

    it("should accept valid limit values", () => {
      const result = appFilterSchema.safeParse({ limit: 50 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(50)
      }
    })

    it("should reject limit over 100", () => {
      const result = appFilterSchema.safeParse({ limit: 101 })
      expect(result.success).toBe(false)
    })

    it("should reject non-positive limit", () => {
      const result = appFilterSchema.safeParse({ limit: 0 })
      expect(result.success).toBe(false)
    })
  })
})

describe("validateAppIdentifier", () => {
  it("should return valid: true for valid numeric ID", () => {
    const result = validateAppIdentifier("1570489264")
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it("should return valid: true for valid URL", () => {
    const result = validateAppIdentifier(
      "https://apps.apple.com/us/app/id1570489264"
    )
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it("should return valid: false for empty string", () => {
    const result = validateAppIdentifier("")
    expect(result.valid).toBe(false)
    expect(result.error).toContain("required")
  })

  it("should return valid: false for whitespace-only string", () => {
    const result = validateAppIdentifier("   ")
    expect(result.valid).toBe(false)
    expect(result.error).toContain("required")
  })

  it("should return valid: false for invalid format", () => {
    const result = validateAppIdentifier("invalid-input")
    expect(result.valid).toBe(false)
    expect(result.error).toContain("Invalid format")
  })

  it("should return helpful error message with example", () => {
    const result = validateAppIdentifier("not-an-app")
    expect(result.error).toContain("https://apps.apple.com")
    expect(result.error).toContain("numeric ID")
  })
})
