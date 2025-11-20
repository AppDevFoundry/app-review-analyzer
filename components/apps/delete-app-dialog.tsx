"use client"

/**
 * Delete App Confirmation Dialog Component
 *
 * Alert dialog for deleting apps with safety measures.
 * Features:
 * - Type-to-confirm safety mechanism
 * - Clear explanation of consequences
 * - Soft delete only (archives app)
 * - Permission checking
 * - Loading states and feedback
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Trash2 } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deleteApp } from "@/app/actions/apps"

interface DeleteAppDialogProps {
  /**
   * App ID to delete
   */
  appId: string
  /**
   * App name for display and confirmation
   */
  appName: string
  /**
   * Optional trigger element (defaults to button)
   */
  children?: React.ReactNode
}

export function DeleteAppDialog({
  appId,
  appName,
  children,
}: DeleteAppDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isConfirmValid = confirmText.toLowerCase() === appName.toLowerCase()

  async function handleConfirm() {
    if (!isConfirmValid) {
      return
    }

    setIsSubmitting(true)

    try {
      const result = await deleteApp({
        appId,
        hardDelete: false, // Always use soft delete as per requirements
      })

      if (!result.success) {
        if (result.code === "PERMISSION_DENIED") {
          toast.error("Permission denied", {
            description: result.error,
          })
        } else {
          toast.error("Failed to delete app", {
            description: result.error || "An unexpected error occurred",
          })
        }
        return
      }

      // Success!
      toast.success("App deleted", {
        description: result.data.message,
      })

      setOpen(false)
      setConfirmText("")
      router.refresh()
    } catch (error) {
      console.error("Error deleting app:", error)
      toast.error("Failed to delete app", {
        description: "An unexpected error occurred. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      // Reset confirmation text when closing
      setConfirmText("")
    }
    setOpen(newOpen)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
            <Trash2 className="mr-2 h-3 w-3" />
            Delete
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete {appName}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This will archive <span className="font-semibold">{appName}</span> and hide it from your workspace.
              </p>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <h4 className="mb-1 text-sm font-medium text-amber-900">
                  What happens:
                </h4>
                <ul className="space-y-1 text-sm text-amber-800">
                  <li>• App will be hidden from your workspace</li>
                  <li>• All reviews and insights will be preserved</li>
                  <li>• You can restore it later if needed</li>
                  <li>• This will free up a slot in your plan</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-text">
                  Type <span className="font-mono font-semibold">{appName}</span> to confirm:
                </Label>
                <Input
                  id="confirm-text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={appName}
                  disabled={isSubmitting}
                  className="font-mono"
                />
              </div>
            </div>
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
            disabled={!isConfirmValid || isSubmitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isSubmitting ? "Deleting..." : "Delete App"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
