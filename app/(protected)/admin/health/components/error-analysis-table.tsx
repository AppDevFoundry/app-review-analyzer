/**
 * Error Analysis Table
 *
 * Displays top error codes with frequency and descriptions.
 */

"use client"

import { AlertCircle } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface ErrorData {
  errorCode: string
  count: number
}

interface ErrorAnalysisTableProps {
  errors: ErrorData[]
}

export function ErrorAnalysisTable({ errors }: ErrorAnalysisTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Error Code</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Count</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {errors.map((error) => (
          <TableRow key={error.errorCode}>
            <TableCell>
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 text-destructive" />
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  {error.errorCode}
                </code>
              </div>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">
                {getErrorDescription(error.errorCode)}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <Badge variant="destructive">{error.count}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * Get human-readable error description
 */
function getErrorDescription(code: string): string {
  const descriptions: Record<string, string> = {
    APPLE_API_ERROR: "Apple API returned an error or invalid response",
    RATE_LIMIT_EXCEEDED: "Rate limit hit for Apple RSS API",
    PLAN_LIMIT_EXCEEDED: "Workspace exceeded plan limit for analyses",
    APP_NOT_FOUND: "App not found, paused, or archived",
    NETWORK_ERROR: "Network connectivity or timeout issue",
    PARSE_ERROR: "Failed to parse Apple RSS response",
    UNKNOWN: "Unclassified error occurred",
  }

  return descriptions[code] || "Unknown error type"
}
