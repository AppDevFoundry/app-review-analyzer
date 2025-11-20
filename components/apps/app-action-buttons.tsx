"use client"

/**
 * App Action Buttons Component
 *
 * Dropdown menu with app management actions.
 * Features:
 * - Permission-aware action visibility
 * - Status-aware labels (Pause/Resume)
 * - Quick access to common operations
 * - Integrates with confirmation dialogs
 */

import Link from "next/link"
import { AppStatus, WorkspaceRole } from "@prisma/client"
import {
  MoreHorizontal,
  Eye,
  Pause,
  Play,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PauseAppDialog } from "./pause-app-dialog"
import { DeleteAppDialog } from "./delete-app-dialog"
import {
  canPauseApp,
  canDeleteApp,
} from "@/lib/permissions"

interface AppActionButtonsProps {
  /**
   * App ID
   */
  appId: string
  /**
   * App name for display
   */
  appName: string
  /**
   * Current app status
   */
  appStatus: AppStatus
  /**
   * User's workspace role for permission checks
   */
  userRole: WorkspaceRole
}

export function AppActionButtons({
  appId,
  appName,
  appStatus,
  userRole,
}: AppActionButtonsProps) {
  const canPause = canPauseApp(userRole)
  const canDelete = canDeleteApp(userRole)
  const isPaused = appStatus === AppStatus.PAUSED

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <span className="sr-only">Open actions menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* View Details */}
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/apps/${appId}`} className="cursor-pointer">
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </Link>
        </DropdownMenuItem>

        {/* Pause/Resume - Only if user has permission */}
        {canPause && (
          <PauseAppDialog
            appId={appId}
            appName={appName}
            currentStatus={appStatus}
          >
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="cursor-pointer"
            >
              {isPaused ? (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </>
              )}
            </DropdownMenuItem>
          </PauseAppDialog>
        )}

        {/* Delete - Only if user has permission */}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DeleteAppDialog appId={appId} appName={appName}>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DeleteAppDialog>
          </>
        )}

        {/* Show message if no actions available (VIEWER role) */}
        {!canPause && !canDelete && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            No actions available
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
