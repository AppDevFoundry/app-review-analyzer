import { Suspense } from "react"
import { constructMetadata } from "@/lib/utils"
import { DashboardHeader } from "@/components/dashboard/header"
import { Plus } from "lucide-react"
import { AppTable } from "@/components/apps/app-table"
import { AppTableSkeleton } from "@/components/apps/app-table-skeleton"
import { getApps } from "@/app/actions/apps"
import { EmptyPlaceholder } from "@/components/shared/empty-placeholder"
import { AddAppDialog } from "@/components/apps/add-app-dialog"
import { getWorkspaceWithPlan, getUserWorkspaceRole } from "@/lib/workspaces"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

export const metadata = constructMetadata({
  title: "Apps – App Review Analyzer",
  description: "Manage your iOS apps and track their reviews.",
})

export default async function AppsPage() {
  // Get authenticated user
  const session = await auth()
  if (!session?.user?.id) {
    return (
      <EmptyPlaceholder>
        <EmptyPlaceholder.Icon name="warning" />
        <EmptyPlaceholder.Title>Not authenticated</EmptyPlaceholder.Title>
        <EmptyPlaceholder.Description>
          Please sign in to view your apps.
        </EmptyPlaceholder.Description>
      </EmptyPlaceholder>
    )
  }

  // Get user's first workspace (TODO: support workspace selection)
  const workspaceMember = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    include: { workspace: true },
  })

  if (!workspaceMember) {
    return (
      <EmptyPlaceholder>
        <EmptyPlaceholder.Icon name="warning" />
        <EmptyPlaceholder.Title>No workspace found</EmptyPlaceholder.Title>
        <EmptyPlaceholder.Description>
          Please create a workspace to start tracking apps.
        </EmptyPlaceholder.Description>
      </EmptyPlaceholder>
    )
  }

  const workspace = workspaceMember.workspace
  const userRole = workspaceMember.role

  // Get apps
  const result = await getApps(false)

  const currentAppCount = result.success ? result.data.length : 0

  return (
    <>
      <DashboardHeader
        heading="Apps"
        text="Manage your iOS apps and track their reviews."
      >
        <AddAppDialog
          currentApps={currentAppCount}
          maxApps={workspace.appLimit}
          planName={workspace.plan}
        />
      </DashboardHeader>

      {!result.success ? (
        <EmptyPlaceholder>
          <EmptyPlaceholder.Icon name="warning" />
          <EmptyPlaceholder.Title>Error loading apps</EmptyPlaceholder.Title>
          <EmptyPlaceholder.Description>
            {result.error || "Failed to load apps. Please try again."}
          </EmptyPlaceholder.Description>
        </EmptyPlaceholder>
      ) : result.data.length === 0 ? (
        <EmptyPlaceholder>
          <EmptyPlaceholder.Icon name="package" />
          <EmptyPlaceholder.Title>No apps added yet</EmptyPlaceholder.Title>
          <EmptyPlaceholder.Description>
            Start tracking reviews by adding your first iOS app.
          </EmptyPlaceholder.Description>
          <AddAppDialog
            currentApps={currentAppCount}
            maxApps={workspace.appLimit}
            planName={workspace.plan}
          />
        </EmptyPlaceholder>
      ) : (
        <AppTable apps={result.data} userRole={userRole} />
      )}
    </>
  )
}
