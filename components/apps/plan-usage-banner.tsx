"use client"

import Link from "next/link"
import { AlertCircle, Sparkles } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface PlanUsageBannerProps {
  used: number
  limit: number
  planName: string
}

export function PlanUsageBanner({ used, limit, planName }: PlanUsageBannerProps) {
  const isAtLimit = used >= limit
  const isNearLimit = used >= limit * 0.8
  const percentage = Math.min((used / limit) * 100, 100)

  if (isAtLimit) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="size-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            You&apos;ve reached your limit of {limit} apps on the {planName} plan.
          </span>
          <Link
            href="/pricing"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-4")}
          >
            <Sparkles className="mr-2 size-4" />
            Upgrade
          </Link>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="mb-6 rounded-lg border bg-muted/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">
          App usage on {planName} plan
        </span>
        <span className={`text-sm font-medium ${isNearLimit ? "text-orange-600" : ""}`}>
          {used} of {limit} apps
        </span>
      </div>
      <Progress
        value={percentage}
        className={`h-2 ${isNearLimit ? "[&>div]:bg-orange-500" : ""}`}
      />
      {isNearLimit && !isAtLimit && (
        <p className="mt-2 text-xs text-orange-600">
          You&apos;re approaching your app limit.{" "}
          <Link href="/pricing" className="underline hover:no-underline">
            Upgrade for more
          </Link>
        </p>
      )}
    </div>
  )
}
