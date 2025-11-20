/**
 * Ingestion Timeline Chart
 *
 * Displays success/failure timeline with average duration overlay.
 */

"use client"

import { Bar, BarChart, CartesianGrid, Line, XAxis, YAxis } from "recharts"
import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

interface TimelineData {
  timestamp: Date
  successes: number
  failures: number
  avgDuration: number
}

interface IngestionTimelineChartProps {
  timeline: TimelineData[]
}

const chartConfig = {
  successes: {
    label: "Successes",
    color: "hsl(var(--chart-2))",
  },
  failures: {
    label: "Failures",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export function IngestionTimelineChart({
  timeline,
}: IngestionTimelineChartProps) {
  // Format data for chart
  const chartData = timeline.map((point) => ({
    date: new Date(point.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    successes: point.successes,
    failures: point.failures,
    avgDuration: Math.round(point.avgDuration / 1000), // Convert to seconds
  }))

  // Calculate totals for footer
  const totalSuccesses = timeline.reduce(
    (sum, point) => sum + point.successes,
    0
  )
  const totalFailures = timeline.reduce((sum, point) => sum + point.failures, 0)
  const total = totalSuccesses + totalFailures
  const successRate = total > 0 ? (totalSuccesses / total) * 100 : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingestion Timeline</CardTitle>
        <CardDescription>
          Daily breakdown of successful and failed ingestion runs
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No ingestion data available
          </div>
        ) : (
          <ChartContainer config={chartConfig}>
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
                top: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => value.toString()}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <Bar
                dataKey="successes"
                fill="var(--color-successes)"
                radius={4}
              />
              <Bar
                dataKey="failures"
                fill="var(--color-failures)"
                radius={4}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 text-pretty text-center text-sm">
        {total > 0 && (
          <>
            <div className="flex items-center gap-2 font-medium leading-none">
              {successRate >= 90 ? (
                <>
                  System performing well at {successRate.toFixed(1)}% success
                  rate
                  <TrendingUp className="size-4" />
                </>
              ) : (
                <>
                  Success rate: {successRate.toFixed(1)}%
                  {successRate < 80 && " - attention needed"}
                </>
              )}
            </div>
            <div className="leading-none text-muted-foreground">
              {totalSuccesses} successful, {totalFailures} failed ingestions
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
