"use server"

/**
 * Server actions for app management
 *
 * Handles CRUD operations for iOS apps with:
 * - Apple App Store metadata fetching
 * - Plan limit enforcement
 * - Rate limiting
 * - Soft delete support
 */

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { AppStatus } from "@prisma/client"
import {
  createAppSchema,
  updateAppStatusSchema,
  deleteAppSchema,
  restoreAppSchema,
  type CreateAppInput,
  type UpdateAppStatusInput,
  type DeleteAppInput,
  type RestoreAppInput,
} from "@/lib/validations/app"
import {
  parseAppStoreId,
  fetchAppStoreMetadata,
  type AppStoreMetadata,
} from "@/lib/apple"
import { canCallAppleApi, getAppleApiLimitInfo } from "@/lib/rate-limiter"
import { assertWithinPlanLimit, PlanLimitError } from "@/lib/workspaces"
import {
  canAddApp,
  canPauseApp,
  canDeleteApp,
  canRestoreApp,
  PermissionError,
} from "@/lib/permissions"

/**
 * Standard action result type
 */
type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

/**
 * Create a new app for tracking
 *
 * Steps:
 * 1. Validate input
 * 2. Check plan limits
 * 3. Parse App Store ID
 * 4. Check rate limit
 * 5. Fetch metadata from Apple API
 * 6. Check for duplicates
 * 7. Create app record
 *
 * @returns Created app data or error
 */
export async function createApp(
  input: CreateAppInput
): Promise<ActionResult<{ app: any; metadata: AppStoreMetadata }>> {
  try {
    // 1. Validate input
    const validated = createAppSchema.parse(input)

    // 2. Get authenticated user and workspace
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
    }

    // For now, get user's first workspace (TODO: support workspace selection)
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true },
    })

    if (!workspaceMember) {
      return {
        success: false,
        error: "No workspace found. Please create a workspace first.",
        code: "NO_WORKSPACE",
      }
    }

    const workspaceId = workspaceMember.workspace.id

    // 3. Check permissions
    if (!canAddApp(workspaceMember.role)) {
      return {
        success: false,
        error: "You don't have permission to add apps. Contact your workspace owner.",
        code: "PERMISSION_DENIED",
      }
    }

    // 4. Check plan limits
    try {
      await assertWithinPlanLimit(workspaceId, "apps", 1)
    } catch (error) {
      if (error instanceof PlanLimitError) {
        return {
          success: false,
          error: error.message,
          code: "PLAN_LIMIT_EXCEEDED",
        }
      }
      throw error
    }

    // 5. Parse App Store ID
    const appStoreId = parseAppStoreId(validated.identifier)
    if (!appStoreId) {
      return {
        success: false,
        error:
          "Invalid App Store URL or ID. Please provide a valid URL like 'https://apps.apple.com/us/app/myapp/id1234567890' or a numeric ID like '1234567890'.",
        code: "INVALID_IDENTIFIER",
      }
    }

    // 6. Check for duplicates BEFORE rate limit check (to avoid wasting API calls)
    const existingApp = await prisma.app.findFirst({
      where: {
        workspaceId,
        appStoreId,
        deletedAt: null, // Only check non-deleted apps
      },
    })

    if (existingApp) {
      return {
        success: false,
        error: `This app is already in your workspace${existingApp.nickname ? ` as "${existingApp.nickname}"` : ""}.`,
        code: "DUPLICATE_APP",
      }
    }

    // 7. Check rate limit
    if (!canCallAppleApi(workspaceId)) {
      const limitInfo = getAppleApiLimitInfo(workspaceId)
      const resetMinutes = Math.ceil(limitInfo.resetIn / 60000)
      return {
        success: false,
        error: `Apple API rate limit exceeded. Please try again in ${resetMinutes} minute(s).`,
        code: "RATE_LIMIT_EXCEEDED",
      }
    }

    // 8. Fetch metadata from Apple API
    const metadata = await fetchAppStoreMetadata(
      appStoreId,
      validated.country || "us"
    )

    if (!metadata) {
      return {
        success: false,
        error:
          "Could not find app in the App Store. Please verify the ID or URL is correct.",
        code: "APP_NOT_FOUND",
      }
    }

    // 9. Create app record
    // Generate slug from app name (lowercase, replace spaces with hyphens)
    const slug = metadata.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    const app = await prisma.app.create({
      data: {
        workspaceId,
        appStoreId: metadata.appStoreId,
        name: metadata.name,
        slug,
        nickname: validated.nickname || null,
        bundleId: metadata.bundleId,
        iconUrl: metadata.iconUrl,
        storeUrl: metadata.storeUrl,
        status: AppStatus.ACTIVE,
        platform: "IOS", // Currently only iOS apps supported
        category: metadata.primaryCategory,
        averageRating: metadata.averageRating,
        ratingCount: metadata.ratingCount,
        country: metadata.country,
      },
    })

    // Revalidate apps page
    revalidatePath("/dashboard/apps")

    // Convert Decimal types to numbers for client serialization
    const serializedApp = {
      ...app,
      averageRating: app.averageRating ? Number(app.averageRating) : null,
    }

    return {
      success: true,
      data: { app: serializedApp, metadata },
    }
  } catch (error) {
    console.error("[createApp] Error:", error)

    // Handle validation errors
    if (error instanceof Error && error.name === "ZodError") {
      return {
        success: false,
        error: "Invalid input data",
        code: "VALIDATION_ERROR",
      }
    }

    return {
      success: false,
      error: "Failed to create app. Please try again.",
      code: "INTERNAL_ERROR",
    }
  }
}

