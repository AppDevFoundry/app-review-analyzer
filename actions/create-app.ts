"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import {
  getDefaultWorkspaceWithPlan,
  assertWithinPlan,
  WorkspaceLimitExceededError,
} from "@/lib/workspaces"
import {
  parseAppStoreId,
  fetchAppStoreMetadata,
  AppStoreError,
} from "@/lib/apple"
import { createAppSchema, type CreateAppInput } from "@/lib/validations/app"

// =============================================================================
// Types
// =============================================================================

export type CreateAppResult = {
  status: "success" | "error"
  data?: {
    id: string
    name: string
    appStoreId: string
    iconUrl: string | null
  }
  error?: {
    code: string
    message: string
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

async function generateUniqueAppSlug(
  workspaceId: string,
  name: string
): Promise<string> {
  const baseSlug = slugify(name) || "app"

  // Check if base slug is available in this workspace
  const existing = await prisma.app.findFirst({
    where: { workspaceId, slug: baseSlug },
    select: { id: true },
  })

  if (!existing) {
    return baseSlug
  }

  // Find existing slugs that match the pattern
  const similarApps = await prisma.app.findMany({
    where: {
      workspaceId,
      slug: { startsWith: `${baseSlug}-` },
    },
    select: { slug: true },
  })

  // Extract numbers from similar slugs
  const numbers = similarApps
    .map((app) => {
      const match = app.slug.match(new RegExp(`^${baseSlug}-(\\d+)$`))
      return match ? parseInt(match[1], 10) : 0
    })
    .filter((n) => n > 0)

  const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 2
  return `${baseSlug}-${nextNumber}`
}

// =============================================================================
// Server Action
// =============================================================================

export async function createApp(input: CreateAppInput): Promise<CreateAppResult> {
  try {
    // 1. Authenticate user
    const user = await getCurrentUser()
    if (!user?.id) {
      return {
        status: "error",
        error: {
          code: "UNAUTHORIZED",
          message: "You must be logged in to add an app.",
        },
      }
    }

    // 2. Validate input
    const validationResult = createAppSchema.safeParse(input)
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0]
      return {
        status: "error",
        error: {
          code: "VALIDATION_ERROR",
          message: firstError.message,
        },
      }
    }

    const { identifier, nickname, country = "us" } = validationResult.data

    // 3. Get workspace and check plan limits
    const workspace = await getDefaultWorkspaceWithPlan(user.id)

    try {
      await assertWithinPlan(workspace.id, "apps", 1)
    } catch (error) {
      if (error instanceof WorkspaceLimitExceededError) {
        return {
          status: "error",
          error: {
            code: "PLAN_LIMIT_EXCEEDED",
            message: `You've reached your limit of ${error.limit} apps. Upgrade your plan to add more.`,
          },
        }
      }
      throw error
    }

    // 4. Parse App Store ID from identifier
    let appStoreId: string
    try {
      appStoreId = parseAppStoreId(identifier)
    } catch (error) {
      if (error instanceof AppStoreError) {
        return {
          status: "error",
          error: {
            code: "INVALID_IDENTIFIER",
            message: error.message,
          },
        }
      }
      throw error
    }

    // 5. Check for duplicate in workspace
    const existingApp = await prisma.app.findUnique({
      where: {
        workspaceId_appStoreId: {
          workspaceId: workspace.id,
          appStoreId,
        },
      },
    })

    if (existingApp) {
      return {
        status: "error",
        error: {
          code: "DUPLICATE_APP",
          message: `This app (${existingApp.name}) is already in your workspace.`,
        },
      }
    }

    // 6. Fetch metadata from Apple
    let metadata
    try {
      metadata = await fetchAppStoreMetadata(appStoreId, country)
    } catch (error) {
      if (error instanceof AppStoreError) {
        return {
          status: "error",
          error: {
            code: error.code,
            message: error.message,
          },
        }
      }
      throw error
    }

    // 7. Generate unique slug
    const slug = await generateUniqueAppSlug(workspace.id, metadata.name)

    // 8. Create app record
    const app = await prisma.app.create({
      data: {
        workspaceId: workspace.id,
        platform: "IOS",
        appStoreId: metadata.appStoreId,
        bundleId: metadata.bundleId,
        name: nickname || metadata.name,
        slug,
        developerName: metadata.developerName,
        primaryCategory: metadata.primaryCategory,
        iconUrl: metadata.iconUrl,
        storeUrl: metadata.storeUrl,
        averageRating: metadata.averageRating,
        ratingCount: metadata.ratingCount,
        status: "ACTIVE",
        lastSyncedAt: new Date(),
      },
    })

    console.info(
      `[createApp] Created app "${app.name}" (${app.appStoreId}) in workspace ${workspace.id} by user ${user.id}`
    )

    // 9. Revalidate cache
    revalidatePath("/dashboard/apps")

    return {
      status: "success",
      data: {
        id: app.id,
        name: app.name,
        appStoreId: app.appStoreId,
        iconUrl: app.iconUrl,
      },
    }
  } catch (error) {
    console.error("[createApp] Unexpected error:", error)
    return {
      status: "error",
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Please try again.",
      },
    }
  }
}
