import { PrismaClient } from "@prisma/client"
import { readFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const prisma = new PrismaClient()

// =============================================================================
// Types for prototype JSON files
// =============================================================================

interface PrototypeReview {
  id: string
  author: string
  rating: string
  version: string
  title: string
  content: string
  updated: string
  vote_sum: string
  vote_count: string
}

interface PrototypeReviewsFile {
  metadata: {
    app_id: string
    sort_by: string
    fetch_timestamp: string
    total_pages: number
    total_reviews: number
    app_name: string
  }
  reviews: PrototypeReview[]
}

interface PrototypeAnalysisFile {
  app_id: string
  analysis_date: string
  total_reviews_analyzed: number
  ratings: {
    distribution: Record<string, number>
    total_reviews: number
    average_rating: number
    median_rating: number
    low_ratings_count: number
    high_ratings_count: number
  }
  trends: {
    monthly_trends: Record<string, { count: number; avg_rating: number }>
    recent_trend: string
    recent_avg_rating: number
  }
  issues: {
    issue_categories: Record<
      string,
      {
        count: number
        examples: Array<{ rating: string; excerpt: string }>
      }
    >
    total_issues_found: number
    feature_requests_count: number
    feature_request_samples: Array<{ rating: string; excerpt: string }>
  }
  positives: {
    top_positive_aspects: Record<string, number>
    total_positive_reviews: number
  }
  llm_insights: {
    complaints: Array<{ complaint: string; count: number }>
    feature_requests: Array<{ request: string; count: number }>
    main_opportunity: string
  }
  app_name: string
}

// =============================================================================
// Helper functions
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

function mapReviewSource(sortBy: string): "MOST_RECENT" | "MOST_HELPFUL" | "UNKNOWN" {
  switch (sortBy) {
    case "mostrecent":
      return "MOST_RECENT"
    case "mosthelpful":
      return "MOST_HELPFUL"
    default:
      return "UNKNOWN"
  }
}

function mapIssueCategoryToThemeKey(category: string): string {
  // Normalize category keys to consistent format
  return category.toLowerCase().replace(/[^a-z0-9]/g, "_")
}

function computeSentimentCounts(distribution: Record<string, number>): {
  positiveCount: number
  neutralCount: number
  negativeCount: number
} {
  // 4-5 stars = positive, 3 stars = neutral, 1-2 stars = negative
  const d = distribution
  return {
    positiveCount: (d["4"] || 0) + (d["5"] || 0),
    neutralCount: d["3"] || 0,
    negativeCount: (d["1"] || 0) + (d["2"] || 0),
  }
}

function determinePriority(count: number): "LOW" | "MEDIUM" | "HIGH" {
  if (count >= 10) return "HIGH"
  if (count >= 5) return "MEDIUM"
  return "LOW"
}

// =============================================================================
// Data loading
// =============================================================================

function loadJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) {
    console.warn(`  Warning: File not found: ${path}`)
    return null
  }
  try {
    const content = readFileSync(path, "utf-8")
    return JSON.parse(content) as T
  } catch (error) {
    console.error(`  Error loading JSON from ${path}:`, error)
    return null
  }
}

function getPrototypeDir(): string {
  // Check if we're running from project root or elsewhere
  const possiblePaths = [
    resolve(process.cwd(), "prototype/review-analyzer"),
    resolve(dirname(fileURLToPath(import.meta.url)), "../prototype/review-analyzer"),
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path
    }
  }

  // Fallback to first path
  return possiblePaths[0]
}

// =============================================================================
// Seed functions
// =============================================================================

async function seedDemoUser() {
  console.log("Creating demo user...")

  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      name: "Demo User",
      emailVerified: new Date(),
    },
  })

  console.log(`  Created/found user: ${user.email} (${user.id})`)
  return user
}

