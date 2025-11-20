import {
  PrismaClient,
  AppPlatform,
  AppStatus,
  UserRole,
  WorkspacePlan,
  WorkspaceRole,
} from "@prisma/client"
import { readFileSync } from "fs"
import { join } from "path"
import {
  mapReviewsFromFile,
  deduplicateReviews,
  type RawReviewsData,
} from "../lib/data-mappers/review-mapper"
import {
  mapAnalysisToPrisma,
  type RawAnalysisData,
} from "../lib/data-mappers/analysis-mapper"
import {
  matchExcerptToReviews,
  calculateMatchingStats,
  type ExcerptMatchResult,
} from "../lib/data-mappers/excerpt-matcher"
import { PLAN_LIMITS } from "../config/plan-limits"

const prisma = new PrismaClient()

/**
 * Generate a unique slug from a name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

/**
 * Ensure slug is unique by appending a number if needed
 */
async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug
  let counter = 1

  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`
    counter++
  }

  return slug
}

/**
 * Get or create a default workspace for the seed user
 */
async function getOrCreateDefaultWorkspace(userId: string, userName: string | null) {
  // Check if user already has a workspace where they're the owner
  const existingWorkspace = await prisma.workspace.findFirst({
    where: {
      ownerId: userId,
      deletedAt: null,
    },
    include: {
      members: {
        where: { userId },
      },
    },
  })

  if (existingWorkspace) {
    return existingWorkspace
  }

  const workspaceName = `${userName || "Personal"}'s Workspace`
  const slug = await ensureUniqueSlug(generateSlug(workspaceName))

  // Get default plan limits
  const planLimits = PLAN_LIMITS[WorkspacePlan.STARTER]

  // Create workspace with default plan
  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      slug,
      plan: WorkspacePlan.STARTER,
      ownerId: userId,
      appLimit: planLimits.maxApps,
      analysisLimitPerMonth: planLimits.maxAnalysesPerMonth,
      reviewLimitPerRun: planLimits.maxReviewsPerRun,
      members: {
        create: {
          userId,
          role: WorkspaceRole.OWNER,
        },
      },
    },
    include: {
      members: true,
    },
  })

  return workspace
}

/**
 * Main seed function
 */
