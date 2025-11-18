"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { hasWorkspaceRole } from "@/lib/workspaces"
import { deleteAppSchema, type DeleteAppInput } from "@/lib/validations/app"
import { WorkspaceRole, AppStatus } from "@prisma/client"

// =============================================================================
// Types
// =============================================================================

export type DeleteAppResult = {
  status: "success" | "error"
  data?: {
    id: string
    name: string
  }
  error?: {
    code: string
    message: string
  }
}

// =============================================================================
// Server Action
// =============================================================================

export async function deleteApp(input: DeleteAppInput): Promise<DeleteAppResult> {
  try {
    // 1. Authenticate user
    const user = await getCurrentUser()
    if (!user?.id) {
      return {
        status: "error",
        error: {
          code: "UNAUTHORIZED",
          message: "You must be logged in to delete an app.",
        },
      }
    }

    // 2. Validate input
    const validationResult = deleteAppSchema.safeParse(input)
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

    const { appId, hardDelete = false } = validationResult.data

    // 3. Get the app
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

    // 4. Verify user has Admin or Owner role (delete is destructive)
    const hasPermission = await hasWorkspaceRole(
      user.id,
      app.workspaceId,
      WorkspaceRole.ADMIN
    )

    if (!hasPermission) {
      return {
        status: "error",
        error: {
          code: "FORBIDDEN",
          message: "Only workspace admins and owners can delete apps.",
        },
      }
    }

    // 5. Perform delete
    if (hardDelete) {
      // Hard delete - actually remove the record
      // Note: Reviews will cascade delete based on schema relations
      await prisma.app.delete({
        where: { id: appId },
      })

      console.info(
        `[deleteApp] Hard deleted app "${app.name}" (${appId}) by user ${user.id}`
      )
    } else {
      // Soft delete - mark as archived
      await prisma.app.update({
        where: { id: appId },
        data: {
          status: AppStatus.ARCHIVED,
          updatedAt: new Date(),
        },
      })

      console.info(
        `[deleteApp] Soft deleted (archived) app "${app.name}" (${appId}) by user ${user.id}`
      )
    }

    // 6. Revalidate cache
    revalidatePath("/dashboard/apps")

    return {
      status: "success",
      data: {
        id: app.id,
        name: app.name,
      },
    }
  } catch (error) {
    console.error("[deleteApp] Unexpected error:", error)
    return {
      status: "error",
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Please try again.",
      },
    }
  }
}