async function seedWorkspace(userId: string) {
  console.log("Creating demo workspace...")

  const slug = "demo-workspace"

  // Check if workspace already exists
  let workspace = await prisma.workspace.findUnique({
    where: { slug },
  })

  if (workspace) {
    console.log(`  Found existing workspace: ${workspace.name} (${workspace.id})`)
    return workspace
  }

  workspace = await prisma.workspace.create({
    data: {
      name: "Demo Workspace",
      slug,
      plan: "STARTER",
      appLimit: 5, // Give demo workspace more room
      analysisLimitPerMonth: 10,
      reviewLimitPerRun: 500,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
  })

  console.log(`  Created workspace: ${workspace.name} (${workspace.id})`)
  return workspace
}

async function seedApp(workspaceId: string, appData: { appId: string; appName: string }) {
  console.log("Creating demo app...")

  const cleanName = appData.appName.replace("iTunes Store:", "").trim() || "The StoryGraph"
  const appSlug = slugify(cleanName)

  // Check if app already exists
  let app = await prisma.app.findUnique({
    where: {
      workspaceId_appStoreId: {
        workspaceId,
        appStoreId: appData.appId,
      },
    },
  })

  if (app) {
    console.log(`  Found existing app: ${app.name} (${app.id})`)
    return app
  }

  app = await prisma.app.create({
    data: {
      workspaceId,
      platform: "IOS",
      appStoreId: appData.appId,
      name: cleanName,
      slug: appSlug,
      developerName: "The StoryGraph Ltd",
      primaryCategory: "Books",
      storeUrl: `https://apps.apple.com/app/id${appData.appId}`,
      status: "ACTIVE",
    },
  })

  console.log(`  Created app: ${app.name} (${app.id})`)
  return app
}

interface MergedReview extends PrototypeReview {
  source: "MOST_RECENT" | "MOST_HELPFUL" | "UNKNOWN"
}

/**
 * Merge reviews from multiple sources with deduplication.
 * Reviews appearing in both sources will prefer MOST_HELPFUL as the source.
 */
function mergeReviews(
  mostRecentData: PrototypeReviewsFile | null,
  mostHelpfulData: PrototypeReviewsFile | null
): MergedReview[] {
  const reviewMap = new Map<string, MergedReview>()

  // Add most_recent reviews first
  if (mostRecentData) {
    for (const review of mostRecentData.reviews) {
      reviewMap.set(review.id, { ...review, source: "MOST_RECENT" })
    }
  }

  // Add/override with most_helpful reviews (these take precedence)
  if (mostHelpfulData) {
    for (const review of mostHelpfulData.reviews) {
      reviewMap.set(review.id, { ...review, source: "MOST_HELPFUL" })
    }
  }

  return Array.from(reviewMap.values())
}

async function seedAllReviews(
  workspaceId: string,
  appId: string,
  mostRecentData: PrototypeReviewsFile | null,
  mostHelpfulData: PrototypeReviewsFile | null
) {
  console.log("Importing all reviews from prototype data...")

  // Merge and deduplicate reviews
  const mergedReviews = mergeReviews(mostRecentData, mostHelpfulData)
  console.log(`  Total unique reviews to import: ${mergedReviews.length}`)

  if (mostRecentData) {
    console.log(`    - From most_recent: ${mostRecentData.reviews.length}`)
  }
  if (mostHelpfulData) {
    console.log(`    - From most_helpful: ${mostHelpfulData.reviews.length}`)
  }

  // Get existing review IDs to skip
  const existingReviews = await prisma.review.findMany({
    where: { appId },
    select: { externalReviewId: true },
  })
  const existingIds = new Set(existingReviews.map((r) => r.externalReviewId))

  // Filter out already imported reviews
  const newReviews = mergedReviews.filter((r) => !existingIds.has(r.id))
  const skipped = mergedReviews.length - newReviews.length

  if (newReviews.length === 0) {
    console.log(`  All ${mergedReviews.length} reviews already exist, skipping`)
    return { created: 0, skipped }
  }

  console.log(`  Importing ${newReviews.length} new reviews (${skipped} already exist)...`)

  // Batch insert for better performance
  const BATCH_SIZE = 100
  let created = 0

  for (let i = 0; i < newReviews.length; i += BATCH_SIZE) {
    const batch = newReviews.slice(i, i + BATCH_SIZE)

    await prisma.review.createMany({
      data: batch.map((review) => ({
        workspaceId,
        appId,
        externalReviewId: review.id,
        rating: parseInt(review.rating, 10),
        title: review.title,
        body: review.content,
        author: review.author,
        version: review.version,
        publishedAt: new Date(review.updated),
        source: review.source,
        metadata: {
          vote_sum: review.vote_sum,
          vote_count: review.vote_count,
        },
      })),
      skipDuplicates: true,
    })

    created += batch.length
    if (newReviews.length > BATCH_SIZE) {
      console.log(`    Progress: ${Math.min(created, newReviews.length)}/${newReviews.length}`)
    }
  }

  // Log source distribution
  const sourceCount = {
    MOST_RECENT: newReviews.filter((r) => r.source === "MOST_RECENT").length,
    MOST_HELPFUL: newReviews.filter((r) => r.source === "MOST_HELPFUL").length,
  }
  console.log(`  Created ${created} reviews:`)
  console.log(`    - MOST_RECENT: ${sourceCount.MOST_RECENT}`)
  console.log(`    - MOST_HELPFUL: ${sourceCount.MOST_HELPFUL}`)

  return { created, skipped }
}

async function seedReviewSnapshot(
  workspaceId: string,
  appId: string,
  analysisData: PrototypeAnalysisFile,
  reviewIds: string[]
) {
  console.log("Creating review snapshot...")

  const { positiveCount, neutralCount, negativeCount } = computeSentimentCounts(
    analysisData.ratings.distribution
  )

  // Check if we already have a snapshot for this app
  const existingCount = await prisma.reviewSnapshot.count({
    where: { appId },
  })

  if (existingCount > 0) {
    console.log(`  Found ${existingCount} existing snapshots, skipping creation`)
    const existing = await prisma.reviewSnapshot.findFirst({
      where: { appId },
      orderBy: { createdAt: "desc" },
    })
    return existing
  }

  const snapshot = await prisma.reviewSnapshot.create({
    data: {
      workspaceId,
      appId,
      status: "SUCCEEDED",
      analysisRangeStart: new Date("2024-09-01"),
      analysisRangeEnd: new Date(analysisData.analysis_date),
      reviewCount: analysisData.total_reviews_analyzed,
      positiveCount,
      neutralCount,
      negativeCount,
      sourceReviewIds: reviewIds,
      ratingsDistribution: analysisData.ratings.distribution,
      trends: analysisData.trends,
      aiSummary: analysisData.llm_insights.main_opportunity,
      rawInsights: analysisData.llm_insights,
    },
  })

  console.log(`  Created snapshot: ${snapshot.id}`)
  return snapshot
}

async function seedInsights(
  workspaceId: string,
  snapshotId: string,
  analysisData: PrototypeAnalysisFile
) {
  console.log("Creating insights...")

  // Check if insights already exist
  const existingCount = await prisma.reviewSnapshotInsight.count({
    where: { reviewSnapshotId: snapshotId },
  })

  if (existingCount > 0) {
    console.log(`  Found ${existingCount} existing insights, skipping creation`)
    return existingCount
  }

  const insightsToCreate: Array<{
    reviewSnapshotId: string
    workspaceId: string
    type: "FEATURE_REQUEST" | "BUG_OR_COMPLAINT" | "PRAISE" | "USABILITY_ISSUE" | "OTHER"
    priority: "LOW" | "MEDIUM" | "HIGH"
    title: string
    description?: string
    supportingReviewCount: number
    themeKey?: string
  }> = []

  // Map LLM complaints to BUG_OR_COMPLAINT insights
  for (const complaint of analysisData.llm_insights.complaints) {
    insightsToCreate.push({
      reviewSnapshotId: snapshotId,
      workspaceId,
      type: "BUG_OR_COMPLAINT",
      priority: determinePriority(complaint.count),
      title: complaint.complaint,
      supportingReviewCount: complaint.count,
      themeKey: mapIssueCategoryToThemeKey(complaint.complaint),
    })
  }

  // Map LLM feature requests to FEATURE_REQUEST insights
  for (const request of analysisData.llm_insights.feature_requests) {
    insightsToCreate.push({
      reviewSnapshotId: snapshotId,
      workspaceId,
      type: "FEATURE_REQUEST",
      priority: determinePriority(request.count),
      title: request.request,
      supportingReviewCount: request.count,
      themeKey: mapIssueCategoryToThemeKey(request.request),
    })
  }

  // Map positive aspects to PRAISE insights
  for (const [aspect, count] of Object.entries(
    analysisData.positives.top_positive_aspects
  )) {
    insightsToCreate.push({
      reviewSnapshotId: snapshotId,
      workspaceId,
      type: "PRAISE",
      priority: determinePriority(count),
      title: aspect.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      supportingReviewCount: count,
      themeKey: mapIssueCategoryToThemeKey(aspect),
    })
  }

  // Map issue categories to BUG_OR_COMPLAINT or USABILITY_ISSUE insights
  for (const [category, data] of Object.entries(
    analysisData.issues.issue_categories
  )) {
    const type =
      category === "ui_ux" || category === "performance"
        ? "USABILITY_ISSUE"
        : "BUG_OR_COMPLAINT"

    // Build description from examples
    const description =
      data.examples.length > 0
        ? data.examples.map((ex) => `"${ex.excerpt}" (${ex.rating}★)`).join("\n\n")
        : undefined

    insightsToCreate.push({
      reviewSnapshotId: snapshotId,
      workspaceId,
      type,
      priority: determinePriority(data.count),
      title: category.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      description,
      supportingReviewCount: data.count,
      themeKey: mapIssueCategoryToThemeKey(category),
    })
  }

  // Create all insights
  await prisma.reviewSnapshotInsight.createMany({
    data: insightsToCreate,
  })

  console.log(`  Created ${insightsToCreate.length} insights`)
  return insightsToCreate.length
}

// =============================================================================
// Main seed function
// =============================================================================

async function main() {
  console.log("\n🌱 Starting database seed...\n")

  // Determine data source paths
  const prototypeDir = getPrototypeDir()
  const analysisPath =
    process.env.SEED_ANALYSIS_PATH ||
    resolve(prototypeDir, "1570489264_analysis_20250804_211412.json")
  const mostRecentPath =
    process.env.SEED_MOST_RECENT_PATH ||
    resolve(prototypeDir, "1570489264_most_recent.json")
  const mostHelpfulPath =
    process.env.SEED_MOST_HELPFUL_PATH ||
    resolve(prototypeDir, "1570489264_most_helpful.json")

  console.log(`Loading data from:`)
  console.log(`  Analysis:     ${analysisPath}`)
  console.log(`  Most Recent:  ${mostRecentPath}`)
  console.log(`  Most Helpful: ${mostHelpfulPath}\n`)

  // Load prototype data
  const analysisData = loadJsonFile<PrototypeAnalysisFile>(analysisPath)
  const mostRecentData = loadJsonFile<PrototypeReviewsFile>(mostRecentPath)
  const mostHelpfulData = loadJsonFile<PrototypeReviewsFile>(mostHelpfulPath)

  if (!analysisData && !mostRecentData && !mostHelpfulData) {
    console.log("No prototype data files found. Creating minimal seed data...\n")
  }

  // Create demo user
  const user = await seedDemoUser()

  // Create workspace
  const workspace = await seedWorkspace(user.id)

  // Create app
  const appData = {
    appId: analysisData?.app_id || mostRecentData?.metadata.app_id || "1570489264",
    appName: analysisData?.app_name || mostRecentData?.metadata.app_name || "The StoryGraph",
  }
  const app = await seedApp(workspace.id, appData)

  // Update app with rating data if available
  if (analysisData) {
    await prisma.app.update({
      where: { id: app.id },
      data: {
        averageRating: analysisData.ratings.average_rating,
        ratingCount: analysisData.ratings.total_reviews,
        lastSyncedAt: new Date(),
      },
    })
    console.log(`  Updated app ratings: ${analysisData.ratings.average_rating}★\n`)
  }

  // Import ALL reviews from both files
  if (mostRecentData || mostHelpfulData) {
    await seedAllReviews(workspace.id, app.id, mostRecentData, mostHelpfulData)
    console.log()
  }

  // Get review IDs for the snapshot
  const reviews = await prisma.review.findMany({
    where: { appId: app.id },
    select: { id: true },
  })
  const reviewIds = reviews.map((r) => r.id)

  // Create review snapshot
  if (analysisData) {
    const snapshot = await seedReviewSnapshot(workspace.id, app.id, analysisData, reviewIds)

    // Create insights
    if (snapshot) {
      await seedInsights(workspace.id, snapshot.id, analysisData)
    }
  }

  // Print summary with rating breakdown
  console.log("\n✅ Seed completed successfully!\n")
  console.log("Summary:")
  console.log(`  - User: ${user.email}`)
  console.log(`  - Workspace: ${workspace.name} (${workspace.slug})`)
  console.log(`  - App: ${app.name} (App Store ID: ${app.appStoreId})`)

  const reviewCount = await prisma.review.count({ where: { appId: app.id } })
  const snapshotCount = await prisma.reviewSnapshot.count({ where: { appId: app.id } })
  const insightCount = await prisma.reviewSnapshotInsight.count({
    where: { workspaceId: workspace.id },
  })

  // Get rating distribution
  const ratingDist = await prisma.review.groupBy({
    by: ["rating"],
    where: { appId: app.id },
    _count: { rating: true },
    orderBy: { rating: "desc" },
  })

  console.log(`  - Reviews: ${reviewCount}`)
  if (ratingDist.length > 0) {
    console.log("    Rating breakdown:")
    for (const { rating, _count } of ratingDist) {
      const bar = "█".repeat(Math.ceil(_count.rating / 20))
      console.log(`      ${rating}★: ${bar} ${_count.rating}`)
    }
  }

  // Get source distribution
  const sourceDist = await prisma.review.groupBy({
    by: ["source"],
    where: { appId: app.id },
    _count: { source: true },
  })
  if (sourceDist.length > 0) {
    console.log("    Source breakdown:")
    for (const { source, _count } of sourceDist) {
      console.log(`      ${source}: ${_count.source}`)
    }
  }

  console.log(`  - Snapshots: ${snapshotCount}`)
  console.log(`  - Insights: ${insightCount}`)
  console.log()
}

main()
  .catch((e) => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