/**
 * Get all apps for the current workspace
 *
 * @param includeDeleted - Include soft-deleted apps
 * @returns List of apps
 */
export async function getApps(
  includeDeleted = false
): Promise<ActionResult<any[]>> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true },
    })

    if (!workspaceMember) {
      return { success: false, error: "No workspace found", code: "NO_WORKSPACE" }
    }

    const apps = await prisma.app.findMany({
      where: {
        workspaceId: workspaceMember.workspace.id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      select: {
        id: true,
        appStoreId: true,
        name: true,
        iconUrl: true,
        storeUrl: true,
        status: true,
        category: true,
        averageRating: true,
        ratingCount: true,
        lastSyncedAt: true,
        createdAt: true,
        _count: {
          select: {
            reviews: true,
            reviewSnapshots: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    })

    // Convert Decimal types to numbers for client serialization
    const serializedApps = apps.map((app) => ({
      ...app,
      averageRating: app.averageRating ? Number(app.averageRating) : null,
    }))

    return { success: true, data: serializedApps }
  } catch (error) {
    console.error("[getApps] Error:", error)
    return {
      success: false,
      error: "Failed to fetch apps",
      code: "INTERNAL_ERROR",
    }
  }
}

/**
 * Get detailed information about a specific app
 *
 * @param appId - App ID
 * @returns App details with related data
 */
export async function getAppDetails(
  appId: string
): Promise<ActionResult<any>> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!workspaceMember) {
      return { success: false, error: "No workspace found", code: "NO_WORKSPACE" }
    }

    const app = await prisma.app.findFirst({
      where: {
        id: appId,
        workspaceId: workspaceMember.workspaceId,
      },
      include: {
        _count: {
          select: {
            reviews: true,
            reviewSnapshots: true,
          },
        },
        reviewSnapshots: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            totalReviewsAnalyzed: true,
            _count: {
              select: { insights: true },
            },
          },
        },
      },
    })

    if (!app) {
      return { success: false, error: "App not found", code: "NOT_FOUND" }
    }

    // Convert Decimal types to numbers for client serialization
    const serializedApp = {
      ...app,
      averageRating: app.averageRating ? Number(app.averageRating) : null,
    }

    return { success: true, data: serializedApp }
  } catch (error) {
    console.error("[getAppDetails] Error:", error)
    return {
      success: false,
      error: "Failed to fetch app details",
      code: "INTERNAL_ERROR",
    }
  }
}

/**
 * Update app status (ACTIVE <-> PAUSED)
 *
 * @param input - App ID and new status
 * @returns Updated app data
 */
