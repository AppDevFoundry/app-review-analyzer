"use server"

/**
 * Server actions for review management
 *
 * Handles review ingestion operations with:
 * - Permission checks
 * - Plan/quota enforcement
 * - Progress tracking
 * - History retrieval
 */

import { revalidatePath } from "next/cache"
import { IngestionStatus } from "@prisma/client"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import {
  INGESTION_ERROR_CODES,
  getIngestionErrorMessage,
} from "@/config/ingestion"
import { canFetchReviews } from "@/lib/permissions"
import {
  ingestReviews,
  cancelIngestion as cancelIngestionService,
  getIngestionRun,
  type IngestionResult,
} from "@/lib/reviews/ingest"
import {
  getWorkspaceQuotaInfo,
  getRecentIngestionRuns,
  getWorkspaceIngestionStats,
  type WorkspaceQuotaInfo,
} from "@/lib/reviews/quota"

// ============================================================================
// Types
// ============================================================================

/**
 * Standard action result type
 */
type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

/**
 * Fetch reviews input
 */
export interface FetchReviewsInput {
  appId: string
}

/**
 * Get ingestion history input
 */
export interface GetIngestionHistoryInput {
  appId: string
  limit?: number
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Fetch reviews for an app
 *
 * Triggers the review ingestion process:
 * 1. Validates user permissions
 * 2. Checks quotas (daily limit, plan limits)
 * 3. Fetches reviews from Apple
 * 4. Stores new reviews
 * 5. Queues snapshot for analysis
 *
 * @param input - App ID to fetch reviews for
 * @returns Ingestion result with statistics
 */
export async function fetchAppReviews(
  input: FetchReviewsInput
): Promise<ActionResult<IngestionResult>> {
  try {
    // 1. Get authenticated user
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
    }

    // 2. Get workspace membership
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

    // 3. Check permissions
    if (!canFetchReviews(workspaceMember.role)) {
      return {
        success: false,
        error: "You don't have permission to fetch reviews. Contact your workspace owner.",
        code: "PERMISSION_DENIED",
      }
    }

    // 4. Verify app belongs to workspace
    const app = await prisma.app.findFirst({
      where: {
        id: input.appId,
        workspaceId: workspaceMember.workspaceId,
        deletedAt: null,
      },
    })

    if (!app) {
      return {
        success: false,
        error: "App not found",
        code: "NOT_FOUND",
      }
    }

    // 5. Run ingestion
    const result = await ingestReviews({
      appId: input.appId,
      workspaceId: workspaceMember.workspaceId,
      triggeredById: session.user.id,
      reason: "manual",
    })

    // 6. Revalidate relevant paths
    revalidatePath("/dashboard/apps")
    revalidatePath(`/dashboard/apps/${input.appId}`)

    // 7. Return result
    if (result.success) {
      return { success: true, data: result }
    } else {
      return {
        success: false,
        error: result.error?.message || "Failed to fetch reviews",
        code: result.error?.code || "INTERNAL_ERROR",
      }
    }
  } catch (error) {
    console.error("[fetchAppReviews] Error:", error)

    return {
      success: false,
      error: "Failed to fetch reviews. Please try again.",
      code: "INTERNAL_ERROR",
    }
  }
}

/**
 * Cancel an in-progress ingestion run
 *
 * @param runId - Ingestion run ID to cancel
 * @returns Success or failure
 */
export async function cancelReviewIngestion(
  runId: string
): Promise<ActionResult<{ message: string }>> {
  try {
    // 1. Get authenticated user
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
    }

    // 2. Get the run and verify ownership
    const run = await getIngestionRun(runId)
    if (!run) {
      return {
        success: false,
        error: "Ingestion run not found",
        code: "NOT_FOUND",
      }
    }

    // 3. Verify user has access to the workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        userId: session.user.id,
        workspaceId: run.workspaceId,
      },
    })

    if (!workspaceMember) {
      return {
        success: false,
        error: "You don't have access to this workspace",
        code: "PERMISSION_DENIED",
      }
    }

    // 4. Cancel the run
    const cancelled = await cancelIngestionService(runId)

    if (cancelled) {
      revalidatePath(`/dashboard/apps/${run.appId}`)
      return {
        success: true,
        data: { message: "Ingestion cancelled successfully" },
      }
    } else {
      return {
        success: false,
        error: "Cannot cancel this ingestion run. It may have already completed.",
        code: "INVALID_STATE",
      }
    }
  } catch (error) {
    console.error("[cancelReviewIngestion] Error:", error)

    return {
      success: false,
      error: "Failed to cancel ingestion",
      code: "INTERNAL_ERROR",
    }
  }
}

/**
 * Get ingestion history for an app
 *
 * @param input - App ID and optional limit
 * @returns List of ingestion runs
 */