async function main() {
  console.log("🌱 Starting database seed...")
  console.log("")

  // ============================================================================
  // Step 1: Ensure demo user exists
  // ============================================================================
  console.log("👤 Step 1: Creating/finding demo user...")

  let demoUser = await prisma.user.findFirst({
    where: { email: "demo@appanalyzer.dev" },
  })

  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        email: "demo@appanalyzer.dev",
        name: "Demo User",
        role: UserRole.USER,
        emailVerified: new Date(),
      },
    })
    console.log(`✅ Created demo user: ${demoUser.email}`)
  } else {
    console.log(`✅ Found existing demo user: ${demoUser.email}`)
  }
  console.log("")

  // ============================================================================
  // Step 2: Create/find default workspace
  // ============================================================================
  console.log("🏢 Step 2: Creating/finding workspace...")

  const workspace = await getOrCreateDefaultWorkspace(demoUser.id, demoUser.name)
  console.log(`✅ Workspace: ${workspace.name} (${workspace.slug})`)
  console.log(`   Plan: ${workspace.plan}`)
  console.log(`   Limits: ${workspace.appLimit} apps, ${workspace.analysisLimitPerMonth} analyses/month`)
  console.log("")

  // ============================================================================
  // Step 3: Create StoryGraph app
  // ============================================================================
  console.log("📱 Step 3: Creating StoryGraph app...")

  const appStoreId = "1570489264"
  let app = await prisma.app.findFirst({
    where: {
      workspaceId: workspace.id,
      appStoreId,
    },
  })

  if (!app) {
    app = await prisma.app.create({
      data: {
        workspaceId: workspace.id,
        platform: AppPlatform.IOS,
        appStoreId,
        name: "StoryGraph",
        slug: "storygraph",
        developerName: "StoryGraph",
        primaryCategory: "Books",
        status: AppStatus.ACTIVE,
      },
    })
    console.log(`✅ Created app: ${app.name} (${app.appStoreId})`)
  } else {
    console.log(`✅ Found existing app: ${app.name} (${app.appStoreId})`)
  }
  console.log("")

  // ============================================================================
  // Step 4: Ingest raw reviews
  // ============================================================================
  console.log("📝 Step 4: Ingesting raw reviews...")

  const prototypeDir = join(__dirname, "..", "prototype", "review-analyzer")

  // Read both review files
  const mostRecentPath = join(prototypeDir, "1570489264_most_recent.json")
  const mostHelpfulPath = join(prototypeDir, "1570489264_most_helpful.json")

  console.log(`   Reading: ${mostRecentPath}`)
  const mostRecentData: RawReviewsData = JSON.parse(
    readFileSync(mostRecentPath, "utf-8")
  )
  console.log(`   Found ${mostRecentData.reviews.length} most recent reviews`)

  console.log(`   Reading: ${mostHelpfulPath}`)
  const mostHelpfulData: RawReviewsData = JSON.parse(
    readFileSync(mostHelpfulPath, "utf-8")
  )
  console.log(`   Found ${mostHelpfulData.reviews.length} most helpful reviews`)

  // Map reviews to Prisma format
  const mostRecentReviews = mapReviewsFromFile(mostRecentData, workspace.id, app.id)
  const mostHelpfulReviews = mapReviewsFromFile(mostHelpfulData, workspace.id, app.id)

  // Deduplicate (some reviews may appear in both files)
  const allReviews = deduplicateReviews([...mostRecentReviews, ...mostHelpfulReviews])
  console.log(`   Total unique reviews: ${allReviews.length}`)

  // Check if reviews already exist
  const existingReviewCount = await prisma.review.count({
    where: { appId: app.id },
  })

  if (existingReviewCount === 0) {
    console.log(`   Inserting ${allReviews.length} reviews...`)

    // Convert to flat data for createMany (which doesn't support nested relations)
    const flatReviews = allReviews.map((review) => ({
      workspaceId: workspace.id,
      appId: app.id,
      externalReviewId: review.externalReviewId,
      rating: review.rating,
      title: review.title,
      content: review.content,
      author: review.author,
      version: review.version,
      publishedAt: review.publishedAt,
      voteSum: review.voteSum,
      voteCount: review.voteCount,
      source: review.source,
      metadata: review.metadata,
    }))

    // Insert in batches to avoid memory issues
    const batchSize = 100
    let inserted = 0
    for (let i = 0; i < flatReviews.length; i += batchSize) {
      const batch = flatReviews.slice(i, i + batchSize)
      await prisma.review.createMany({
        data: batch,
        skipDuplicates: true,
      })
      inserted += batch.length
      process.stdout.write(`\r   Inserted ${inserted}/${flatReviews.length} reviews...`)
    }
    console.log("")
    console.log(`✅ Inserted ${inserted} reviews`)
  } else {
    console.log(`✅ Reviews already exist (${existingReviewCount} found)`)
  }
  console.log("")

  // ============================================================================
  // Step 5: Ingest analysis data
  // ============================================================================
  console.log("📊 Step 5: Ingesting analysis data...")

  // Use the latest analysis file
  const analysisPath = join(prototypeDir, "1570489264_analysis_20250804_211412.json")
  console.log(`   Reading: ${analysisPath}`)

  const analysisData: RawAnalysisData = JSON.parse(readFileSync(analysisPath, "utf-8"))
  console.log(`   Analysis date: ${analysisData.analysis_date}`)
  console.log(`   Total reviews analyzed: ${analysisData.total_reviews_analyzed}`)

  // Check if analysis already exists
  const existingSnapshot = await prisma.reviewSnapshot.findFirst({
    where: {
      appId: app.id,
      analysisDate: new Date(analysisData.analysis_date),
    },
  })

  if (existingSnapshot) {
    console.log(`✅ Analysis already exists (ID: ${existingSnapshot.id})`)
    console.log("")
  } else {
    // Map analysis to Prisma format
    const mappedAnalysis = mapAnalysisToPrisma(analysisData, workspace.id, app.id)

    // Create ReviewSnapshot with all related data
    const snapshot = await prisma.reviewSnapshot.create({
      data: {
        ...mappedAnalysis.snapshot,
        workspace: { connect: { id: workspace.id } },
        app: { connect: { id: app.id } },
        ratingDistribution: {
          create: mappedAnalysis.ratingDistribution,
        },
        monthlyTrends: {
          create: mappedAnalysis.monthlyTrends,
        },
        positiveAspects: {
          create: mappedAnalysis.positiveAspects,
        },
        ...(mappedAnalysis.llmInsight && {
          llmInsight: {
            create: mappedAnalysis.llmInsight,
          },
        }),
      },
    })

    console.log(`✅ Created ReviewSnapshot: ${snapshot.id}`)
    console.log(`   Status: ${snapshot.status}`)
    console.log(`   Rating distribution created: ${mappedAnalysis.ratingDistribution.totalReviews} reviews`)
    console.log(`   Monthly trends: ${mappedAnalysis.monthlyTrends.length} months`)
    console.log(`   Positive aspects: ${mappedAnalysis.positiveAspects.length}`)

    // ============================================================================
    // Step 6: Create insights and match to reviews
    // ============================================================================
    console.log("")
    console.log("🔍 Step 6: Creating insights and matching to reviews...")

    // Fetch all reviews for matching
    const reviews = await prisma.review.findMany({
      where: { appId: app.id },
    })
    console.log(`   Loaded ${reviews.length} reviews for matching`)

    // Create insights and collect excerpts for matching
    const insightsToMatch: Array<{
      insight: any
      excerpt: string | null
      rating?: number
    }> = []

    for (const insightData of mappedAnalysis.insights) {
      const insight = await prisma.reviewSnapshotInsight.create({
        data: {
          ...insightData,
          reviewSnapshot: { connect: { id: snapshot.id } },
          workspace: { connect: { id: workspace.id } },
        },
      })

      if (insightData.rawExcerpt) {
        insightsToMatch.push({
          insight,
          excerpt: insightData.rawExcerpt,
        })
      }
    }

    console.log(`✅ Created ${mappedAnalysis.insights.length} insights`)

    // Match excerpts to reviews
    if (insightsToMatch.length > 0) {
      console.log(`   Matching ${insightsToMatch.length} excerpts to reviews...`)

      let totalMatches = 0
      const matchResults: ExcerptMatchResult[] = []

      for (const { insight, excerpt } of insightsToMatch) {
        if (!excerpt) continue

        const matchResult = matchExcerptToReviews(excerpt, reviews, 0.6)
        matchResults.push(matchResult)

        if (matchResult.matched && matchResult.reviewId) {
          await prisma.reviewInsightLink.create({
            data: {
              insightId: insight.id,
              reviewId: matchResult.reviewId,
              relevanceScore: matchResult.confidence,
            },
          })
          totalMatches++
        }
      }

      // Calculate and display matching statistics
      const stats = calculateMatchingStats(matchResults)
      console.log("")
      console.log(`   Matching Statistics:`)
      console.log(`   - Total excerpts: ${stats.totalExcerpts}`)
      console.log(`   - Exact matches: ${stats.exactMatches}`)
      console.log(`   - Fuzzy matches: ${stats.fuzzyMatches}`)
      console.log(`   - Unmatched: ${stats.unmatched}`)
      console.log(`   - Average confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`)
      console.log(`✅ Created ${totalMatches} insight-review links`)
    }
  }

  console.log("")
  console.log("=" .repeat(60))
  console.log("🎉 Seed completed successfully!")
  console.log("")
  console.log("Summary:")
  console.log(`  User: ${demoUser.email}`)
  console.log(`  Workspace: ${workspace.name}`)
  console.log(`  App: ${app.name} (${app.appStoreId})`)

  const finalReviewCount = await prisma.review.count({ where: { appId: app.id } })
  const finalSnapshotCount = await prisma.reviewSnapshot.count({ where: { appId: app.id } })
  const finalInsightCount = await prisma.reviewSnapshotInsight.count({
    where: { workspaceId: workspace.id },
  })
  const finalLinkCount = await prisma.reviewInsightLink.count()

  console.log(`  Reviews: ${finalReviewCount}`)
  console.log(`  Snapshots: ${finalSnapshotCount}`)
  console.log(`  Insights: ${finalInsightCount}`)
  console.log(`  Insight Links: ${finalLinkCount}`)
  console.log("")
  console.log("You can now explore the data with: npx prisma studio")
  console.log("=" .repeat(60))
}

// Execute seed function
main()
  .catch((error) => {
    console.error("")
    console.error("❌ Seed failed with error:")
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
