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
 * Test user configurations for different scenarios
 */
const TEST_USERS = [
  {
    email: "owner@starter.dev",
    name: "Owner (Starter - Empty)",
    plan: WorkspacePlan.STARTER,
    role: WorkspaceRole.OWNER,
    appsToCreate: 0, // Empty workspace
    description: "STARTER plan with no apps - test adding first app",
  },
  {
    email: "owner@starter-limit.dev",
    name: "Owner (Starter - At Limit)",
    plan: WorkspacePlan.STARTER,
    role: WorkspaceRole.OWNER,
    appsToCreate: 1, // At limit (1/1)
    description: "STARTER plan at limit - test limit enforcement",
  },
  {
    email: "owner@pro.dev",
    name: "Owner (Pro)",
    plan: WorkspacePlan.PRO,
    role: WorkspaceRole.OWNER,
    appsToCreate: 3, // Room to add more (3/10)
    description: "PRO plan with room - test normal operations",
  },
  {
    email: "owner@business.dev",
    name: "Owner (Business)",
    plan: WorkspacePlan.BUSINESS,
    role: WorkspaceRole.OWNER,
    appsToCreate: 5, // Plenty of room (5/50)
    description: "BUSINESS plan - test large-scale operations",
  },
  {
    email: "admin@pro.dev",
    name: "Admin (Pro)",
    plan: WorkspacePlan.PRO,
    role: WorkspaceRole.ADMIN,
    appsToCreate: 2, // Some apps (2/10)
    description: "ADMIN role - test admin permissions",
  },
  {
    email: "member@pro.dev",
    name: "Member (Pro)",
    plan: WorkspacePlan.PRO,
    role: WorkspaceRole.MEMBER,
    appsToCreate: 2, // Some apps (2/10)
    description: "MEMBER role - test member permissions",
  },
  {
    email: "viewer@pro.dev",
    name: "Viewer (Pro)",
    plan: WorkspacePlan.PRO,
    role: WorkspaceRole.VIEWER,
    appsToCreate: 2, // Some apps to view (2/10)
    description: "VIEWER role - test read-only access",
  },
] as const

/**
 * Sample apps for test users (simple metadata only)
 */
const SAMPLE_APPS = [
  {
    appStoreId: "1570489264",
    name: "StoryGraph",
    developerName: "StoryGraph",
    category: "Books",
  },
  {
    appStoreId: "310633997",
    name: "WhatsApp Messenger",
    developerName: "WhatsApp Inc.",
    category: "Social Networking",
  },
  {
    appStoreId: "389801252",
    name: "Instagram",
    developerName: "Instagram, Inc.",
    category: "Photo & Video",
  },
  {
    appStoreId: "544007664",
    name: "YouTube",
    developerName: "Google LLC",
    category: "Photo & Video",
  },
  {
    appStoreId: "1482920575",
    name: "Duolingo",
    developerName: "Duolingo",
    category: "Education",
  },
]

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
 * Create or get a user
 */
async function getOrCreateUser(email: string, name: string) {
  let user = await prisma.user.findFirst({ where: { email } })

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
        role: UserRole.USER,
        emailVerified: new Date(),
      },
    })
    console.log(`✅ Created user: ${email}`)
  } else {
    console.log(`✅ Found existing user: ${email}`)
  }

  return user
}

/**
 * Create workspace for a test user
 */
