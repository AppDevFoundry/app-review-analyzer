"use client"

/**
 * Ingestion Status Component
 *
 * Displays the status of a review ingestion run.
 * Shows different visual states based on the run status.
 */

import { IngestionStatus } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Ban,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface IngestionStatusBadgeProps {
  /**
   * The ingestion status
   */
  status: IngestionStatus
  /**
   * Show icon with the badge
   */
  showIcon?: boolean
  /**
   * Badge size
   */
  size?: "sm" | "default"
  /**
   * Additional class names
   */
  className?: string
}

/**
 * Status configuration mapping
 */
const STATUS_CONFIG: Record<
  IngestionStatus,
  {
    label: string
    description: string
    variant: "default" | "secondary" | "destructive" | "outline"
    icon: React.ElementType
    color: string
  }
> = {
  [IngestionStatus.PENDING]: {
    label: "Pending",
    description: "Waiting to start",
    variant: "secondary",
    icon: Clock,
    color: "text-muted-foreground",
  },
  [IngestionStatus.IN_PROGRESS]: {
    label: "In Progress",
    description: "Fetching reviews from App Store",
    variant: "default",
    icon: Loader2,
    color: "text-blue-500",
  },
  [IngestionStatus.COMPLETED]: {
    label: "Completed",
    description: "Successfully fetched reviews",
    variant: "outline",
    icon: CheckCircle,
    color: "text-green-500",
  },
  [IngestionStatus.FAILED]: {
    label: "Failed",
    description: "Failed to fetch reviews",
    variant: "destructive",
    icon: XCircle,
    color: "text-red-500",
  },
  [IngestionStatus.CANCELLED]: {
    label: "Cancelled",
    description: "Ingestion was cancelled",
    variant: "outline",
    icon: Ban,
    color: "text-muted-foreground",
  },
}

export function IngestionStatusBadge({
  status,
  showIcon = true,
  size = "default",
  className,
}: IngestionStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  const isAnimated = status === IngestionStatus.IN_PROGRESS

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={config.variant}
            className={cn(
              "gap-1",
              size === "sm" && "text-xs px-2 py-0",
              className
            )}
          >
            {showIcon && (
              <Icon
                className={cn(
                  "h-3 w-3",
                  config.color,
                  isAnimated && "animate-spin"
                )}
              />
            )}
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Last Synced Indicator
 *
 * Shows when reviews were last fetched
 */
interface LastSyncedIndicatorProps {
  lastSyncedAt: Date | null
  className?: string
}

export function LastSyncedIndicator({
  lastSyncedAt,
  className,
}: LastSyncedIndicatorProps) {
  if (!lastSyncedAt) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>
        Never synced
      </span>
    )
  }

  // Format relative time
  const now = new Date()
  const diffMs = now.getTime() - new Date(lastSyncedAt).getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  let timeAgo: string
  if (diffMins < 1) {
    timeAgo = "Just now"
  } else if (diffMins < 60) {
    timeAgo = `${diffMins}m ago`
  } else if (diffHours < 24) {
    timeAgo = `${diffHours}h ago`
  } else if (diffDays < 7) {
    timeAgo = `${diffDays}d ago`
  } else {
    timeAgo = new Date(lastSyncedAt).toLocaleDateString()
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("text-sm text-muted-foreground", className)}>
            Last synced: {timeAgo}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{new Date(lastSyncedAt).toLocaleString()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Quota Usage Indicator
 *
 * Shows daily quota usage for manual review fetches
 */
interface QuotaIndicatorProps {
  used: number
  limit: number
  showLabel?: boolean
  className?: string
}

export function QuotaIndicator({
  used,
  limit,
  showLabel = true,
  className,
}: QuotaIndicatorProps) {
  const remaining = Math.max(0, limit - used)
  const percentage = limit > 0 ? (used / limit) * 100 : 0
  const isAtLimit = remaining === 0

  let color = "bg-green-500"
  if (percentage >= 80) {
    color = "bg-red-500"
  } else if (percentage >= 50) {
    color = "bg-yellow-500"
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2", className)}>
            <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full transition-all", color)}
                style={{ width: `${Math.min(100, percentage)}%` }}
              />
            </div>
            {showLabel && (
              <span
                className={cn(
                  "text-xs",
                  isAtLimit ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {remaining} / {limit} remaining
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isAtLimit
              ? "Daily limit reached. Try again tomorrow."
              : `${remaining} manual fetches remaining today`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
