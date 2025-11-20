"use client"

/**
 * Ingestion History Component
 *
 * Displays a list of recent review ingestion runs for an app.
 * Shows status, timing, and results for each run.
 */

import { useState, useEffect } from "react"
import { IngestionStatus } from "@prisma/client"
import { formatDistanceToNow } from "date-fns"
import {
  Clock,
  Download,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  AlertCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { IngestionStatusBadge } from "./ingestion-status"
import { getIngestionHistory } from "@/app/actions/reviews"
import { cn } from "@/lib/utils"

// ============================================================================
// Types
// ============================================================================

interface IngestionRun {
  id: string
  status: IngestionStatus
  reason: string
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  reviewsFetched: number
  reviewsNew: number
  reviewsDuplicate: number
  pagesProcessed: number
  sourcesProcessed: string[]
  errorCode: string | null
  errorMessage: string | null
  triggeredBy: {
    id: string
    name: string | null
    email: string | null
  } | null
}

interface IngestionHistoryProps {
  /**
   * App ID to fetch history for
   */
  appId: string
  /**
   * Maximum runs to show
   */
  limit?: number
  /**
   * Show card wrapper
   */
  showCard?: boolean
  /**
   * Additional class names
   */
  className?: string
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.round(seconds / 60)
  return `${minutes}m`
}

function formatTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return "Unknown"
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function IngestionRunItem({ run }: { run: IngestionRun }) {
  const [isOpen, setIsOpen] = useState(false)

  const isManual = run.reason === "manual"
  const hasError = !!run.errorMessage

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "border rounded-lg",
          hasError && "border-destructive/30 bg-destructive/5"
        )}
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-4 py-3 h-auto hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <IngestionStatusBadge status={run.status} size="sm" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium">
                  {formatTime(run.startedAt)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {isManual ? "Manual fetch" : "Scheduled"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {run.status === IngestionStatus.COMPLETED && (
                <span className="text-sm text-muted-foreground">
                  {run.reviewsNew} new
                </span>
              )}
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Fetched:</span>
                <span className="font-medium">{run.reviewsFetched}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">New:</span>
                <span className="font-medium text-green-600">
                  {run.reviewsNew}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium">
                  {run.durationMs ? formatDuration(run.durationMs) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Duplicates:</span>
                <span className="font-medium">{run.reviewsDuplicate}</span>
              </div>
            </div>

            {run.triggeredBy && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">By:</span>
                <span className="font-medium">
                  {run.triggeredBy.name || run.triggeredBy.email}
                </span>
              </div>
            )}

            {run.sourcesProcessed.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Sources:</span>
                <div className="flex gap-1">
                  {run.sourcesProcessed.map((source) => (
                    <span
                      key={source}
                      className="px-2 py-0.5 bg-muted rounded text-xs"
                    >
                      {source}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {hasError && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded text-sm">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">{run.errorCode}</p>
                  <p className="text-muted-foreground">{run.errorMessage}</p>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function IngestionHistorySkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-20" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function IngestionHistory({
  appId,
  limit = 10,
  showCard = true,
  className,
}: IngestionHistoryProps) {
  const [runs, setRuns] = useState<IngestionRun[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadHistory() {
      setIsLoading(true)
      setError(null)

      try {
        const result = await getIngestionHistory({ appId, limit })

        if (result.success) {
          setRuns(result.data)
        } else {
          setError(result.error)
        }
      } catch (e) {
        setError("Failed to load ingestion history")
      } finally {
        setIsLoading(false)
      }
    }

    loadHistory()
  }, [appId, limit])

  const content = (
    <>
      {isLoading ? (
        <IngestionHistorySkeleton />
      ) : error ? (
        <div className="text-center py-8">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-8">
          <Download className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No ingestion runs yet. Click "Fetch Reviews" to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <IngestionRunItem key={run.id} run={run} />
          ))}
        </div>
      )}
    </>
  )

  if (!showCard) {
    return <div className={className}>{content}</div>
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Ingestion History</CardTitle>
        <CardDescription>Recent review fetch operations</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}

/**
 * Compact ingestion stats for display in a card
 */
interface IngestionStatsProps {
  totalRuns: number
  successfulRuns: number
  totalReviewsIngested: number
  averageDurationMs: number
  className?: string
}

export function IngestionStats({
  totalRuns,
  successfulRuns,
  totalReviewsIngested,
  averageDurationMs,
  className,
}: IngestionStatsProps) {
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0

  return (
    <div className={cn("grid grid-cols-2 gap-4", className)}>
      <div>
        <p className="text-sm text-muted-foreground">Total Runs</p>
        <p className="text-2xl font-bold">{totalRuns}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Success Rate</p>
        <p className="text-2xl font-bold">{successRate}%</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Reviews Ingested</p>
        <p className="text-2xl font-bold">{totalReviewsIngested.toLocaleString()}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Avg. Duration</p>
        <p className="text-2xl font-bold">
          {averageDurationMs > 0 ? formatDuration(averageDurationMs) : "—"}
        </p>
      </div>
    </div>
  )
}