export async function updateAppStatus(
  input: UpdateAppStatusInput
): Promise<ActionResult<any>> {
  try {
    const validated = updateAppStatusSchema.parse(input)

    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!workspaceMember) {
      return { success: false, error: "No workspace found", code: "NO_WORKSPACE" }
    }

    // Check permissions
    if (!canPauseApp(workspaceMember.role)) {
      return {
        success: false,
        error: "You don't have permission to pause/resume apps. Contact your workspace owner.",
        code: "PERMISSION_DENIED",
      }
    }

    // Verify app belongs to workspace
    const app = await prisma.app.findFirst({
      where: {
        id: validated.appId,
        workspaceId: workspaceMember.workspaceId,
        deletedAt: null,
      },
    })

    if (!app) {
      return { success: false, error: "App not found", code: "NOT_FOUND" }
    }

    // Update status
    const updatedApp = await prisma.app.update({
      where: { id: validated.appId },
      data: { status: validated.status },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    })

    revalidatePath("/dashboard/apps")

    return { success: true, data: updatedApp }
  } catch (error) {
    console.error("[updateAppStatus] Error:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return {
        success: false,
        error: "Invalid input data",
        code: "VALIDATION_ERROR",
      }
    }

    return {
      success: false,
      error: "Failed to update app status",
      code: "INTERNAL_ERROR",
    }
  }
}

/**
 * Delete an app (soft delete by default, hard delete optional)
 *
 * @param input - App ID and hard delete flag
 * @returns Deletion confirmation
 */
export async function deleteApp(
  input: DeleteAppInput
): Promise<ActionResult<{ message: string }>> {
  try {
    const validated = deleteAppSchema.parse(input)

    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!workspaceMember) {
      return { success: false, error: "No workspace found", code: "NO_WORKSPACE" }
    }

    // Check permissions
    if (!canDeleteApp(workspaceMember.role)) {
      return {
        success: false,
        error: "You don't have permission to delete apps. Only workspace owners and admins can delete apps.",
        code: "PERMISSION_DENIED",
      }
    }

    // Verify app belongs to workspace
    const app = await prisma.app.findFirst({
      where: {
        id: validated.appId,
        workspaceId: workspaceMember.workspaceId,
      },
    })

    if (!app) {
      return { success: false, error: "App not found", code: "NOT_FOUND" }
    }

    if (validated.hardDelete) {
      // Hard delete: Remove app and all related data
      // Cascade delete will handle reviews, snapshots, insights, etc.
      await prisma.app.delete({
        where: { id: validated.appId },
      })

      revalidatePath("/dashboard/apps")

      return {
        success: true,
        data: { message: "App permanently deleted" },
      }
    } else {
      // Soft delete: Set deletedAt timestamp
      await prisma.app.update({
        where: { id: validated.appId },
        data: { deletedAt: new Date() },
      })

      revalidatePath("/dashboard/apps")

      return {
        success: true,
        data: { message: "App deleted successfully. You can restore it later." },
      }
    }
  } catch (error) {
    console.error("[deleteApp] Error:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return {
        success: false,
        error: "Invalid input data",
        code: "VALIDATION_ERROR",
      }
    }

    return {
      success: false,
      error: "Failed to delete app",
      code: "INTERNAL_ERROR",
    }
  }
}

/**
 * Restore a soft-deleted app
 *
 * @param input - App ID to restore
 * @returns Restored app data
 */
