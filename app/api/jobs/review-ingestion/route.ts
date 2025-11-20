/**
 * Review Ingestion Cron Job API Route
 *
 * Scheduled endpoint for automatic review fetching.
 * Called by Vercel Cron or similar scheduler.
 *
 * Security: Requires CRON_SECRET in Authorization header or query param.
 *
 * Example Vercel cron config in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/jobs/review-ingestion",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { ingestReviews } from "@/lib/reviews/ingest"

/**
 * POST /api/jobs/review-ingestion
 *
 * Processes review ingestion for eligible apps.
 *
 * Query params:
 * - secret: CRON_SECRET for authentication
 * - dryRun: If "true", only logs what would be done
 * - workspaceId: Optional filter for specific workspace
 * - planTier: Optional filter for specific plan (STARTER, PRO, BUSINESS)
 * - limit: Max apps to process (default: 50)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // 1. Authenticate request
    const authHeader = request.headers.get("authorization")
    const secretFromHeader = authHeader?.replace("Bearer ", "")
    const secretFromQuery = request.nextUrl.searchParams.get("secret")
    const secret = secretFromHeader || secretFromQuery

    if (!secret || secret !== process.env.CRON_SECRET) {
      console.warn("[Cron] Unauthorized access attempt")
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // 2. Parse options
    const dryRun = request.nextUrl.searchParams.get("dryRun") === "true"
    const workspaceIdFilter = request.nextUrl.searchParams.get("workspaceId")
    const planTierFilter = request.nextUrl.searchParams.get("planTier")
    const limitParam = request.nextUrl.searchParams.get("limit")
    const limit = limitParam ? parseInt(limitParam, 10) : 50

    console.log("[Cron] Review ingestion job started", {
      dryRun,
      workspaceIdFilter,
      planTierFilter,
      limit,
    })

    // 3. Find eligible apps
    const eligibleApps = await findEligibleApps({
      workspaceId: workspaceIdFilter || undefined,
      planTier: planTierFilter || undefined,
      limit,
    })

    console.log(`[Cron] Found ${eligibleApps.length} eligible apps`)

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        eligible: eligibleApps.map((app) => ({
          id: app.id,
          name: app.name,
          workspaceId: app.workspaceId,
          lastSyncedAt: app.lastSyncedAt,
        })),
        message: "Dry run - no ingestion performed",
      })
    }

    // 4. Process apps sequentially with concurrency control
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ appId: string; error: string }>,
    }

    for (const app of eligibleApps) {
      try {
        console.log(`[Cron] Processing app: ${app.name} (${app.id})`)

        const result = await ingestReviews({
          appId: app.id,
          reason: "SCHEDULED",
          triggeredByUserId: undefined, // System-triggered
        })

        results.processed++

        if (result.success) {
          results.succeeded++
          console.log(
            `[Cron] ✓ ${app.name}: ${result.reviewsInserted} reviews inserted`
          )
        } else {
          results.failed++
          results.errors.push({
            appId: app.id,
            error: result.error?.message || "Unknown error",
          })
          console.error(`[Cron] ✗ ${app.name}: ${result.error?.message}`)
        }
      } catch (error) {
        results.failed++
        results.skipped++
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        results.errors.push({
          appId: app.id,
          error: errorMessage,
        })
        console.error(`[Cron] ✗ ${app.name}: ${errorMessage}`)
        // Continue processing other apps
      }
    }

    const durationMs = Date.now() - startTime

    console.log("[Cron] Review ingestion job completed", {
      ...results,
      durationMs,
    })

    return NextResponse.json({
      success: true,
      results,
      durationMs,
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    console.error("[Cron] Job failed:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        durationMs,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/jobs/review-ingestion
 *
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  // Require secret for health check too
  const secret = request.nextUrl.searchParams.get("secret")

  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Count eligible apps
  const eligibleCount = await prisma.app.count({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      workspace: {
        deletedAt: null,
      },
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: new Date() } },
      ],
    },
  })

  return NextResponse.json({
    status: "healthy",
    eligible: eligibleCount,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Find apps eligible for scheduled ingestion
 */
async function findEligibleApps(options: {
  workspaceId?: string
  planTier?: string
  limit: number
}) {
  return prisma.app.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      workspace: {
        deletedAt: null,
        ...(options.workspaceId && {
          id: options.workspaceId,
        }),
        ...(options.planTier && {
          plan: options.planTier as any,
        }),
      },
      // Only fetch apps that aren't in retry backoff
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: new Date() } },
      ],
    },
    select: {
      id: true,
      name: true,
      appStoreId: true,
      workspaceId: true,
      lastSyncedAt: true,
      consecutiveFailures: true,
    },
    orderBy: [
      // Prioritize apps that haven't been synced recently
      { lastSyncedAt: "asc" },
      // Then by creation date
      { createdAt: "asc" },
    ],
    take: options.limit,
  })
}
