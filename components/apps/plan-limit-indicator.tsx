/**
 * Plan Limit Indicator Component
 *
 * Displays workspace plan usage with visual indicators.
 * Features:
 * - Current vs max usage display
 * - Color-coded progress bar
 * - Upgrade CTA when at limit
 * - Responsive design
 */

import Link from "next/link"
import { AlertCircle, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface PlanLimitIndicatorProps {
  /**
   * Current number of resources used
   */
  current: number
  /**
   * Maximum allowed by plan
   */
  max: number
  /**
   * Resource type for display (e.g., "apps", "analyses")
   */
  resourceType?: string
  /**
   * Plan name for display
   */
  planName?: string
  /**
   * Show upgrade CTA when at limit
   */
  showUpgrade?: boolean
  /**
   * Custom CSS classes
   */
  className?: string
}

export function PlanLimitIndicator({
  current,
  max,
  resourceType = "apps",
  planName = "current plan",
  showUpgrade = true,
  className,
}: PlanLimitIndicatorProps) {
  const percentage = Math.min((current / max) * 100, 100)
  const remaining = Math.max(0, max - current)
  const isAtLimit = current >= max
  const isNearLimit = percentage >= 80 && !isAtLimit

  return (
    <div className={cn("space-y-2", className)}>
      {/* Usage display */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground capitalize">
          {resourceType} used
        </span>
        <span className="font-medium">
          {current} / {max}
        </span>
      </div>

      {/* Progress bar */}
      <Progress value={percentage} className="h-2" />

      {/* Warning/info messages */}
      {isNearLimit && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            Only {remaining} {resourceType} {remaining === 1 ? "slot" : "slots"} remaining on{" "}
            {planName}
          </p>
        </div>
      )}

      {isAtLimit && showUpgrade && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
            <div className="flex-1 space-y-2">
              <p className="font-medium text-destructive">
                Plan limit reached
              </p>
              <p className="text-xs text-muted-foreground">
                Upgrade your plan to add more {resourceType} and unlock additional features.
              </p>
              <Link href="/dashboard/billing">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-destructive/20 text-destructive hover:bg-destructive/10"
                >
                  Upgrade Plan
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {!isAtLimit && !isNearLimit && (
        <p className="text-xs text-muted-foreground">
          {remaining} {resourceType} available on {planName}
        </p>
      )}
    </div>
  )
}
