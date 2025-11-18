import { PrismaClient } from "@prisma/client"
import { beforeEach, afterAll } from "vitest"

// Create a dedicated test Prisma client
const createTestPrismaClient = () => {
  // Use DATABASE_URL_TEST if available, otherwise fall back to DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error(
      "Database URL not configured. Set DATABASE_URL_TEST in .env.test"
    )
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log:
      process.env.DEBUG_PRISMA === "true"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  })
}

// Singleton instance for tests
let testPrisma: PrismaClient | null = null

/**
 * Get the test Prisma client instance.
 * Creates one if it doesn't exist.
 */
export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    testPrisma = createTestPrismaClient()
  }
  return testPrisma
}

/**
 * Clean up the test Prisma client connection.
 * Should be called after all tests are done.
 */
export async function disconnectTestPrisma(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect()
    testPrisma = null
  }
}

/**
 * Clear all data from the test database.
 * Useful for resetting state between tests.
 *
 * Order matters due to foreign key constraints!
 */
export async function clearTestDatabase(): Promise<void> {
  const prisma = getTestPrisma()

  // Delete in reverse order of dependencies
  await prisma.$transaction([
    prisma.reviewSnapshotInsight.deleteMany(),
    prisma.reviewSnapshot.deleteMany(),
    prisma.review.deleteMany(),
    prisma.app.deleteMany(),
    prisma.workspaceMember.deleteMany(),
    prisma.workspace.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.user.deleteMany(),
  ])
}

/**
 * Setup helper that clears the database before each test
 * and disconnects after all tests.
 *
 * Usage:
 * ```ts
 * import { setupTestDatabase } from '@/tests/utils/prisma-test-client'
 *
 * describe('My tests', () => {
 *   setupTestDatabase()
 *
 *   it('should do something', async () => {
 *     // test code
 *   })
 * })
 * ```
 */
export function setupTestDatabase(): void {
  beforeEach(async () => {
    await clearTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })
}

/**
 * Create a test user in the database.
 */
export async function createTestUser(
  data: {
    email?: string
    name?: string
  } = {}
) {
  const prisma = getTestPrisma()
  return prisma.user.create({
    data: {
      email: data.email ?? `test-${Date.now()}@example.com`,
      name: data.name ?? "Test User",
    },
  })
}

/**
 * Create a test workspace with an owner.
 */
export async function createTestWorkspace(
  ownerId: string,
  data: {
    name?: string
    slug?: string
  } = {}
) {
  const prisma = getTestPrisma()
  const slug = data.slug ?? `test-workspace-${Date.now()}`

  return prisma.workspace.create({
    data: {
      name: data.name ?? "Test Workspace",
      slug,
      ownerId,
      members: {
        create: {
          userId: ownerId,
          role: "OWNER",
        },
      },
    },
    include: {
      members: true,
    },
  })
}
