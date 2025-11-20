/**
 * Tests for app server actions
 *
 * Tests createApp, getApps, updateAppStatus, deleteApp, and restoreApp
 * with database integration and auth mocking.
 */

import { describe, it, expect, afterAll, beforeEach, vi } from "vitest"
import { AppStatus, AppPlatform, WorkspacePlan, WorkspaceRole } from "@prisma/client"
import { appleApiLimiter } from "@/lib/rate-limiter"
import { createTestPrismaClient } from "../utils/test-db"

// Mock server-only module
vi.mock("server-only", () => ({}))

// Mock Next.js auth
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

// Mock Next.js cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

// Mock lib/db to use test database
const testPrisma = createTestPrismaClient()
vi.mock("@/lib/db", () => ({
  prisma: testPrisma,
  db: testPrisma, // Some files import as 'db' instead of 'prisma'
}))

// Import actions after mocks are set up
const {
  createApp,
  getApps,
  updateAppStatus,
  deleteApp,
  restoreApp,
} = await import("@/app/actions/apps")

// Enable mock mode for Apple API
process.env.MOCK_APPLE_API = "true"

// Helper to clean database
async function cleanDatabase() {
  await testPrisma.reviewInsightLink.deleteMany()
  await testPrisma.reviewSnapshotInsight.deleteMany()
  await testPrisma.positiveAspect.deleteMany()
  await testPrisma.monthlyTrend.deleteMany()
  await testPrisma.ratingDistribution.deleteMany()
  await testPrisma.lLMInsight.deleteMany() // Note: LLMInsight model becomes lLMInsight
  await testPrisma.reviewSnapshot.deleteMany()
  await testPrisma.review.deleteMany()
  await testPrisma.app.deleteMany()
  await testPrisma.workspaceMember.deleteMany()
  await testPrisma.workspace.deleteMany()
  await testPrisma.user.deleteMany()
}

