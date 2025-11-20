/**
 * Super Admin Health Dashboard
 *
 * Provides system-wide health monitoring and metrics visualization.
 * Only accessible to super admins (via SUPER_ADMIN_EMAILS).
 */

import { redirect } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react"

import { auth } from "@/auth"
import { isSuperAdmin } from "@/lib/permissions"
import { constructMetadata } from "@/lib/utils"
import { getSystemHealth, getDetailedMetrics } from "@/app/actions/metrics"
import { DashboardHeader } from "@/components/dashboard/header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { IngestionTimelineChart } from "./components/ingestion-timeline-chart"
import { ErrorAnalysisTable } from "./components/error-analysis-table"
import { FailingAppsTable } from "./components/failing-apps-table"

export const metadata = constructMetadata({
  title: "System Health - Admin",
  description: "Monitor system-wide ingestion health and performance metrics.",
})

export default async function HealthDashboardPage() {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    redirect("/dashboard")
  }

  // 2. Fetch health data
  const [healthResult, metricsResult] = await Promise.all([
    getSystemHealth(),
    getDetailedMetrics({}),
  ])

  if (!healthResult.success) {
    return (
      <div className="space-y-6">
        <DashboardHeader
          heading="System Health"
          text="Monitor ingestion performance and system metrics"
        />
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{healthResult.error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!metricsResult.success) {
    return (
      <div className="space-y-6">
        <DashboardHeader
          heading="System Health"
          text="Monitor ingestion performance and system metrics"
        />
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{metricsResult.error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const health = healthResult.data
  const metrics = metricsResult.data

  return (
    <div className="space-y-6">
      <DashboardHeader
        heading="System Health"
        text="Monitor ingestion performance and system metrics"
      />

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Duration
            </CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(health.avgDuration / 1000).toFixed(1)}s
            </div>
            <p className="text-xs text-muted-foreground">
              Per ingestion run
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ingestions (24h)
            </CardTitle>
            <Activity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health.totalIngestions24h}
            </div>
            <p className="text-xs text-muted-foreground">
              {health.totalIngestions7d} in last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Failing Apps
            </CardTitle>
            <XCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.failingApps}</div>
            <p className="text-xs text-muted-foreground">
              3+ consecutive failures
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ingestion Timeline */}
      <IngestionTimelineChart timeline={metrics.timeline} />

      {/* Error Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Top Errors</CardTitle>
          <CardDescription>
            Most frequent error codes in the last 7 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {health.topErrors.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <CheckCircle2 className="mr-2 size-4" />
              No errors in the last 7 days
            </div>
          ) : (
            <ErrorAnalysisTable errors={health.topErrors} />
          )}
        </CardContent>
      </Card>

      {/* Failing Apps */}
      {metrics.failingApps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Failing Apps</CardTitle>
            <CardDescription>
              Apps with 3+ consecutive failures requiring attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FailingAppsTable apps={metrics.failingApps} />
          </CardContent>
        </Card>
      )}

      {/* System Metrics Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Metrics</CardTitle>
          <CardDescription>
            Aggregated system metrics for the last 7 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.metrics.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No metrics data available
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {metrics.metrics.map((metric) => (
                  <div
                    key={metric.metricType}
                    className="rounded-lg border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">
                        {formatMetricType(metric.metricType)}
                      </div>
                      <BarChart3 className="size-4 text-muted-foreground" />
                    </div>
                    <div className="mt-2 text-2xl font-bold">
                      {formatMetricValue(metric.metricType, metric.avgValue)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Count: {metric.count} | Sum: {formatMetricValue(metric.metricType, metric.sumValue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Format metric type for display
 */
function formatMetricType(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Format metric value based on type
 */
function formatMetricValue(type: string, value: number): string {
  if (type.includes("DURATION")) {
    return `${(value / 1000).toFixed(2)}s`
  }
  if (type.includes("RATE")) {
    return value.toFixed(2)
  }
  return Math.round(value).toLocaleString()
}
