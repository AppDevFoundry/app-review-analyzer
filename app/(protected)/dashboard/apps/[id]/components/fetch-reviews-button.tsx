/**
 * Fetch Reviews Button
 *
 * Client component for manually triggering review ingestion.
 * Shows loading state and handles success/error notifications.
 */

"use client"

import { useState } from "react"
import { Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { triggerReviewIngestion } from "@/app/actions/reviews"

interface FetchReviewsButtonProps {
  appId: string
  appName: string
  disabled?: boolean
  disabledReason?: string
}

export function FetchReviewsButton({
  appId,
  appName,
  disabled = false,
  disabledReason,
}: FetchReviewsButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleFetch = async () => {
    setIsLoading(true)

    try {
      const result = await triggerReviewIngestion(appId)

      if (result.success) {
        toast.success("Reviews fetched successfully", {
          description: `Fetched ${result.data.reviewsInserted} new reviews (${result.data.duplicateCount} duplicates skipped) in ${(result.data.durationMs / 1000).toFixed(1)}s`,
          icon: <CheckCircle2 className="h-4 w-4" />,
        })

        // Refresh the page to show new reviews
        router.refresh()
      } else {
        toast.error("Failed to fetch reviews", {
          description: result.error,
          icon: <AlertCircle className="h-4 w-4" />,
        })
      }
    } catch (error) {
      toast.error("Failed to fetch reviews", {
        description:
          error instanceof Error ? error.message : "An unexpected error occurred",
        icon: <AlertCircle className="h-4 w-4" />,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleFetch}
      disabled={disabled || isLoading}
      title={disabled && disabledReason ? disabledReason : undefined}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Fetching...
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          Fetch Reviews
        </>
      )}
    </Button>
  )
}
