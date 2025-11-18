import { prisma } from "@/lib/db"
import {
  WorkspacePlan,
  WorkspaceRole,
  type Workspace,
  type WorkspaceMember,
} from "@prisma/client"
import {
  getDefaultWorkspaceFields,
  getEffectiveLimits,
  getLimitForMetric,
  exceedsLimit,
  type LimitMetric,
  type PlanLimit,
  METRIC_NAMES,
} from "@/config/plan-limits"

// =============================================================================
// Types
// =============================================================================

export type WorkspaceWithPlan = Workspace & {
  effectiveLimits: PlanLimit
  usage: WorkspaceUsage
}

export type WorkspaceUsage = {
  appCount: number
  analysesThisMonth: number
}

export class WorkspaceLimitExceededError extends Error {
  constructor(
    public metric: LimitMetric,
    public current: number,
    public limit: number
  ) {
    super(
      `Workspace limit exceeded: ${current} ${METRIC_NAMES[metric]} (limit: ${limit})`
    )
    this.name = "WorkspaceLimitExceededError"
  }
}

export class WorkspaceNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Workspace not found: ${identifier}`)
    this.name = "WorkspaceNotFoundError"
  }
}

// =============================================================================
// Slug Generation
// =============================================================================

/**
 * Generate a URL-safe slug from a name.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove non-word chars except spaces and hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, "") // Trim hyphens from start/end
}

/**
 * Generate a unique slug for a workspace, appending a number if needed.
 */
export async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = slugify(name) || "workspace"

  // Check if base slug is available
  const existing = await prisma.workspace.findUnique({
    where: { slug: baseSlug },
    select: { id: true },
  })

  if (!existing) {
    return baseSlug
  }

  // Find existing slugs that match the pattern
  const similarSlugs = await prisma.workspace.findMany({
    where: {
      slug: {
        startsWith: `${baseSlug}-`,
      },
    },
    select: { slug: true },
  })

  // Extract numbers from similar slugs
  const numbers = similarSlugs
    .map((w) => {
      const match = w.slug.match(new RegExp(`^${baseSlug}-(\\d+)$`))
      return match ? parseInt(match[1], 10) : 0
    })
    .filter((n) => n > 0)

  // Find the next available number
  const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 2
  return `${baseSlug}-${nextNumber}`
}

// =============================================================================
// Workspace Creation & Retrieval
// =============================================================================

/**
 * Get or create the default "Personal" workspace for a user.
 * This is automatically called when a user needs a workspace but doesn't have one.
 */
export async function getOrCreateDefaultWorkspace(
  userId: string
): Promise<Workspace> {
  // First, try to find an existing workspace where user is owner
  const existingWorkspace = await prisma.workspace.findFirst({
    where: {
      ownerId: userId,
      deletedAt: null,
    },
    orderBy: {
      createdAt: "asc",
    },
  })

  if (existingWorkspace) {
    return existingWorkspace
  }

  // Get user info for naming
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  })

  // Generate workspace name and slug
  const workspaceName = user?.name
    ? `${user.name}'s Workspace`
    : "Personal Workspace"
  const slug = await generateUniqueSlug(
    user?.name || user?.email?.split("@")[0] || "personal"
  )

  // Create workspace with STARTER plan defaults
  const defaultFields = getDefaultWorkspaceFields(WorkspacePlan.STARTER)

  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      slug,
      plan: WorkspacePlan.STARTER,
      ...defaultFields,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: WorkspaceRole.OWNER,
        },
      },
    },
  })

  return workspace
}

/**
 * Get a workspace with its effective limits and current usage stats.
 */
export async function getWorkspaceWithPlan(
  workspaceId: string
): Promise<WorkspaceWithPlan> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId, deletedAt: null },
    include: {
      _count: {
        select: {
          apps: {
            where: {
              status: { not: "ARCHIVED" },
            },
          },
        },
      },
    },
  })

  if (!workspace) {
    throw new WorkspaceNotFoundError(workspaceId)
  }

  // Get analysis count for current month
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const analysesThisMonth = await prisma.reviewSnapshot.count({
    where: {
      workspaceId,
      createdAt: {
        gte: startOfMonth,
      },
    },
  })

  const effectiveLimits = getEffectiveLimits(workspace)
  const usage: WorkspaceUsage = {
    appCount: workspace._count.apps,
    analysesThisMonth,
  }

  // Remove _count from the returned object
  const { _count, ...workspaceData } = workspace

  return {
    ...workspaceData,
    effectiveLimits,
    usage,
  }
}

