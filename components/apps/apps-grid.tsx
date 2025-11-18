"use client"

import { AppStatus } from "@prisma/client"
import { AppCard } from "./app-card"

interface AppsGridProps {
  apps: Array<{
    id: string
    name: string
    developerName: string | null
    iconUrl: string | null
    primaryCategory: string | null
    averageRating: number | null
    ratingCount: number | null
    status: AppStatus
    storeUrl: string | null
    lastSyncedAt: Date | null
  }>
  canDelete?: boolean
}

export function AppsGrid({ apps, canDelete = true }: AppsGridProps) {
  // Filter out archived apps
  const visibleApps = apps.filter((app) => app.status !== AppStatus.ARCHIVED)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visibleApps.map((app) => (
        <AppCard key={app.id} app={app} canDelete={canDelete} />
      ))}
    </div>
  )
}
