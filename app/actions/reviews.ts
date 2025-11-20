/**
 * Review-related server actions
 *
 * Provides UI access to review ingestion and history.
 * All actions enforce authentication, permissions, and plan limits.
 */

"use server"

import { revalidatePath } from "next/cache"
import type { IngestionReason } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { canFetchReviews } from "@/lib/permissions"
import { ingestReviews } from "@/lib/reviews/ingest"

/**
 * Action result type
 */
type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code: string }

/**
 * Trigger manual review ingestion for an app
 *
 * @param appId - App ID to fetch reviews for
 * @returns Ingestion result
 */
export async function triggerReviewIngestion(
  appId: string
): Promise<
  ActionResult<{
    runId: string
    reviewsFetched: number
    reviewsInserted: number
    duplicateCount: number
    durationMs: number
    snapshotId?: string
  }>
> {
  try {
    // 1. Auth check
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: "You must be logged in to fetch reviews",
        code: "UNAUTHORIZED",
      }
    }

    // 2. Get app and verify workspace membership
    const app = await prisma.app.findUnique({
      where: { id: appId },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    })

    if (!app || app.workspace.members.length === 0) {
      return {
        success: false,
        error: "App not found or access denied",
        code: "NOT_FOUND",
      }
    }

    const workspaceMember = app.workspace.members[0]

    // 3. Permission check
    if (!canFetchReviews(workspaceMember.role)) {
      return {
        success: false,
        error: "You don't have permission to fetch reviews",
        code: "PERMISSION_DENIED",
      }
    }

    // 4. Trigger ingestion
    const result = await ingestReviews({
      appId: app.id,
      triggeredByUserId: session.user.id,
      reason: "MANUAL",
    })

    // 5. Revalidate relevant paths
    revalidatePath(`/dashboard/apps/${appId}`)
    revalidatePath("/dashboard/apps")

    if (!result.success) {
      return {
        success: false,
        error: result.error?.message || "Ingestion failed",
        code: result.error?.code || "UNKNOWN",
      }
    }

    return {
      success: true,
      data: {
        runId: result.runId,
        reviewsFetched: result.reviewsFetched,
        reviewsInserted: result.reviewsInserted,
        duplicateCount: result.duplicateCount,
        durationMs: result.durationMs,
        snapshotId: result.snapshotId,
      },
    }
  } catch (error) {
    console.error("[Action] Error triggering ingestion:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to trigger ingestion",
      code: "UNKNOWN",
    }
  }
}

/**
 * Get ingestion run history for an app
 *
 * @param appId - App ID
 * @param options - Pagination and filtering
 * @returns List of ingestion runs
 */
export async function getIngestionRuns(
  appId: string,
  options?: {
    limit?: number
    offset?: number
    status?: string
  }
): Promise<
  ActionResult<{
    runs: Array<{
      id: string
      reason: IngestionReason
      status: string
      requestedAt: Date
      finishedAt: Date | null
      durationMs: number | null
      reviewsFetched: number
      reviewsInserted: number
      duplicateCount: number
      errorMessage: string | null
      errorCode: string | null
      triggeredBy: { name: string | null; email: string | null } | null
      snapshot: { id: string; status: string } | null
    }>
    total: number
  }>
> {
  try {
    // 1. Auth check
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: "You must be logged in",
        code: "UNAUTHORIZED",
      }
    }

    // 2. Get app and verify access
    const app = await prisma.app.findUnique({
      where: { id: appId },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    })

    if (!app || app.workspace.members.length === 0) {
      return {
        success: false,
        error: "App not found or access denied",
        code: "NOT_FOUND",
      }
    }

    // 3. Build query
    const where = {
      appId,
      ...(options?.status && {
        status: options.status,
      }),
    }

    // 4. Get runs with pagination
    const [runs, total] = await Promise.all([
      prisma.reviewIngestionRun.findMany({
        where,
        orderBy: { requestedAt: "desc" },
        take: options?.limit || 10,
        skip: options?.offset || 0,
        select: {
          id: true,
          reason: true,
          status: true,
          requestedAt: true,
          finishedAt: true,
          durationMs: true,
          reviewsFetched: true,
          reviewsInserted: true,
          duplicateCount: true,
          errorMessage: true,
          errorCode: true,
          triggeredBy: {
            select: {
              name: true,
              email: true,
            },
          },
          reviewSnapshot: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),
      prisma.reviewIngestionRun.count({ where }),
    ])

    return {
      success: true,
      data: {
        runs: runs.map((run) => ({
          ...run,
          snapshot: run.reviewSnapshot,
        })),
        total,
      },
    }
  } catch (error) {
    console.error("[Action] Error fetching ingestion runs:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch ingestion runs",
      code: "UNKNOWN",
    }
  }
}

