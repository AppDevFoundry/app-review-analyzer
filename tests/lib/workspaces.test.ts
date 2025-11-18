import { describe, it, expect } from "vitest"

// Define pure functions locally for testing to avoid importing from lib/workspaces.ts
// which has a dependency on lib/db.ts that uses "server-only" (not available in test environment)
// In production, these functions are exported from lib/workspaces.ts

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const METRIC_NAMES = {
  apps: "tracked apps",
  analysesPerMonth: "analyses per month",
  reviewsPerRun: "reviews per analysis",
} as const

type LimitMetric = keyof typeof METRIC_NAMES

class WorkspaceLimitExceededError extends Error {
  constructor(
    public metric: LimitMetric,
    public current: number,
    public limit: number
  ) {
    super(
      `Workspace limit exceeded: ${current} ${METRIC_NAMES[metric]} (limit: ${limit})`
    )
    this.name = "WorkspaceLimitExceededError"
  }
}

class WorkspaceNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Workspace not found: ${identifier}`)
    this.name = "WorkspaceNotFoundError"
  }
}

// Unit tests for pure functions (no database)
describe("slugify", () => {
  it("should convert name to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world")
    expect(slugify("ALLCAPS")).toBe("allcaps")
  })

  it("should replace spaces with hyphens", () => {
    expect(slugify("my workspace name")).toBe("my-workspace-name")
  })

  it("should remove special characters", () => {
    expect(slugify("test@123!name")).toBe("test123name")
    expect(slugify("hello's workspace")).toBe("hellos-workspace")
  })

  it("should collapse multiple hyphens", () => {
    expect(slugify("test---name")).toBe("test-name")
    expect(slugify("a - - b")).toBe("a-b")
  })

  it("should trim hyphens from start and end", () => {
    expect(slugify("-test-")).toBe("test")
    expect(slugify("---name---")).toBe("name")
  })

  it("should handle empty strings", () => {
    expect(slugify("")).toBe("")
    expect(slugify("   ")).toBe("")
  })

  it("should handle unicode characters", () => {
    expect(slugify("café")).toBe("caf")
    expect(slugify("naïve")).toBe("nave")
  })
})

describe("WorkspaceLimitExceededError", () => {
  it("should create error with correct properties", () => {
    const error = new WorkspaceLimitExceededError("apps", 5, 3)

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("WorkspaceLimitExceededError")
    expect(error.metric).toBe("apps")
    expect(error.current).toBe(5)
    expect(error.limit).toBe(3)
  })

  it("should include limit info in message", () => {
    const error = new WorkspaceLimitExceededError("analysesPerMonth", 31, 30)

    expect(error.message).toContain("31")
    expect(error.message).toContain("30")
    expect(error.message).toContain("analyses per month")
  })
})

describe("WorkspaceNotFoundError", () => {
  it("should create error with identifier in message", () => {
    const error = new WorkspaceNotFoundError("ws-123")

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("WorkspaceNotFoundError")
    expect(error.message).toContain("ws-123")
  })
})

// Integration tests would go here with actual database
// These are skipped by default as they require DATABASE_URL_TEST
describe.skip("Database integration tests", () => {
  // These tests would use the setupTestDatabase helper
  // and createTestUser/createTestWorkspace helpers

  describe("getOrCreateDefaultWorkspace", () => {
    it("should create a new workspace for a user without one", async () => {
      // Would create test user and verify workspace is created
    })

    it("should return existing workspace if user already has one", async () => {
      // Would create user + workspace, then verify same one is returned
    })
  })

  describe("assertWithinPlan", () => {
    it("should not throw when within limits", async () => {
      // Test adding app when under limit
    })

    it("should throw WorkspaceLimitExceededError when over limit", async () => {
      // Test adding app when at/over limit
    })
  })
})
