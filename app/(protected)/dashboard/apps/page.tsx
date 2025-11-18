import { redirect } from "next/navigation"
import { Metadata } from "next"
import { Package } from "lucide-react"

import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { getDefaultWorkspaceWithPlan } from "@/lib/workspaces"

import { DashboardHeader } from "@/components/dashboard/header"
import { EmptyPlaceholder } from "@/components/shared/empty-placeholder"
import { AddAppDialog, AppsGrid, PlanUsageBanner } from "@/components/apps"

export const metadata: Metadata = {
  title: "Apps – App Review Analyzer",
  description: "Manage your tracked applications",
}

export default async function AppsPage() {
  // 1. Get authenticated user
  const user = await getCurrentUser()
  if (!user?.id) {
    redirect("/login")
  }

  // 2. Get workspace with plan info
  const workspace = await getDefaultWorkspaceWithPlan(user.id)

  // 3. Fetch apps for this workspace
  const apps = await prisma.app.findMany({
    where: {
      workspaceId: workspace.id,
      status: { not: "ARCHIVED" },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      developerName: true,
      iconUrl: true,
      primaryCategory: true,
      averageRating: true,
      ratingCount: true,
      status: true,
      storeUrl: true,
      lastSyncedAt: true,
    },
  })

  // Convert Decimal to number for client components
  const appsForClient = apps.map((app) => ({
    ...app,
    averageRating: app.averageRating ? Number(app.averageRating) : null,
  }))

  const appCount = apps.length
  const appLimit = workspace.effectiveLimits.maxApps
  const planName = workspace.plan.charAt(0) + workspace.plan.slice(1).toLowerCase()

  // Check if user can delete (Admin or Owner role)
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    select: { role: true },
  })
  const canDelete = membership?.role === "OWNER" || membership?.role === "ADMIN"

  return (
    <>
      <DashboardHeader
        heading="Apps"
        text="Track and analyze App Store reviews for your applications."
      >
        <AddAppDialog used={appCount} limit={appLimit} />
      </DashboardHeader>

      <div className="container pb-8">
        <PlanUsageBanner used={appCount} limit={appLimit} planName={planName} />

        {apps.length === 0 ? (
          <EmptyPlaceholder>
            <EmptyPlaceholder.Icon name="package" />
            <EmptyPlaceholder.Title>No apps yet</EmptyPlaceholder.Title>
            <EmptyPlaceholder.Description>
              Add your first app to start tracking reviews and generating insights.
            </EmptyPlaceholder.Description>
            <AddAppDialog used={appCount} limit={appLimit} />
          </EmptyPlaceholder>
        ) : (
          <AppsGrid apps={appsForClient} canDelete={canDelete} />
        )}
      </div>
    </>
  )
}
