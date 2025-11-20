"use client"

/**
 * Pause App Confirmation Dialog Component
 *
 * Alert dialog for pausing/resuming app review tracking.
 * Features:
 * - Clear explanation of what pausing does
 * - Confirmation flow
 * - Loading states
 * - Success/error feedback
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Pause, Play } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { updateAppStatus } from "@/app/actions/apps"
import { AppStatus } from "@prisma/client"

interface PauseAppDialogProps {
  /**
   * App ID to pause/resume
   */
  appId: string
  /**
   * App name for display
   */
  appName: string
  /**
   * Current app status
   */
  currentStatus: AppStatus
  /**
   * Optional trigger element (defaults to button)
   */
  children?: React.ReactNode
}

export function PauseAppDialog({
  appId,
  appName,
  currentStatus,
  children,
}: PauseAppDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isPaused = currentStatus === AppStatus.PAUSED
  const newStatus = isPaused ? AppStatus.ACTIVE : AppStatus.PAUSED

  async function handleConfirm() {
    setIsSubmitting(true)

    try {
      const result = await updateAppStatus({
        appId,
        status: newStatus,
      })

      if (!result.success) {
        if (result.code === "PERMISSION_DENIED") {
          toast.error("Permission denied", {
            description: result.error,
          })
        } else {
          toast.error(`Failed to ${isPaused ? "resume" : "pause"} app`, {
            description: result.error || "An unexpected error occurred",
          })
        }
        return
      }

      // Success!
      toast.success(
        isPaused ? "App resumed" : "App paused",
        {
          description: isPaused
            ? `${appName} will resume automatic review fetching`
            : `${appName} will stop fetching new reviews until resumed`,
        }
      )

      setOpen(false)
      router.refresh()
    } catch (error) {
      console.error("Error updating app status:", error)
      toast.error("Failed to update app status", {
        description: "An unexpected error occurred. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            {isPaused ? (
              <>
                <Play className="mr-2 h-3 w-3" />
                Resume
              </>
            ) : (
              <>
                <Pause className="mr-2 h-3 w-3" />
                Pause
              </>
            )}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isPaused ? "Resume" : "Pause"} {appName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isPaused ? (
              <>
                Resuming this app will:
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Re-enable automatic review fetching</li>
                  <li>• Include it in scheduled analysis runs</li>
                  <li>• Continue tracking new reviews from the App Store</li>
                </ul>
              </>
            ) : (
              <>
                Pausing this app will:
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Stop automatic review fetching</li>
                  <li>• Exclude it from scheduled analysis runs</li>
                  <li>• Keep all existing reviews and insights intact</li>
                </ul>
                <p className="mt-3 text-sm">
                  You can resume tracking at any time.
                </p>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={isSubmitting}
          >
            {isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isSubmitting
              ? isPaused
                ? "Resuming..."
                : "Pausing..."
              : isPaused
                ? "Resume App"
                : "Pause App"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
