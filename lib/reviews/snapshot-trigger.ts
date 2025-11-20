/**
 * Review Snapshot Trigger
 *
 * Stub for Task 4 - AI Analysis & Snapshot Generation
 *
 * Creates a pending ReviewSnapshot after successful review ingestion.
 * The actual AI analysis will be implemented in Task 4.
 */

import { prisma } from "@/lib/db"

/**
 * Queue a review snapshot for analysis
 *
 * Creates a ReviewSnapshot record with PENDING status.
 * Task 4 will implement the actual analysis worker that processes these.
 *
 * @param appId - App ID to analyze
 * @param ingestionRunId - ID of the ingestion run that triggered this
 * @returns Snapshot ID
 */
export async function queueReviewSnapshot(
  appId: string,
  ingestionRunId: string
): Promise<string> {
  // Get app and review count
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: {
      _count: {
        select: {
          reviews: true,
        },
      },
    },
  })

  if (!app) {
    throw new Error(`App not found: ${appId}`)
  }

  // Determine date range for analysis
  // For now, analyze all reviews. Task 4 may add time-based filtering.
  const oldestReview = await prisma.review.findFirst({
    where: { appId },
    orderBy: { publishedAt: "asc" },
    select: { publishedAt: true },
  })

  const newestReview = await prisma.review.findFirst({
    where: { appId },
    orderBy: { publishedAt: "desc" },
    select: { publishedAt: true },
  })

  // Create snapshot record
  const snapshot = await prisma.reviewSnapshot.create({
    data: {
      workspaceId: app.workspaceId,
      appId: app.id,
      status: "PENDING",
      analysisDate: new Date(),
      analysisRangeStart: oldestReview?.publishedAt || new Date(),
      analysisRangeEnd: newestReview?.publishedAt || new Date(),
      totalReviewsAnalyzed: app._count.reviews,
      positiveCount: 0,
      neutralCount: 0,
      negativeCount: 0,
    },
  })

  console.log(`[Snapshot] Created pending snapshot ${snapshot.id} for app ${appId}`)
  console.log(`[Snapshot] ${app._count.reviews} reviews ready for analysis`)
  console.log("[Snapshot] Task 4 will implement the AI analysis worker")

  return snapshot.id
}

/**
 * Get pending snapshots for processing
 *
 * Task 4 will use this to find snapshots that need analysis.
 */
export async function getPendingSnapshots(limit = 10) {
  return prisma.reviewSnapshot.findMany({
    where: {
      status: "PENDING",
    },
    orderBy: {
      analysisDate: "asc",
    },
    take: limit,
    include: {
      app: {
        select: {
          id: true,
          name: true,
          appStoreId: true,
        },
      },
    },
  })
}
