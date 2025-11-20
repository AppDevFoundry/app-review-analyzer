"use client"

/**
 * Fetch Reviews Button Component
 *
 * Button that triggers review fetching from the App Store.
 * Features:
 * - Loading state with spinner
 * - Disabled when app is paused/archived
 * - Disabled when at daily quota
 * - Shows quota usage
 * - Success/error toast notifications
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Download, Loader2, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { fetchAppReviews } from "@/app/actions/reviews"
import { AppStatus } from "@prisma/client"

interface FetchReviewsButtonProps {
  /**
   * App ID to fetch reviews for
   */
  appId: string
  /**
   * App name for display in toasts
   */
  appName: string
  /**
   * Current app status
   */
  appStatus: AppStatus
  /**
   * Number of manual runs used today
   */
  runsUsedToday?: number
  /**
   * Maximum runs allowed per day
   */
  maxRunsPerDay?: number
  /**
   * Button size variant
   */
  size?: "default" | "sm" | "lg" | "icon"
  /**
   * Button style variant
   */
  variant?: "default" | "outline" | "secondary" | "ghost"
  /**
   * Show label text (default: true)
   */
  showLabel?: boolean
  /**
   * Custom class name
   */
  className?: string
}

export function FetchReviewsButton({
  appId,
  appName,
  appStatus,
  runsUsedToday = 0,
  maxRunsPerDay = 1,
  size = "default",
  variant = "default",
  showLabel = true,
  className,
}: FetchReviewsButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const isAppPaused = appStatus === AppStatus.PAUSED
  const isAppArchived = appStatus === AppStatus.ARCHIVED
  const isAtDailyLimit = runsUsedToday >= maxRunsPerDay
  const runsRemaining = Math.max(0, maxRunsPerDay - runsUsedToday)

  const isDisabled = isAppPaused || isAppArchived || isAtDailyLimit || isLoading

  // Determine tooltip message
  let tooltipMessage = `Fetch latest reviews for ${appName}`
  if (isAppPaused) {
    tooltipMessage = "Resume the app first to fetch reviews"
  } else if (isAppArchived) {
    tooltipMessage = "Cannot fetch reviews for archived apps"
  } else if (isAtDailyLimit) {
    tooltipMessage = `You've used all ${maxRunsPerDay} daily fetches. Try again tomorrow.`
  } else if (runsRemaining === 1) {
    tooltipMessage = `${runsRemaining} fetch remaining today`
  } else if (runsRemaining > 1) {
    tooltipMessage = `${runsRemaining} fetches remaining today`
  }

  async function handleFetch() {
    setIsLoading(true)

    const loadingToast = toast.loading(`Fetching reviews for ${appName}...`, {
      description: "This may take a moment",
    })

    try {
      const result = await fetchAppReviews({ appId })

      toast.dismiss(loadingToast)

      if (result.success) {
        const { reviewsNew, reviewsFetched } = result.data

        if (reviewsNew > 0) {
          toast.success("Reviews fetched successfully", {
            description: `Found ${reviewsFetched} reviews, ${reviewsNew} new`,
          })
        } else if (reviewsFetched > 0) {
          toast.info("No new reviews", {
            description: `Found ${reviewsFetched} reviews, all already in database`,
          })
        } else {
          toast.info("No reviews found", {
            description: "The app may not have any reviews yet",
          })
        }

        // Refresh the page to show new data
        router.refresh()
      } else {
        // Handle specific error codes
        if (result.code === "DAILY_LIMIT_EXCEEDED") {
          toast.error("Daily limit reached", {
            description: result.error,
            action: {
              label: "Upgrade Plan",
              onClick: () => router.push("/dashboard/billing"),
            },
          })
        } else if (result.code === "APP_PAUSED") {
          toast.error("App is paused", {
            description: "Resume the app first to fetch reviews",
          })
        } else if (result.code === "RATE_LIMIT_EXCEEDED") {
          toast.error("Rate limit exceeded", {
            description: "Please wait a moment and try again",
          })
        } else {
          toast.error("Failed to fetch reviews", {
            description: result.error || "An unexpected error occurred",
          })
        }
      }
    } catch (error) {
      toast.dismiss(loadingToast)
      toast.error("Failed to fetch reviews", {
        description: "An unexpected error occurred. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const buttonContent = (
    <>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isDisabled && !isLoading ? (
        <AlertCircle className="h-4 w-4" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {showLabel && <span className="ml-2">Fetch Reviews</span>}
    </>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleFetch}
            disabled={isDisabled}
            variant={variant}
            size={size}
            className={className}
          >
            {buttonContent}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipMessage}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