async function createWorkspaceForUser(
  userId: string,
  userName: string,
  plan: WorkspacePlan,
  role: WorkspaceRole
) {
  const workspaceName = `${userName}'s Workspace`
  const slug = await ensureUniqueSlug(generateSlug(workspaceName))
  const planLimits = PLAN_LIMITS[plan]

  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      slug,
      plan,
      ownerId: userId,
      appLimit: planLimits.maxApps,
      analysisLimitPerMonth: planLimits.maxAnalysesPerMonth,
      reviewLimitPerRun: planLimits.maxReviewsPerRun,
      members: {
        create: {
          userId,
          role,
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
 * Create simple app for testing
 */
async function createSimpleApp(
  workspaceId: string,
  appStoreId: string,
  name: string,
  developerName: string,
  category: string
) {
  const existing = await prisma.app.findFirst({
    where: { workspaceId, appStoreId },
  })

  if (existing) {
    return existing
  }

  return prisma.app.create({
    data: {
      workspaceId,
      platform: AppPlatform.IOS,
      appStoreId,
      name,
      slug: generateSlug(name),
      developerName,
      category,
      status: AppStatus.ACTIVE,
    },
  })
}

/**
 * Main seed function
 */
async function main() {
  console.log("🌱 Starting database seed with test user matrix...")
  console.log("")

  // ============================================================================
  // Create all test users with their workspaces and apps
  // ============================================================================
  console.log("👥 Creating test users...")
  console.log("")

  const createdUsers: Array<{
    user: any
    workspace: any
    config: (typeof TEST_USERS)[number]
  }> = []

  for (const config of TEST_USERS) {
    console.log(`📋 Setting up: ${config.email}`)
    console.log(`   ${config.description}`)

    // Create user
    const user = await getOrCreateUser(config.email, config.name)

    // Check if workspace already exists
    let workspace = await prisma.workspace.findFirst({
      where: {
        members: { some: { userId: user.id } },
      },
      include: { members: true },
    })

    if (!workspace) {
      // Create workspace
      workspace = await createWorkspaceForUser(user.id, config.name, config.plan, config.role)
      console.log(`✅ Created workspace: ${workspace.name}`)
      console.log(`   Plan: ${config.plan} (${workspace.appLimit} apps limit)`)
      console.log(`   Role: ${config.role}`)
    } else {
      console.log(`✅ Found existing workspace: ${workspace.name}`)
    }

    // Create apps for this user
    if (config.appsToCreate > 0) {
      const appsToAdd = SAMPLE_APPS.slice(0, config.appsToCreate)
      for (const appData of appsToAdd) {
        await createSimpleApp(
          workspace.id,
          appData.appStoreId,
          appData.name,
          appData.developerName,
          appData.category
        )
      }
      console.log(`✅ Created ${config.appsToCreate} app(s)`)
    } else {
      console.log(`✅ Workspace empty (0 apps)`)
    }

    createdUsers.push({ user, workspace, config })
    console.log("")
  }

  // ============================================================================
  // Load detailed data for owner@starter-limit.dev (for rich demo experience)
  // ============================================================================
  const demoUserEntry = createdUsers.find((u) => u.config.email === "owner@starter-limit.dev")

  if (!demoUserEntry) {
    console.log("⚠️  Skipping detailed data load - demo user not found")
    console.log("")
  } else {
    console.log("📊 Loading detailed review data for demo user...")
    console.log("")

    const { workspace } = demoUserEntry
    const appStoreId = "1570489264"
    let app = await prisma.app.findFirst({
      where: {
        workspaceId: workspace.id,
        appStoreId,
      },
    })

    if (!app) {
      console.log("⚠️  StoryGraph app not found for demo user, skipping detailed data")
      console.log("")
    } else {
      console.log(`📱 Found app: ${app.name} (${app.appStoreId})`)
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
    }
  }

  console.log("")
  console.log("=" .repeat(60))
  console.log("🎉 Seed completed successfully!")
  console.log("")
  console.log("📊 Test User Matrix Summary:")
  console.log("")

  for (const { user, workspace, config } of createdUsers) {
    const appCount = await prisma.app.count({
      where: { workspaceId: workspace.id, deletedAt: null },
    })
    console.log(`  ${user.email}`)
    console.log(`    Name: ${user.name}`)
    console.log(`    Plan: ${config.plan} (${workspace.appLimit} apps limit)`)
    console.log(`    Role: ${config.role}`)
    console.log(`    Apps: ${appCount}/${workspace.appLimit}`)
    console.log(`    Use case: ${config.description}`)
    console.log("")
  }

  const totalUsers = await prisma.user.count()
  const totalWorkspaces = await prisma.workspace.count()
  const totalApps = await prisma.app.count({ where: { deletedAt: null } })
  const totalReviews = await prisma.review.count()
  const totalSnapshots = await prisma.reviewSnapshot.count()

  console.log("Database Totals:")
  console.log(`  Users: ${totalUsers}`)
  console.log(`  Workspaces: ${totalWorkspaces}`)
  console.log(`  Apps: ${totalApps}`)
  console.log(`  Reviews: ${totalReviews}`)
  console.log(`  Snapshots: ${totalSnapshots}`)
  console.log("")
  console.log("💡 Next steps:")
  console.log("  - Start dev server: pnpm dev")
  console.log("  - Use quick-select buttons on login to test different scenarios")
  console.log("  - Explore data: pnpm prisma studio")
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
