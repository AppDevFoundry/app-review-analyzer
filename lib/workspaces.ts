import { prisma } from "@/lib/db"
import { WorkspacePlan, WorkspaceRole, Prisma } from "@prisma/client"
import { getPlanLimits, PLAN_LIMITS } from "@/config/plan-limits"
import type { WorkspaceWithPlan, WorkspaceUsage, UserWorkspace } from "@/types/workspace"

/**
 * Error thrown when workspace operation violates plan limits
 */
export class PlanLimitError extends Error {
  constructor(
    message: string,
    public limit: number,
    public current: number,
    public metric: string
  ) {
    super(message)
    this.name = "PlanLimitError"
  }
}

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
 * Get or create a default "Personal" workspace for a user
 * This is called automatically when a user signs up or first accesses the app
 */
export async function getOrCreateDefaultWorkspace(userId: string) {
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

  // Get user info for workspace name
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  })

  const workspaceName = `${user?.name || user?.email || "Personal"}'s Workspace`
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
 * Get all workspaces for a user with their role
 */
export async function getUserWorkspaces(userId: string): Promise<UserWorkspace[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      userId,
      workspace: {
        deletedAt: null,
      },
    },
    include: {
      workspace: true,
    },
    orderBy: {
      joinedAt: "asc",
    },
  })

  return memberships.map((membership) => ({
    workspace: membership.workspace,
    role: membership.role,
    joinedAt: membership.joinedAt,
  }))
}

/**
 * Get workspace usage metrics
 */
export async function getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsage> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  })

  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`)
  }

  // Count apps
  const appCount = await prisma.app.count({
    where: {
      workspaceId,
      status: "ACTIVE",
    },
  })

  // Count analyses this month
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const analysisCountThisMonth = await prisma.reviewSnapshot.count({
    where: {
      workspaceId,
      createdAt: {
        gte: startOfMonth,
      },
    },
  })

  // Count active members
  const memberCount = await prisma.workspaceMember.count({
    where: { workspaceId },
  })

  return {
    appCount,
    analysisCountThisMonth,
    memberCount,
    isWithinLimits: {
      apps: appCount <= workspace.appLimit,
      analyses: analysisCountThisMonth <= workspace.analysisLimitPerMonth,
    },
  }
}

/**
 * Get workspace with computed plan information and usage
 */
export async function getWorkspaceWithPlan(
  workspaceId: string
): Promise<WorkspaceWithPlan | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  })

  if (!workspace) {
    return null
  }

  const planLimits = getPlanLimits(workspace.plan)
  const usage = await getWorkspaceUsage(workspaceId)

  return {
    ...workspace,
    planLimits,
    usage,
  }
}

/**
 * Check if adding an entity would exceed plan limits
 * @throws PlanLimitError if limit would be exceeded
 */
export async function assertWithinPlanLimit(
  workspaceId: string,
  metric: "apps" | "analyses" | "reviewsPerRun",
  additionalCount: number = 1
) {
  const workspaceWithPlan = await getWorkspaceWithPlan(workspaceId)

  if (!workspaceWithPlan) {
    throw new Error(`Workspace not found: ${workspaceId}`)
  }

  const { usage, planLimits } = workspaceWithPlan

  switch (metric) {
    case "apps":
      const newAppCount = usage.appCount + additionalCount
      if (newAppCount > planLimits.maxApps) {
        throw new PlanLimitError(
          `App limit exceeded. Your plan allows ${planLimits.maxApps} apps, but you're trying to add ${additionalCount} more (currently at ${usage.appCount}).`,
          planLimits.maxApps,
          newAppCount,
          "apps"
        )
      }
      break

    case "analyses":
      const newAnalysisCount = usage.analysisCountThisMonth + additionalCount
      if (newAnalysisCount > planLimits.maxAnalysesPerMonth) {
        throw new PlanLimitError(
          `Analysis limit exceeded. Your plan allows ${planLimits.maxAnalysesPerMonth} analyses per month, but you're trying to run ${additionalCount} more (currently at ${usage.analysisCountThisMonth} this month).`,
          planLimits.maxAnalysesPerMonth,
          newAnalysisCount,
          "analyses"
        )
      }
      break

    case "reviewsPerRun":
      if (additionalCount > planLimits.maxReviewsPerRun) {
        throw new PlanLimitError(
          `Review limit exceeded. Your plan allows analyzing ${planLimits.maxReviewsPerRun} reviews per run, but you're trying to analyze ${additionalCount}.`,
          planLimits.maxReviewsPerRun,
          additionalCount,
          "reviewsPerRun"
        )
      }
      break
  }
}

/**
 * Update workspace plan and apply new limits
 */
export async function updateWorkspacePlan(
  workspaceId: string,
  newPlan: WorkspacePlan,
  customLimits?: {
    appLimit?: number
    analysisLimitPerMonth?: number
    reviewLimitPerRun?: number
  }
) {
  const planLimits = PLAN_LIMITS[newPlan]

  return prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      plan: newPlan,
      appLimit: customLimits?.appLimit ?? planLimits.maxApps,
      analysisLimitPerMonth:
        customLimits?.analysisLimitPerMonth ?? planLimits.maxAnalysesPerMonth,
      reviewLimitPerRun: customLimits?.reviewLimitPerRun ?? planLimits.maxReviewsPerRun,
    },
  })
}

/**
 * Check if user has access to workspace
 */
export async function userHasWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  })

  return !!membership
}

/**
 * Get user's role in workspace
 */
export async function getUserWorkspaceRole(
  userId: string,
  workspaceId: string
): Promise<WorkspaceRole | null> {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  })

  return membership?.role ?? null
}
