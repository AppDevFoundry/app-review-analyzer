import { Prisma, Workspace, WorkspaceMember, WorkspacePlan, WorkspaceRole } from "@prisma/client"
import { PlanLimit } from "@/config/plan-limits"

/**
 * Workspace with computed plan information and usage metrics
 */
export interface WorkspaceWithPlan extends Workspace {
  planLimits: PlanLimit
  usage: WorkspaceUsage
}

/**
 * Current usage metrics for a workspace
 */
export interface WorkspaceUsage {
  /** Number of apps currently tracked */
  appCount: number
  /** Number of analyses run this month */
  analysisCountThisMonth: number
  /** Number of active members */
  memberCount: number
  /** Whether the workspace is within plan limits */
  isWithinLimits: {
    apps: boolean
    analyses: boolean
  }
}

/**
 * Workspace with member information
 */
export type WorkspaceWithMembers = Prisma.WorkspaceGetPayload<{
  include: {
    members: {
      include: {
        user: {
          select: {
            id: true
            name: true
            email: true
            image: true
          }
        }
      }
    }
    owner: {
      select: {
        id: true
        name: true
        email: true
        image: true
      }
    }
  }
}>

/**
 * Simplified workspace member info for display
 */
export interface WorkspaceMemberInfo {
  id: string
  userId: string
  role: WorkspaceRole
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
  joinedAt: Date
}

/**
 * User's workspaces with role information
 */
export interface UserWorkspace {
  workspace: Workspace
  role: WorkspaceRole
  joinedAt: Date
}