export async function restoreApp(
  input: RestoreAppInput
): Promise<ActionResult<any>> {
  try {
    const validated = restoreAppSchema.parse(input)

    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!workspaceMember) {
      return { success: false, error: "No workspace found", code: "NO_WORKSPACE" }
    }

    // Check permissions
    if (!canRestoreApp(workspaceMember.role)) {
      return {
        success: false,
        error: "You don't have permission to restore apps. Only workspace owners and admins can restore apps.",
        code: "PERMISSION_DENIED",
      }
    }

    // Verify app belongs to workspace and is deleted
    const app = await prisma.app.findFirst({
      where: {
        id: validated.appId,
        workspaceId: workspaceMember.workspaceId,
        deletedAt: { not: null },
      },
    })

    if (!app) {
      return {
        success: false,
        error: "App not found or not deleted",
        code: "NOT_FOUND",
      }
    }

    // Check plan limits before restoring
    const currentAppCount = await prisma.app.count({
      where: {
        workspaceId: workspaceMember.workspaceId,
        deletedAt: null,
      },
    })

    try {
      await assertWithinPlanLimit(
        workspaceMember.workspaceId,
        "apps",
        1
      )
    } catch (error) {
      if (error instanceof PlanLimitError) {
        return {
          success: false,
          error: `Cannot restore: ${error.message}`,
          code: "PLAN_LIMIT_EXCEEDED",
        }
      }
      throw error
    }

    // Restore app
    const restoredApp = await prisma.app.update({
      where: { id: validated.appId },
      data: { deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        deletedAt: true,
        updatedAt: true,
      },
    })

    revalidatePath("/dashboard/apps")

    return {
      success: true,
      data: restoredApp,
    }
  } catch (error) {
    console.error("[restoreApp] Error:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return {
        success: false,
        error: "Invalid input data",
        code: "VALIDATION_ERROR",
      }
    }

    return {
      success: false,
      error: "Failed to restore app",
      code: "INTERNAL_ERROR",
    }
  }
}

/**
 * Get reviews for a specific app
 *
 * @param appId - App ID
 * @param options - Pagination and filter options
 * @returns List of reviews
 */
export async function getAppReviews(
  appId: string,
  options?: {
    limit?: number
    offset?: number
    rating?: number
  }
): Promise<ActionResult<any[]>> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!workspaceMember) {
      return { success: false, error: "No workspace found", code: "NO_WORKSPACE" }
    }

    // Verify app belongs to workspace
    const app = await prisma.app.findFirst({
      where: {
        id: appId,
        workspaceId: workspaceMember.workspaceId,
      },
    })

    if (!app) {
      return { success: false, error: "App not found", code: "NOT_FOUND" }
    }

    const reviews = await prisma.review.findMany({
      where: {
        appId,
        ...(options?.rating ? { rating: options.rating } : {}),
      },
      select: {
        id: true,
        rating: true,
        title: true,
        content: true,
        author: true,
        publishedAt: true,
        version: true,
        country: true,
        voteSum: true,
        voteCount: true,
      },
      orderBy: { publishedAt: "desc" },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    })

    return { success: true, data: reviews }
  } catch (error) {
    console.error("[getAppReviews] Error:", error)
    return {
      success: false,
      error: "Failed to fetch reviews",
      code: "INTERNAL_ERROR",
    }
  }
}

/**
 * Get latest analysis/insights for a specific app
 *
 * @param appId - App ID
 * @returns Latest review snapshot with insights
 */
export async function getAppInsights(
  appId: string
): Promise<ActionResult<any>> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!workspaceMember) {
      return { success: false, error: "No workspace found", code: "NO_WORKSPACE" }
    }

    // Verify app belongs to workspace
    const app = await prisma.app.findFirst({
      where: {
        id: appId,
        workspaceId: workspaceMember.workspaceId,
      },
    })

    if (!app) {
      return { success: false, error: "App not found", code: "NOT_FOUND" }
    }

    // Get latest snapshot with insights
    const snapshot = await prisma.reviewSnapshot.findFirst({
      where: {
        appId,
        status: "SUCCEEDED",
      },
      include: {
        insights: {
          include: {
            reviewLinks: {
              include: {
                review: {
                  select: {
                    id: true,
                    rating: true,
                    title: true,
                    content: true,
                    author: true,
                    publishedAt: true,
                  },
                },
              },
              take: 3, // Show up to 3 example reviews per insight
            },
          },
          orderBy: { priority: "asc" },
        },
        ratingDistribution: true,
        monthlyTrends: {
          orderBy: { month: "desc" },
          take: 12,
        },
      },
      orderBy: { createdAt: "desc" },
    })

    if (!snapshot) {
      return {
        success: true,
        data: null,
      }
    }

    return { success: true, data: snapshot }
  } catch (error) {
    console.error("[getAppInsights] Error:", error)
    return {
      success: false,
      error: "Failed to fetch insights",
      code: "INTERNAL_ERROR",
    }
  }
}