/**
 * Get the user's default workspace with plan info.
 * Creates one if it doesn't exist.
 */
export async function getDefaultWorkspaceWithPlan(
  userId: string
): Promise<WorkspaceWithPlan> {
  const workspace = await getOrCreateDefaultWorkspace(userId)
  return getWorkspaceWithPlan(workspace.id)
}

// =============================================================================
// Membership
// =============================================================================

/**
 * Get a user's membership in a workspace, or null if not a member.
 */
export async function getWorkspaceMembership(
  userId: string,
  workspaceId: string
): Promise<WorkspaceMember | null> {
  return prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  })
}

/**
 * Check if a user has at least the specified role in a workspace.
 */
export async function hasWorkspaceRole(
  userId: string,
  workspaceId: string,
  minimumRole: WorkspaceRole
): Promise<boolean> {
  const membership = await getWorkspaceMembership(userId, workspaceId)
  if (!membership) {
    return false
  }

  const roleHierarchy: Record<WorkspaceRole, number> = {
    [WorkspaceRole.OWNER]: 3,
    [WorkspaceRole.ADMIN]: 2,
    [WorkspaceRole.MEMBER]: 1,
  }

  return roleHierarchy[membership.role] >= roleHierarchy[minimumRole]
}

/**
 * Check if a user can access a workspace (is a member).
 */
export async function canAccessWorkspace(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const membership = await getWorkspaceMembership(userId, workspaceId)
  return membership !== null
}

// =============================================================================
// Quota Enforcement
// =============================================================================

/**
 * Assert that a workspace operation is within plan limits.
 * Throws WorkspaceLimitExceededError if the limit would be exceeded.
 *
 * @param workspaceId - The workspace to check
 * @param metric - The metric to check (apps, analysesPerMonth, reviewsPerRun)
 * @param delta - The amount to add (default 1, for checking "can we add one more?")
 */
export async function assertWithinPlan(
  workspaceId: string,
  metric: LimitMetric,
  delta: number = 1
): Promise<void> {
  const workspace = await getWorkspaceWithPlan(workspaceId)
  const limit = getLimitForMetric(workspace.effectiveLimits, metric)

  let currentUsage: number
  switch (metric) {
    case "apps":
      currentUsage = workspace.usage.appCount
      break
    case "analysesPerMonth":
      currentUsage = workspace.usage.analysesThisMonth
      break
    case "reviewsPerRun":
      // For reviewsPerRun, we check against the limit directly (not accumulated)
      currentUsage = 0
      break
  }

  if (exceedsLimit(currentUsage + delta, limit)) {
    throw new WorkspaceLimitExceededError(metric, currentUsage + delta, limit)
  }
}

/**
 * Check if adding an app would exceed the workspace limit.
 * Returns true if allowed, false if would exceed.
 */
export async function canAddApp(workspaceId: string): Promise<boolean> {
  try {
    await assertWithinPlan(workspaceId, "apps", 1)
    return true
  } catch (error) {
    if (error instanceof WorkspaceLimitExceededError) {
      return false
    }
    throw error
  }
}

/**
 * Check if running an analysis would exceed the workspace limit.
 * Returns true if allowed, false if would exceed.
 */
export async function canRunAnalysis(workspaceId: string): Promise<boolean> {
  try {
    await assertWithinPlan(workspaceId, "analysesPerMonth", 1)
    return true
  } catch (error) {
    if (error instanceof WorkspaceLimitExceededError) {
      return false
    }
    throw error
  }
}

/**
 * Get the maximum number of reviews allowed for an analysis run.
 */
export async function getReviewLimitForAnalysis(
  workspaceId: string
): Promise<number> {
  const workspace = await getWorkspaceWithPlan(workspaceId)
  return workspace.effectiveLimits.maxReviewsPerRun
}

// =============================================================================
// Workspace Queries
// =============================================================================

/**
 * List all workspaces a user is a member of.
 */
export async function listUserWorkspaces(userId: string): Promise<Workspace[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: true,
    },
    orderBy: {
      workspace: {
        createdAt: "asc",
      },
    },
  })

  return memberships
    .map((m) => m.workspace)
    .filter((w) => w.deletedAt === null)
}

/**
 * Get workspace by slug.
 */
export async function getWorkspaceBySlug(
  slug: string
): Promise<Workspace | null> {
  return prisma.workspace.findUnique({
    where: { slug, deletedAt: null },
  })
}
