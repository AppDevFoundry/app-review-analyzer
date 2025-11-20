/**
 * Integration Tests for Cron API Route
 *
 * Tests the /api/jobs/review-ingestion endpoint including:
 * - Authentication (secret-based)
 * - Health check endpoint
 * - Batch ingestion processing
 *
 * Run with: pnpm test tests/integration/cron-api.test.ts
 */

import { describe, it, expect, beforeEach, afterAll, vi, beforeAll } from "vitest"
import {
  WorkspacePlan,
  WorkspaceRole,
  AppStatus,
  AppPlatform,
} from "@prisma/client"
import { createTestPrismaClient, cleanDatabase } from "../utils/test-db"

// Create test client first
const testPrisma = createTestPrismaClient()

// Mock server-only
vi.mock("server-only", () => ({}))

// Mock lib/db with test prisma
vi.mock("@/lib/db", () => ({
  prisma: testPrisma,
  db: testPrisma,
}))

// Enable mock mode for Apple API
process.env.MOCK_APPLE_API = "true"

// Test secret for cron auth
const TEST_CRON_SECRET = "test-cron-secret-12345"

describe("Cron API Integration", () => {
  let testUser: { id: string; email: string }
  let testWorkspace: { id: string }
  let testApp: { id: string; name: string }

  // Route handlers
  let GET: typeof import("@/app/api/jobs/review-ingestion/route").GET
  let POST: typeof import("@/app/api/jobs/review-ingestion/route").POST

  // Store original env
  const originalCronSecret = process.env.CRON_SECRET

  beforeAll(async () => {
    // Dynamic imports after mocks are set up
    const routeModule = await import("@/app/api/jobs/review-ingestion/route")
    GET = routeModule.GET
    POST = routeModule.POST
  })

  beforeEach(async () => {
    await cleanDatabase(testPrisma)

    // Set test cron secret
    process.env.CRON_SECRET = TEST_CRON_SECRET

    // Create test user
    testUser = await testPrisma.user.create({
      data: {
        email: "cron-test@example.com",
        name: "Cron Test User",
      },
    })

    // Create test workspace
    testWorkspace = await testPrisma.workspace.create({
      data: {
        name: "Cron Test Workspace",
        slug: "cron-test-workspace",
        plan: WorkspacePlan.PRO,
        appLimit: 10,
        analysisLimitPerMonth: 30,
        reviewLimitPerRun: 1000,
        ownerId: testUser.id,
      },
    })

    // Create workspace member
    await testPrisma.workspaceMember.create({
      data: {
        userId: testUser.id,
        workspaceId: testWorkspace.id,
        role: WorkspaceRole.OWNER,
      },
    })

    // Create test app - active and never synced (eligible for cron)
    testApp = await testPrisma.app.create({
      data: {
        workspaceId: testWorkspace.id,
        appStoreId: "1570489264",
        name: "StoryGraph",
        slug: "storygraph-cron-test",
        bundleId: "com.thestorygraph.thestorygraph",
        iconUrl: "https://example.com/icon.png",
        status: AppStatus.ACTIVE,
        platform: AppPlatform.IOS,
        country: "us",
        lastSyncedAt: null, // Never synced - eligible
      },
    })
  })

  afterAll(async () => {
    // Restore original env
    process.env.CRON_SECRET = originalCronSecret
    await cleanDatabase(testPrisma)
    await testPrisma.$disconnect()
  })

  describe("GET /api/jobs/review-ingestion (Health Check)", () => {
    it("should return health status and config", async () => {
      const request = new Request("http://localhost:3000/api/jobs/review-ingestion", {
        method: "GET",
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe("ok")
      expect(data.job).toBe("review-ingestion")
      expect(data.config).toBeDefined()
      expect(data.config.maxAppsPerRun).toBeDefined()
    })

    it("should show eligible apps count", async () => {
      const request = new Request("http://localhost:3000/api/jobs/review-ingestion")
      const response = await GET(request)
      const data = await response.json()

      expect(data.eligibleApps).toBe(1)
      expect(data.nextApps).toHaveLength(1)
      expect(data.nextApps[0].name).toBe("StoryGraph")
    })

    it("should not show paused apps as eligible", async () => {
      await testPrisma.app.update({
        where: { id: testApp.id },
        data: { status: AppStatus.PAUSED },
      })

      const request = new Request("http://localhost:3000/api/jobs/review-ingestion")
      const response = await GET(request)
      const data = await response.json()

      expect(data.eligibleApps).toBe(0)
    })

    it("should not show recently synced apps as eligible", async () => {
      await testPrisma.app.update({
        where: { id: testApp.id },
        data: { lastSyncedAt: new Date() },
      })

      const request = new Request("http://localhost:3000/api/jobs/review-ingestion")
      const response = await GET(request)
      const data = await response.json()

      expect(data.eligibleApps).toBe(0)
    })

    it("should not show deleted apps as eligible", async () => {
      await testPrisma.app.update({
        where: { id: testApp.id },
        data: { deletedAt: new Date() },
      })

      const request = new Request("http://localhost:3000/api/jobs/review-ingestion")
      const response = await GET(request)
      const data = await response.json()

      expect(data.eligibleApps).toBe(0)
    })
  })

  describe("POST /api/jobs/review-ingestion Authentication", () => {
    it("should accept requests with correct Bearer token", async () => {
      const request = new Request("http://localhost:3000/api/jobs/review-ingestion", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TEST_CRON_SECRET}`,
        },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it("should accept requests with correct query parameter", async () => {
      const request = new Request(
        `http://localhost:3000/api/jobs/review-ingestion?secret=${TEST_CRON_SECRET}`,
        { method: "POST" }
      )

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it("should allow requests in development mode without auth when no secret configured", async () => {
      // Temporarily remove CRON_SECRET to test dev mode behavior
      const savedSecret = process.env.CRON_SECRET
      delete process.env.CRON_SECRET

      const request = new Request("http://localhost:3000/api/jobs/review-ingestion", {
        method: "POST",
      })

      const response = await POST(request)

      // Restore secret
      process.env.CRON_SECRET = savedSecret

      // In non-production mode without a configured secret, requests are allowed
      expect(response.status).toBe(200)
    })
  })

  describe("POST /api/jobs/review-ingestion (Run Ingestion)", () => {
    it("should process eligible apps and return results", async () => {
      const request = new Request("http://localhost:3000/api/jobs/review-ingestion", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TEST_CRON_SECRET}`,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.results).toBeDefined()
      expect(data.results.total).toBeGreaterThanOrEqual(0)
      expect(data.startedAt).toBeDefined()
      expect(data.completedAt).toBeDefined()
      expect(data.durationMs).toBeGreaterThanOrEqual(0)
    })

    it("should return empty results when no eligible apps", async () => {
      // Make the app ineligible by syncing it recently
      await testPrisma.app.update({
        where: { id: testApp.id },
        data: { lastSyncedAt: new Date() },
      })

      const request = new Request("http://localhost:3000/api/jobs/review-ingestion", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TEST_CRON_SECRET}`,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.results.total).toBe(0)
      expect(data.message).toContain("No eligible apps")
    })
  })

  describe("Batch Processing", () => {
    it("should list multiple eligible apps", async () => {
      // Create additional test apps
      await testPrisma.app.createMany({
        data: [
          {
            workspaceId: testWorkspace.id,
            appStoreId: "355833469",
            name: "Goodreads",
            slug: "goodreads-cron-test",
            bundleId: "com.goodreads.app",
            iconUrl: "https://example.com/icon2.png",
            status: AppStatus.ACTIVE,
            platform: AppPlatform.IOS,
            country: "us",
          },
          {
            workspaceId: testWorkspace.id,
            appStoreId: "389801252",
            name: "Instagram",
            slug: "instagram-cron-test",
            bundleId: "com.instagram.app",
            iconUrl: "https://example.com/icon3.png",
            status: AppStatus.ACTIVE,
            platform: AppPlatform.IOS,
            country: "us",
          },
        ],
      })

      const request = new Request("http://localhost:3000/api/jobs/review-ingestion")
      const response = await GET(request)
      const data = await response.json()

      expect(data.eligibleApps).toBe(3)
      expect(data.nextApps).toHaveLength(3)
    })
  })
})
