/**
 * Scheduled Review Ingestion API Route
 *
 * Cron endpoint for automatic review fetching.
 * Can be triggered by Vercel Cron or any external scheduler.
 *
 * Security: Requires CRON_SECRET header for authentication.
 *
 * Usage:
 * - Vercel Cron: Configure in vercel.json
 * - Manual: POST /api/jobs/review-ingestion with Authorization header
 */

import { NextResponse } from "next/server"
import { AppStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { ingestReviews } from "@/lib/reviews/ingest"
import { logger } from "@/lib/logger"
import { INGESTION_CONFIG } from "@/config/ingestion"

// ============================================================================
// Types
// ============================================================================

interface IngestionJobResult {
  appId: string
  appName: string
  success: boolean
  reviewsNew?: number
  reviewsFetched?: number
  error?: string
  durationMs?: number
}

interface JobResponse {
  success: boolean
  message: string
  startedAt: string
  completedAt: string
  durationMs: number
  results: {
    total: number
    succeeded: number
    failed: number
    skipped: number
  }
  details: IngestionJobResult[]
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Maximum apps to process per job run
 * Prevents timeout issues on serverless platforms
 */
const MAX_APPS_PER_RUN = 10

/**
 * Delay between processing apps (milliseconds)
 * Prevents rate limiting from Apple API
 */
const DELAY_BETWEEN_APPS = 3000

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Verify the cron secret from request headers
 */
function verifyCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET

  // If no secret is configured, reject all requests in production
  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      logger.warn("cron_secret_not_configured", {})
      return false
    }
    // Allow in development without secret
    return true
  }

  // Check Authorization header
  const authHeader = request.headers.get("Authorization")
  if (authHeader === `Bearer ${cronSecret}`) {
    return true
  }

  // Check query parameter (for Vercel Cron compatibility)
  const url = new URL(request.url)
  const querySecret = url.searchParams.get("secret")
  if (querySecret === cronSecret) {
    return true
  }

  return false
}

/**
 * Get all active apps eligible for scheduled ingestion
 */
async function getEligibleApps() {
  // Get apps that are active and haven't been synced recently (e.g., in last 20 hours)
  // This prevents fetching the same app too frequently
  const recentThreshold = new Date(Date.now() - 20 * 60 * 60 * 1000) // 20 hours ago

  return prisma.app.findMany({
    where: {
      status: AppStatus.ACTIVE,
      deletedAt: null,
      // Optional: Only fetch apps that haven't been synced recently
      OR: [
        { lastSyncedAt: null },
        { lastSyncedAt: { lt: recentThreshold } },
      ],
    },
    select: {
      id: true,
      name: true,
      appStoreId: true,
      workspaceId: true,
      lastSyncedAt: true,
      workspace: {
        select: {
          id: true,
          plan: true,
          deletedAt: true,
        },
      },
    },
    orderBy: [
      { lastSyncedAt: { sort: "asc", nulls: "first" } },
    ],
    take: MAX_APPS_PER_RUN,
  })
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /api/jobs/review-ingestion
 *
 * Main cron endpoint for scheduled review ingestion.
 * Processes eligible apps sequentially with rate limiting.
 */
export async function POST(request: Request): Promise<NextResponse<JobResponse | { error: string }>> {
  const startTime = Date.now()
  const startedAt = new Date().toISOString()

  // 1. Verify cron secret
  if (!verifyCronSecret(request)) {
    logger.warn("cron_unauthorized", {
      path: "/api/jobs/review-ingestion",
      ip: request.headers.get("x-forwarded-for"),
    })

    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  logger.info("cron_job_started", {
    job: "review-ingestion",
  })

  const results: IngestionJobResult[] = []
  let succeeded = 0
  let failed = 0
  let skipped = 0

  try {
    // 2. Get eligible apps
    const apps = await getEligibleApps()

    if (apps.length === 0) {
      logger.info("cron_job_completed", {
        job: "review-ingestion",
        message: "No eligible apps found",
      })

      return NextResponse.json({
        success: true,
        message: "No eligible apps found for ingestion",
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        results: { total: 0, succeeded: 0, failed: 0, skipped: 0 },
        details: [],
      })
    }

    logger.info("cron_job_processing", {
      job: "review-ingestion",
      appCount: apps.length,
    })

    // 3. Process each app sequentially
    for (let i = 0; i < apps.length; i++) {
      const app = apps[i]
      const appStartTime = Date.now()

      // Skip if workspace is deleted
      if (app.workspace.deletedAt) {
        skipped++
        results.push({
          appId: app.id,
          appName: app.name,
          success: false,
          error: "Workspace deleted",
        })
        continue
      }

      try {
        // Add delay between apps (except first)
        if (i > 0) {
          await sleep(DELAY_BETWEEN_APPS)
        }

        // Run ingestion
        const result = await ingestReviews({
          appId: app.id,
          workspaceId: app.workspaceId,
          reason: "scheduled",
        })

        const durationMs = Date.now() - appStartTime

        if (result.success) {
          succeeded++
          results.push({
            appId: app.id,
            appName: app.name,
            success: true,
            reviewsNew: result.reviewsNew,
            reviewsFetched: result.reviewsFetched,
            durationMs,
          })
        } else {
          failed++
          results.push({
            appId: app.id,
            appName: app.name,
            success: false,
            error: result.error?.message || "Unknown error",
            durationMs,
          })
        }
      } catch (error) {
        failed++
        const errorMessage = error instanceof Error ? error.message : "Unknown error"

        logger.error("cron_app_error", error, {
          job: "review-ingestion",
          appId: app.id,
        })

        results.push({
          appId: app.id,
          appName: app.name,
          success: false,
          error: errorMessage,
          durationMs: Date.now() - appStartTime,
        })
      }
    }

    // 4. Return summary
    const completedAt = new Date().toISOString()
    const durationMs = Date.now() - startTime

    logger.info("cron_job_completed", {
      job: "review-ingestion",
      total: apps.length,
      succeeded,
      failed,
      skipped,
      durationMs,
    })

    return NextResponse.json({
      success: failed === 0,
      message: `Processed ${apps.length} apps: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`,
      startedAt,
      completedAt,
      durationMs,
      results: {
        total: apps.length,
        succeeded,
        failed,
        skipped,
      },
      details: results,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    logger.error("cron_job_failed", error, {
      job: "review-ingestion",
    })

    return NextResponse.json(
      {
        success: false,
        message: `Job failed: ${errorMessage}`,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        results: {
          total: results.length,
          succeeded,
          failed,
          skipped,
        },
        details: results,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/jobs/review-ingestion
 *
 * Health check endpoint for the cron job.
 * Returns configuration info (without sensitive data).
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Only allow in development or with secret
  if (process.env.NODE_ENV === "production" && !verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const eligibleApps = await getEligibleApps()

  return NextResponse.json({
    status: "ok",
    job: "review-ingestion",
    config: {
      maxAppsPerRun: MAX_APPS_PER_RUN,
      delayBetweenAppsMs: DELAY_BETWEEN_APPS,
    },
    eligibleApps: eligibleApps.length,
    nextApps: eligibleApps.slice(0, 5).map((app) => ({
      id: app.id,
      name: app.name,
      lastSyncedAt: app.lastSyncedAt?.toISOString() || null,
    })),
  })
}
