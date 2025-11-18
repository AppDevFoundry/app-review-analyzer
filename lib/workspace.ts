import { WorkspacePlan, WorkspaceRole } from "@prisma/client"
import { prisma } from "@/lib/db"
import { PLAN_LIMITS } from "@/config/plan-limits"

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
 * Get or create a default workspace for a user.
 * This ensures every authenticated user has at least one workspace.
 */
export async function ensureUserHasWorkspace(
  userId: string,
  userName: string | null
) {
  // Check if user already has a workspace where they're a member
  const existingMembership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspace: {
        deletedAt: null,
      },
    },
    include: {
      workspace: true,
    },
  })

  if (existingMembership?.workspace) {
    return existingMembership.workspace
  }

  // User has no workspace, create a default one
  const workspaceName = `${userName || "Personal"}'s Workspace`
  const slug = await ensureUniqueSlug(generateSlug(workspaceName))

  // Get default plan limits
  const planLimits = PLAN_LIMITS[WorkspacePlan.STARTER]

  // Create workspace with default STARTER plan
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

  console.log(`[ensureUserHasWorkspace] Created workspace ${workspace.slug} for user ${userId}`)

  return workspace
}
