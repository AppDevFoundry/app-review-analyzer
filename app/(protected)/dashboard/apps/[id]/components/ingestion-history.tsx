/**
 * Ingestion History Component
 *
 * Displays a list of recent ingestion runs with status, metrics, and details.
 */

"use client"

import { formatDistanceToNow, format } from "date-fns"
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  AlertTriangle,
  RefreshCw,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface IngestionRun {
  id: string
  reason: string
  status: string
  requestedAt: Date
  finishedAt: Date | null
  durationMs: number | null
  reviewsFetched: number
  reviewsInserted: number
  duplicateCount: number
  errorMessage: string | null
  errorCode: string | null
  triggeredBy: { name: string | null; email: string | null } | null
  snapshot: { id: string; status: string } | null
}

interface IngestionHistoryProps {
  runs: IngestionRun[]
  onRetry?: (runId: string) => void
}

export function IngestionHistory({ runs, onRetry }: IngestionHistoryProps) {
  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Download className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Ingestion History</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Review ingestion history will appear here once you fetch reviews.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {runs.map((run) => (
        <Card key={run.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(run.status)}
                  <CardTitle className="text-base">
                    {getReasonLabel(run.reason)}
                  </CardTitle>
                  <Badge variant={getStatusVariant(run.status)}>
                    {run.status}
                  </Badge>
                </div>
                <CardDescription>
                  {run.triggeredBy
                    ? `By ${run.triggeredBy.name || run.triggeredBy.email}`
                    : "System triggered"}{" "}
                  •{" "}
                  {formatDistanceToNow(new Date(run.requestedAt), {
                    addSuffix: true,
                  })}
                </CardDescription>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                {format(new Date(run.requestedAt), "PPp")}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Success Metrics */}
            {run.status === "SUCCEEDED" && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <div className="text-2xl font-bold">{run.reviewsInserted}</div>
                  <p className="text-xs text-muted-foreground">New reviews</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">{run.reviewsFetched}</div>
                  <p className="text-xs text-muted-foreground">Total fetched</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">{run.duplicateCount}</div>
                  <p className="text-xs text-muted-foreground">Duplicates</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {run.durationMs ? (run.durationMs / 1000).toFixed(1) : "-"}s
                  </div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {run.status === "FAILED" && run.errorMessage && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="flex-1 space-y-1">
                    {run.errorCode && (
                      <code className="text-xs font-mono text-destructive">
                        {run.errorCode}
                      </code>
                    )}
                    <p className="text-sm text-destructive">{run.errorMessage}</p>
                  </div>
                  {onRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRetry(run.id)}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Processing Status */}
            {(run.status === "PENDING" || run.status === "PROCESSING") && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {run.status === "PENDING"
                    ? "Waiting to start..."
                    : "Fetching reviews from Apple..."}
                </span>
              </div>
            )}

            {/* Snapshot Link */}
            {run.snapshot && (
              <>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Snapshot:</span>
                    <Badge variant="outline">{run.snapshot.status}</Badge>
                  </div>
                  <code className="text-xs text-muted-foreground">
                    {run.snapshot.id.slice(0, 8)}
                  </code>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/**
 * Get icon for status
 */
function getStatusIcon(status: string) {
  switch (status) {
    case "SUCCEEDED":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    case "FAILED":
      return <XCircle className="h-5 w-5 text-destructive" />
    case "PROCESSING":
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
    case "PENDING":
      return <Clock className="h-5 w-5 text-muted-foreground" />
    default:
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />
  }
}

/**
 * Get badge variant for status
 */
function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "SUCCEEDED":
      return "default"
    case "FAILED":
      return "destructive"
    case "PROCESSING":
      return "default"
    case "PENDING":
      return "secondary"
    default:
      return "outline"
  }
}

/**
 * Get human-readable reason label
 */
function getReasonLabel(reason: string): string {
  switch (reason) {
    case "MANUAL":
      return "Manual Fetch"
    case "SCHEDULED":
      return "Scheduled Fetch"
    case "AUTOMATIC":
      return "Automatic Fetch"
    default:
      return reason
  }
}
