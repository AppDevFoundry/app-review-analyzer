/**
 * Test database utilities
 *
 * Provides helper functions for managing the test database:
 * - Creating isolated test Prisma clients
 * - Cleaning up test data between tests
 * - Transaction rollback support
 */

import { PrismaClient } from "@prisma/client"

/**
 * Create a Prisma client for testing
 * Uses DATABASE_URL_TEST from environment
 */
export function createTestPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL_TEST

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL_TEST is not set. Please create .env.test with a test database URL."
    )
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
}

/**
 * Clean all tables in the test database
 * Use this in beforeEach/afterEach to ensure test isolation
 *
 * IMPORTANT: Only use with test database!
 */
export async function cleanDatabase(prisma: PrismaClient) {
  // Check we're using test database
  if (!process.env.DATABASE_URL_TEST) {
    throw new Error("DATABASE_URL_TEST not set - refusing to clean database")
  }

  if (process.env.NODE_ENV !== "test") {
    throw new Error("NODE_ENV must be 'test' to clean database")
  }

  // Delete in reverse order of dependencies to avoid foreign key constraints
  await prisma.reviewInsightLink.deleteMany()
  await prisma.reviewSnapshotInsight.deleteMany()
  await prisma.llmInsight.deleteMany()
  await prisma.positiveAspect.deleteMany()
  await prisma.monthlyTrend.deleteMany()
  await prisma.ratingDistribution.deleteMany()
  await prisma.reviewIngestionRun.deleteMany() // Task 3
  await prisma.reviewSnapshot.deleteMany()
  await prisma.review.deleteMany()
  await prisma.app.deleteMany()
  await prisma.workspaceMember.deleteMany()
  await prisma.systemHealthMetric.deleteMany() // Task 3
  await prisma.workspace.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()
  await prisma.verificationToken.deleteMany()
}

/**
 * Reset database sequences (PostgreSQL)
 * Call this after cleanDatabase if you need predictable IDs
 */
export async function resetSequences(prisma: PrismaClient) {
  // PostgreSQL doesn't use auto-increment with cuid()
  // This is a no-op but kept for compatibility
}

/**
 * Disconnect from test database
 * Call this in afterAll to cleanup connections
 */
export async function disconnectTestDb(prisma: PrismaClient) {
  await prisma.$disconnect()
}

/**
 * Helper to run a test with automatic cleanup
 * Usage:
 *
 * await withCleanDb(async (prisma) => {
 *   // Your test code here
 *   const user = await prisma.user.create({ ... })
 *   expect(user).toBeDefined()
 * })
 */
export async function withCleanDb<T>(
  testFn: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  const prisma = createTestPrismaClient()

  try {
    await cleanDatabase(prisma)
    return await testFn(prisma)
  } finally {
    await cleanDatabase(prisma)
    await disconnectTestDb(prisma)
  }
}
