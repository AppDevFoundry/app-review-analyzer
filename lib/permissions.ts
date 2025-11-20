/**
 * Permission utilities for Role-Based Access Control (RBAC)
 *
 * Defines what actions each workspace role can perform:
 * - OWNER: Full access to all operations
 * - ADMIN: Can manage apps, but cannot modify workspace settings
 * - MEMBER: Can add/pause apps, view insights
 * - VIEWER: Read-only access
 */

import { WorkspaceRole } from "@prisma/client"

/**
 * Check if a role can delete apps
 * Only OWNER and ADMIN roles can delete apps
 */
export function canDeleteApp(role: WorkspaceRole): boolean {
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN
}

/**
 * Check if a role can pause/resume apps
 * OWNER, ADMIN, and MEMBER roles can pause apps
 * VIEWER role cannot modify app status
 */
export function canPauseApp(role: WorkspaceRole): boolean {
  return (
    role === WorkspaceRole.OWNER ||
    role === WorkspaceRole.ADMIN ||
    role === WorkspaceRole.MEMBER
  )
}

/**
 * Check if a role can add new apps
 * OWNER, ADMIN, and MEMBER roles can add apps
 * VIEWER role cannot add apps
 */
export function canAddApp(role: WorkspaceRole): boolean {
  return (
    role === WorkspaceRole.OWNER ||
    role === WorkspaceRole.ADMIN ||
    role === WorkspaceRole.MEMBER
  )
}

/**
 * Check if a role can view apps and insights
 * All roles including VIEWER can view apps
 */
export function canViewApp(role: WorkspaceRole): boolean {
  return true // All authenticated workspace members can view
}

/**
 * Check if a role can trigger manual review fetching
 * OWNER, ADMIN, and MEMBER roles can trigger fetches
 * VIEWER role cannot trigger operations
 */
export function canFetchReviews(role: WorkspaceRole): boolean {
  return (
    role === WorkspaceRole.OWNER ||
    role === WorkspaceRole.ADMIN ||
    role === WorkspaceRole.MEMBER
  )
}

/**
 * Check if a role can restore deleted apps
 * Only OWNER and ADMIN roles can restore apps
 */
export function canRestoreApp(role: WorkspaceRole): boolean {
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN
}

/**
 * Check if a role can manage workspace settings
 * Only OWNER role can modify workspace settings
 */
export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === WorkspaceRole.OWNER
}

/**
 * Check if a role can invite/remove workspace members
 * OWNER and ADMIN roles can manage members
 */
export function canManageMembers(role: WorkspaceRole): boolean {
  return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN
}

/**
 * Check if a role can manage billing/subscriptions
 * Only OWNER role can manage billing
 */
export function canManageBilling(role: WorkspaceRole): boolean {
  return role === WorkspaceRole.OWNER
}

/**
 * Check if a role can export data
 * OWNER, ADMIN, and MEMBER roles can export
 * VIEWER role has read-only access
 */
export function canExportData(role: WorkspaceRole): boolean {
  return (
    role === WorkspaceRole.OWNER ||
    role === WorkspaceRole.ADMIN ||
    role === WorkspaceRole.MEMBER
  )
}

/**
 * Get a human-readable description of a role
 */
export function getRoleDescription(role: WorkspaceRole): string {
  switch (role) {
    case WorkspaceRole.OWNER:
      return "Full access to all workspace features including billing and settings"
    case WorkspaceRole.ADMIN:
      return "Can manage apps and members, but cannot modify workspace settings"
    case WorkspaceRole.MEMBER:
      return "Can add and manage apps, view insights and reports"
    case WorkspaceRole.VIEWER:
      return "Read-only access to apps, insights, and reports"
    default:
      return "Unknown role"
  }
}

/**
 * Get a human-readable role label
 */
export function getRoleLabel(role: WorkspaceRole): string {
  switch (role) {
    case WorkspaceRole.OWNER:
      return "Owner"
    case WorkspaceRole.ADMIN:
      return "Admin"
    case WorkspaceRole.MEMBER:
      return "Member"
    case WorkspaceRole.VIEWER:
      return "Viewer"
    default:
      return "Unknown"
  }
}

/**
 * Permission error that can be thrown when a user lacks required permissions
 */
export class PermissionError extends Error {
  constructor(
    message: string,
    public readonly requiredRole?: WorkspaceRole,
    public readonly userRole?: WorkspaceRole
  ) {
    super(message)
    this.name = "PermissionError"
  }
}

/**
 * Assert that a user has permission to perform an action
 * Throws PermissionError if permission is denied
 */
export function assertPermission(
  hasPermission: boolean,
  action: string,
  userRole?: WorkspaceRole
): asserts hasPermission {
  if (!hasPermission) {
    throw new PermissionError(
      `You don't have permission to ${action}. ${userRole ? `Your role: ${getRoleLabel(userRole)}` : ""}`,
      undefined,
      userRole
    )
  }
}

/**
 * Check if a user is a super admin
 * Super admins are defined in the SUPER_ADMIN_EMAILS environment variable
 * (comma-separated list of email addresses)
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false

  const superAdminEmails =
    process.env.SUPER_ADMIN_EMAILS?.split(",").map((e) => e.trim()) || []

  return superAdminEmails.includes(email)
}

/**
 * Assert that a user is a super admin
 * Throws PermissionError if not a super admin
 */
export function assertSuperAdmin(
  email: string | null | undefined
): asserts email {
  if (!isSuperAdmin(email)) {
    throw new PermissionError(
      "Super admin access required. This action is only available to system administrators."
    )
  }
}
