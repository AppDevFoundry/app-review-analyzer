"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { getDefaultWorkspaceWithPlan, canAccessWorkspace } from "@/lib/workspaces"
import { updateAppStatusSchema, type UpdateAppStatusInput } from "@/lib/validations/app"
import { AppStatus } from "@prisma/client"

// =============================================================================
// Types
// =============================================================================

export type UpdateAppStatusResult = {
  status: "success" | "error"
  data?: {
    id: string
    name: string
    status: AppStatus
  }
  error?: {
    code: string
    message: string
  }
}

// =============================================================================
// Server Action
// =============================================================================

export async function updateAppStatus(
  input: UpdateAppStatusInput
): Promise<UpdateAppStatusResult> {
  try {
    // 1. Authenticate user
    const user = await getCurrentUser()
    if (!user?.id) {
      return {
        status: "error",
        error: {
          code: "UNAUTHORIZED",
          message: "You must be logged in to update an app.",
        },
      }
    }

    // 2. Validate input
    const validationResult = updateAppStatusSchema.safeParse(input)
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

    const { appId, status: newStatus } = validationResult.data

    // 3. Get the app and verify workspace access
    const app = await prisma.app.findUnique({
      where: { id: appId },
      select: {
        id: true,
        name: true,
        status: true,
        workspaceId: true,
      },
    })

    if (!app) {
      return {
        status: "error",
        error: {
          code: "NOT_FOUND",
          message: "App not found.",
        },
      }
    }

    // 4. Verify user has access to this workspace
    const hasAccess = await canAccessWorkspace(user.id, app.workspaceId)
    if (!hasAccess) {
      return {
        status: "error",
        error: {
          code: "FORBIDDEN",
          message: "You don't have access to this app.",
        },
      }
    }

    // 5. Validate status transition
    if (app.status === AppStatus.ARCHIVED) {
      return {
        status: "error",
        error: {
          code: "INVALID_TRANSITION",
          message: "Cannot change status of an archived app.",
        },
      }
    }

    if (app.status === newStatus) {
      return {
        status: "error",
        error: {
          code: "NO_CHANGE",
          message: `App is already ${newStatus.toLowerCase()}.`,
        },
      }
    }

    // 6. Update app status
    const updatedApp = await prisma.app.update({
      where: { id: appId },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
    })

    const actionVerb = newStatus === AppStatus.PAUSED ? "paused" : "resumed"
    console.info(
      `[updateAppStatus] App "${updatedApp.name}" (${appId}) ${actionVerb} by user ${user.id}`
    )

    // 7. Revalidate cache
    revalidatePath("/dashboard/apps")

    return {
      status: "success",
      data: {
        id: updatedApp.id,
        name: updatedApp.name,
        status: updatedApp.status,
      },
    }
  } catch (error) {
    console.error("[updateAppStatus] Unexpected error:", error)
    return {
      status: "error",
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Please try again.",
      },
    }
  }
}