/**
 * Get detailed information about a single ingestion run
 *
 * @param runId - Ingestion run ID
 * @returns Detailed run information
 */
export async function getIngestionRunDetails(runId: string): Promise<
  ActionResult<{
    id: string
    reason: IngestionReason
    status: string
    requestedAt: Date
    startedAt: Date | null
    finishedAt: Date | null
    durationMs: number | null
    reviewsFetched: number
    reviewsInserted: number
    duplicateCount: number
    reviewsSkipped: number
    sourcesProcessed: string[]
    errorMessage: string | null
    errorCode: string | null
    metadata: any
    app: {
      id: string
      name: string
      iconUrl: string | null
    }
    triggeredBy: {
      name: string | null
      email: string | null
    } | null
    snapshot: {
      id: string
      status: string
      totalReviewsAnalyzed: number
    } | null
  }>
> {
  try {
    // 1. Auth check
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: "You must be logged in",
        code: "UNAUTHORIZED",
      }
    }

    // 2. Get run with details
    const run = await prisma.reviewIngestionRun.findUnique({
      where: { id: runId },
      include: {
        app: {
          select: {
            id: true,
            name: true,
            iconUrl: true,
          },
        },
        workspace: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
        triggeredBy: {
          select: {
            name: true,
            email: true,
          },
        },
        reviewSnapshot: {
          select: {
            id: true,
            status: true,
            totalReviewsAnalyzed: true,
          },
        },
      },
    })

    if (!run || run.workspace.members.length === 0) {
      return {
        success: false,
        error: "Ingestion run not found or access denied",
        code: "NOT_FOUND",
      }
    }

    return {
      success: true,
      data: {
        id: run.id,
        reason: run.reason,
        status: run.status,
        requestedAt: run.requestedAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        durationMs: run.durationMs,
        reviewsFetched: run.reviewsFetched,
        reviewsInserted: run.reviewsInserted,
        duplicateCount: run.duplicateCount,
        reviewsSkipped: run.reviewsSkipped,
        sourcesProcessed: run.sourcesProcessed,
        errorMessage: run.errorMessage,
        errorCode: run.errorCode,
        metadata: run.metadata,
        app: run.app,
        triggeredBy: run.triggeredBy,
        snapshot: run.reviewSnapshot,
      },
    }
  } catch (error) {
    console.error("[Action] Error fetching run details:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch run details",
      code: "UNKNOWN",
    }
  }
}

/**
 * Retry a failed ingestion
 *
 * @param runId - Failed run ID to retry
 * @returns New ingestion result
 */
export async function retryFailedIngestion(
  runId: string
): Promise<
  ActionResult<{
    runId: string
    reviewsFetched: number
    reviewsInserted: number
  }>
> {
  try {
    // 1. Auth check
    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        error: "You must be logged in",
        code: "UNAUTHORIZED",
      }
    }

    // 2. Get original run
    const originalRun = await prisma.reviewIngestionRun.findUnique({
      where: { id: runId },
      include: {
        app: true,
        workspace: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    })

    if (!originalRun || originalRun.workspace.members.length === 0) {
      return {
        success: false,
        error: "Ingestion run not found or access denied",
        code: "NOT_FOUND",
      }
    }

    const workspaceMember = originalRun.workspace.members[0]

    // 3. Permission check
    if (!canFetchReviews(workspaceMember.role)) {
      return {
        success: false,
        error: "You don't have permission to retry ingestion",
        code: "PERMISSION_DENIED",
      }
    }

    // 4. Trigger new ingestion
    const result = await ingestReviews({
      appId: originalRun.appId,
      triggeredByUserId: session.user.id,
      reason: "MANUAL", // Changed from original reason
    })

    // 5. Revalidate paths
    revalidatePath(`/dashboard/apps/${originalRun.appId}`)
    revalidatePath("/dashboard/apps")

    if (!result.success) {
      return {
        success: false,
        error: result.error?.message || "Retry failed",
        code: result.error?.code || "UNKNOWN",
      }
    }

    return {
      success: true,
      data: {
        runId: result.runId,
        reviewsFetched: result.reviewsFetched,
        reviewsInserted: result.reviewsInserted,
      },
    }
  } catch (error) {
    console.error("[Action] Error retrying ingestion:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Retry failed",
      code: "UNKNOWN",
    }
  }
}