export async function getIngestionHistory(
  input: GetIngestionHistoryInput
): Promise<ActionResult<any[]>> {
  try {
    // 1. Get authenticated user
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
    }

    // 2. Get workspace membership
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!workspaceMember) {
      return {
        success: false,
        error: "No workspace found",
        code: "NO_WORKSPACE",
      }
    }

    // 3. Verify app belongs to workspace
    const app = await prisma.app.findFirst({
      where: {
        id: input.appId,
        workspaceId: workspaceMember.workspaceId,
      },
    })

    if (!app) {
      return {
        success: false,
        error: "App not found",
        code: "NOT_FOUND",
      }
    }

    // 4. Get ingestion runs
    const runs = await getRecentIngestionRuns(input.appId, input.limit || 10)

    // Serialize for client
    const serializedRuns = runs.map((run) => ({
      id: run.id,
      status: run.status,
      reason: run.reason,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() || null,
      durationMs: run.durationMs,
      reviewsFetched: run.reviewsFetched,
      reviewsNew: run.reviewsNew,
      reviewsDuplicate: run.reviewsDuplicate,
      pagesProcessed: run.pagesProcessed,
      sourcesProcessed: run.sourcesProcessed,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
      triggeredBy: run.triggeredBy
        ? {
            id: run.triggeredBy.id,
            name: run.triggeredBy.name,
            email: run.triggeredBy.email,
          }
        : null,
    }))

    return { success: true, data: serializedRuns }
  } catch (error) {
    console.error("[getIngestionHistory] Error:", error)

    return {
      success: false,
      error: "Failed to fetch ingestion history",
      code: "INTERNAL_ERROR",
    }
  }
}

/**
 * Get quota information for the current workspace
 *
 * @returns Quota status including daily limits and usage
 */
export async function getQuotaStatus(): Promise<ActionResult<WorkspaceQuotaInfo>> {
  try {
    // 1. Get authenticated user
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
    }

    // 2. Get workspace membership
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!workspaceMember) {
      return {
        success: false,
        error: "No workspace found",
        code: "NO_WORKSPACE",
      }
    }

    // 3. Get quota info
    const quotaInfo = await getWorkspaceQuotaInfo(workspaceMember.workspaceId)

    // Serialize for client
    const serializedInfo: WorkspaceQuotaInfo = {
      ...quotaInfo,
      dailyResetAt: quotaInfo.dailyResetAt,
    }

    return { success: true, data: serializedInfo }
  } catch (error) {
    console.error("[getQuotaStatus] Error:", error)

    return {
      success: false,
      error: "Failed to fetch quota status",
      code: "INTERNAL_ERROR",
    }
  }
}

/**
 * Get ingestion statistics for the current workspace
 *
 * @returns Aggregated statistics about ingestion runs
 */
export async function getIngestionStats(): Promise<ActionResult<any>> {
  try {
    // 1. Get authenticated user
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
    }

    // 2. Get workspace membership
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!workspaceMember) {
      return {
        success: false,
        error: "No workspace found",
        code: "NO_WORKSPACE",
      }
    }

    // 3. Get statistics
    const stats = await getWorkspaceIngestionStats(workspaceMember.workspaceId)

    return { success: true, data: stats }
  } catch (error) {
    console.error("[getIngestionStats] Error:", error)

    return {
      success: false,
      error: "Failed to fetch ingestion statistics",
      code: "INTERNAL_ERROR",
    }
  }
}

/**
 * Get the status of a specific ingestion run
 *
 * @param runId - Ingestion run ID
 * @returns Run details and status
 */
export async function getIngestionRunStatus(
  runId: string
): Promise<ActionResult<any>> {
  try {
    // 1. Get authenticated user
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
    }

    // 2. Get the run
    const run = await getIngestionRun(runId)
    if (!run) {
      return {
        success: false,
        error: "Ingestion run not found",
        code: "NOT_FOUND",
      }
    }

    // 3. Verify user has access to the workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        userId: session.user.id,
        workspaceId: run.workspaceId,
      },
    })

    if (!workspaceMember) {
      return {
        success: false,
        error: "You don't have access to this workspace",
        code: "PERMISSION_DENIED",
      }
    }

    // Serialize for client
    const serializedRun = {
      id: run.id,
      status: run.status,
      reason: run.reason,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() || null,
      durationMs: run.durationMs,
      reviewsFetched: run.reviewsFetched,
      reviewsNew: run.reviewsNew,
      reviewsDuplicate: run.reviewsDuplicate,
      pagesProcessed: run.pagesProcessed,
      sourcesProcessed: run.sourcesProcessed,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
      app: run.app,
      triggeredBy: run.triggeredBy,
      snapshot: run.snapshot,
    }

    return { success: true, data: serializedRun }
  } catch (error) {
    console.error("[getIngestionRunStatus] Error:", error)

    return {
      success: false,
      error: "Failed to fetch run status",
      code: "INTERNAL_ERROR",
    }
  }
}