describe("App Server Actions", () => {
  beforeEach(async () => {
    await cleanDatabase()
    appleApiLimiter.resetAll()
  })

  afterAll(async () => {
    await cleanDatabase()
    await testPrisma.$disconnect()
  })

  describe("createApp", () => {
    it("should successfully create an app with valid input", async () => {
      // Setup
      const user = await testPrisma.user.create({
        data: {
          email: "test@example.com",
          name: "Test User",
        },
      })

      const workspace = await testPrisma.workspace.create({
        data: {
          name: "Test Workspace",
          slug: "test-workspace",
          plan: WorkspacePlan.PRO,
          appLimit: 10,
          analysisLimitPerMonth: 30,
          reviewLimitPerRun: 1000,
          owner: { connect: { id: user.id } },
        },
      })

      await testPrisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
        },
      })

      const { auth } = await import("@/auth")
      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email },
      } as any)

      // Execute
      const result = await createApp({
        identifier: "1570489264",
        nickname: "My StoryGraph",
        country: "us",
      })

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.app).toMatchObject({
          workspaceId: workspace.id,
          appStoreId: "1570489264",
          name: "StoryGraph",
          nickname: "My StoryGraph",
          status: AppStatus.ACTIVE,
        })
      }

      const dbApp = await testPrisma.app.findFirst({
        where: { appStoreId: "1570489264" },
      })
      expect(dbApp).not.toBeNull()
      expect(dbApp?.nickname).toBe("My StoryGraph")
    })

    it("should fail when user is not authenticated", async () => {
      const { auth } = await import("@/auth")
      vi.mocked(auth).mockResolvedValue(null)

      const result = await createApp({
        identifier: "1570489264",
        country: "us",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("UNAUTHORIZED")
      }
    })

    it("should fail when plan limit is exceeded", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "test@example.com",
          name: "Test User",
        },
      })

      const workspace = await testPrisma.workspace.create({
        data: {
          name: "Test Workspace",
          slug: "test-workspace",
          plan: WorkspacePlan.STARTER,
          appLimit: 1,
          analysisLimitPerMonth: 4,
          reviewLimitPerRun: 100,
          owner: { connect: { id: user.id } },
        },
      })

      await testPrisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
        },
      })

      // Create one app (at limit)
      await testPrisma.app.create({
        data: {
          workspaceId: workspace.id,
          appStoreId: "999999999",
          name: "Existing App",
          slug: "existing-app",
          bundleId: "com.existing.app",
          iconUrl: "https://example.com/icon.png",
          storeUrl: "https://apps.apple.com/app/id999999999",
          status: AppStatus.ACTIVE,
          platform: AppPlatform.IOS,
          country: "us",
        },
      })

      const { auth } = await import("@/auth")
      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email },
      } as any)

      // Try to add second app
      const result = await createApp({
        identifier: "1570489264",
        country: "us",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("PLAN_LIMIT_EXCEEDED")
      }
    })

    it("should fail with invalid identifier", async () => {
      const user = await testPrisma.user.create({
        data: { email: "test@example.com", name: "Test User" },
      })

      const workspace = await testPrisma.workspace.create({
        data: {
          name: "Test Workspace",
          slug: "test-workspace",
          plan: WorkspacePlan.PRO,
          appLimit: 10,
          analysisLimitPerMonth: 30,
          reviewLimitPerRun: 1000,
          owner: { connect: { id: user.id } },
        },
      })

      await testPrisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
        },
      })

      const { auth } = await import("@/auth")
      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email },
      } as any)

      const result = await createApp({
        identifier: "not-a-valid-id",
        country: "us",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("INVALID_IDENTIFIER")
      }
    })
  })

  describe("getApps", () => {
    it("should return all non-deleted apps", async () => {
      const user = await testPrisma.user.create({
        data: { email: "test@example.com", name: "Test User" },
      })

      const workspace = await testPrisma.workspace.create({
        data: {
          name: "Test Workspace",
          slug: "test-workspace",
          plan: WorkspacePlan.PRO,
          appLimit: 10,
          analysisLimitPerMonth: 30,
          reviewLimitPerRun: 1000,
          owner: { connect: { id: user.id } },
        },
      })

      await testPrisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
        },
      })

      // Create apps
      await testPrisma.app.createMany({
        data: [
          {
            workspaceId: workspace.id,
            appStoreId: "1570489264",
            name: "StoryGraph",
            slug: "storygraph",
            bundleId: "com.storygraph.app",
            iconUrl: "https://example.com/icon1.png",
            storeUrl: "https://apps.apple.com/app/id1570489264",
            status: AppStatus.ACTIVE,
            platform: AppPlatform.IOS,
            country: "us",
          },
          {
            workspaceId: workspace.id,
            appStoreId: "355833469",
            name: "Goodreads",
            slug: "goodreads",
            bundleId: "com.goodreads.app",
            iconUrl: "https://example.com/icon2.png",
            storeUrl: "https://apps.apple.com/app/id355833469",
            status: AppStatus.PAUSED,
            platform: AppPlatform.IOS,
            country: "us",
          },
          {
            workspaceId: workspace.id,
            appStoreId: "999999999",
            name: "Deleted App",
            slug: "deleted-app",
            bundleId: "com.deleted.app",
            iconUrl: "https://example.com/icon3.png",
            storeUrl: "https://apps.apple.com/app/id999999999",
            status: AppStatus.ACTIVE,
            platform: AppPlatform.IOS,
            country: "us",
            deletedAt: new Date(),
          },
        ],
      })

      const { auth } = await import("@/auth")
      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email },
      } as any)

      const result = await getApps(false)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(2)
        expect(result.data.map((a: any) => a.name)).toContain("StoryGraph")
        expect(result.data.map((a: any) => a.name)).toContain("Goodreads")
        expect(result.data.map((a: any) => a.name)).not.toContain("Deleted App")
      }
    })
  })

  describe("updateAppStatus", () => {
    it("should successfully update app status", async () => {
      const user = await testPrisma.user.create({
        data: { email: "test@example.com", name: "Test User" },
      })

      const workspace = await testPrisma.workspace.create({
        data: {
          name: "Test Workspace",
          slug: "test-workspace",
          plan: WorkspacePlan.PRO,
          appLimit: 10,
          analysisLimitPerMonth: 30,
          reviewLimitPerRun: 1000,
          owner: { connect: { id: user.id } },
        },
      })

      await testPrisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
        },
      })

      const app = await testPrisma.app.create({
        data: {
          workspaceId: workspace.id,
          appStoreId: "1570489264",
          name: "StoryGraph",
          slug: "storygraph",
          bundleId: "com.storygraph.app",
          iconUrl: "https://example.com/icon.png",
          storeUrl: "https://apps.apple.com/app/id1570489264",
          status: AppStatus.ACTIVE,
          platform: AppPlatform.IOS,
          country: "us",
        },
      })

      const { auth } = await import("@/auth")
      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email },
      } as any)

      const result = await updateAppStatus({
        appId: app.id,
        status: AppStatus.PAUSED,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe(AppStatus.PAUSED)
      }

      const updatedApp = await testPrisma.app.findUnique({
        where: { id: app.id },
      })
      expect(updatedApp?.status).toBe(AppStatus.PAUSED)
    })
  })

  describe("deleteApp", () => {
    it("should soft delete by default", async () => {
      const user = await testPrisma.user.create({
        data: { email: "test@example.com", name: "Test User" },
      })

      const workspace = await testPrisma.workspace.create({
        data: {
          name: "Test Workspace",
          slug: "test-workspace",
          plan: WorkspacePlan.PRO,
          appLimit: 10,
          analysisLimitPerMonth: 30,
          reviewLimitPerRun: 1000,
          owner: { connect: { id: user.id } },
        },
      })

      await testPrisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
        },
      })

      const app = await testPrisma.app.create({
        data: {
          workspaceId: workspace.id,
          appStoreId: "1570489264",
          name: "StoryGraph",
          slug: "storygraph",
          bundleId: "com.storygraph.app",
          iconUrl: "https://example.com/icon.png",
          storeUrl: "https://apps.apple.com/app/id1570489264",
          status: AppStatus.ACTIVE,
          platform: AppPlatform.IOS,
          country: "us",
        },
      })

      const { auth } = await import("@/auth")
      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email },
      } as any)

      const result = await deleteApp({
        appId: app.id,
        hardDelete: false,
      })

      expect(result.success).toBe(true)

      const deletedApp = await testPrisma.app.findUnique({
        where: { id: app.id },
      })
      expect(deletedApp).not.toBeNull()
      expect(deletedApp?.deletedAt).not.toBeNull()
    })

    it("should hard delete when requested", async () => {
      const user = await testPrisma.user.create({
        data: { email: "test@example.com", name: "Test User" },
      })

      const workspace = await testPrisma.workspace.create({
        data: {
          name: "Test Workspace",
          slug: "test-workspace",
          plan: WorkspacePlan.PRO,
          appLimit: 10,
          analysisLimitPerMonth: 30,
          reviewLimitPerRun: 1000,
          owner: { connect: { id: user.id } },
        },
      })

      await testPrisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
        },
      })

      const app = await testPrisma.app.create({
        data: {
          workspaceId: workspace.id,
          appStoreId: "1570489264",
          name: "StoryGraph",
          slug: "storygraph",
          bundleId: "com.storygraph.app",
          iconUrl: "https://example.com/icon.png",
          storeUrl: "https://apps.apple.com/app/id1570489264",
          status: AppStatus.ACTIVE,
          platform: AppPlatform.IOS,
          country: "us",
        },
      })

      const { auth } = await import("@/auth")
      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email },
      } as any)

      const result = await deleteApp({
        appId: app.id,
        hardDelete: true,
      })

      expect(result.success).toBe(true)

      const deletedApp = await testPrisma.app.findUnique({
        where: { id: app.id },
      })
      expect(deletedApp).toBeNull()
    })
  })

  describe("restoreApp", () => {
    it("should restore a soft-deleted app", async () => {
      const user = await testPrisma.user.create({
        data: { email: "test@example.com", name: "Test User" },
      })

      const workspace = await testPrisma.workspace.create({
        data: {
          name: "Test Workspace",
          slug: "test-workspace",
          plan: WorkspacePlan.PRO,
          appLimit: 10,
          analysisLimitPerMonth: 30,
          reviewLimitPerRun: 1000,
          owner: { connect: { id: user.id } },
        },
      })

      await testPrisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
        },
      })

      const app = await testPrisma.app.create({
        data: {
          workspaceId: workspace.id,
          appStoreId: "1570489264",
          name: "StoryGraph",
          slug: "storygraph",
          bundleId: "com.storygraph.app",
          iconUrl: "https://example.com/icon.png",
          storeUrl: "https://apps.apple.com/app/id1570489264",
          status: AppStatus.ACTIVE,
          platform: AppPlatform.IOS,
          country: "us",
          deletedAt: new Date(),
        },
      })

      const { auth } = await import("@/auth")
      vi.mocked(auth).mockResolvedValue({
        user: { id: user.id, email: user.email },
      } as any)

      const result = await restoreApp({
        appId: app.id,
      })

      expect(result.success).toBe(true)

      const restoredApp = await testPrisma.app.findUnique({
        where: { id: app.id },
      })
      expect(restoredApp?.deletedAt).toBeNull()
    })
  })
})
