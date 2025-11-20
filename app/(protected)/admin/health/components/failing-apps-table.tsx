/**
 * Failing Apps Table
 *
 * Displays apps with consecutive failures requiring attention.
 */

"use client"

import Link from "next/link"
import { ExternalLink, Clock } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface FailingApp {
  id: string
  name: string
  appStoreId: string
  consecutiveFailures: number
  lastFailureReason: string | null
  nextRetryAt: Date | null
}

interface FailingAppsTableProps {
  apps: FailingApp[]
}

export function FailingAppsTable({ apps }: FailingAppsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>App</TableHead>
          <TableHead>Failures</TableHead>
          <TableHead>Last Error</TableHead>
          <TableHead>Next Retry</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {apps.map((app) => (
          <TableRow key={app.id}>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">{app.name}</span>
                <span className="text-xs text-muted-foreground">
                  {app.appStoreId}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  app.consecutiveFailures >= 5 ? "destructive" : "secondary"
                }
              >
                {app.consecutiveFailures} failures
              </Badge>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground line-clamp-2">
                {app.lastFailureReason || "Unknown"}
              </span>
            </TableCell>
            <TableCell>
              {app.nextRetryAt ? (
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="size-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {formatRetryTime(app.nextRetryAt)}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Link href={`/dashboard/apps/${app.id}`}>
                <Button variant="outline" size="sm">
                  View
                  <ExternalLink className="ml-1 size-3" />
                </Button>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * Format next retry time
 */
function formatRetryTime(date: Date): string {
  const now = new Date()
  const retryDate = new Date(date)
  const diffMs = retryDate.getTime() - now.getTime()

  if (diffMs <= 0) {
    return "Ready to retry"
  }

  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) {
    return `in ${diffDays}d ${diffHours % 24}h`
  }
  if (diffHours > 0) {
    return `in ${diffHours}h ${diffMinutes % 60}m`
  }
  return `in ${diffMinutes}m`
}
