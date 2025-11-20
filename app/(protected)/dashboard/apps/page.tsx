import { constructMetadata } from "@/lib/utils"
import { DashboardHeader } from "@/components/dashboard/header"
import { Plus } from "lucide-react"
import { AppTable } from "@/components/apps/app-table"
import { AppTableSkeleton } from "@/components/apps/app-table-skeleton"
import { AddAppDialog } from "@/components/apps/add-app-dialog"
import { getApps, getWorkspaceUsageInfo } from "@/app/actions/apps"
import { EmptyPlaceholder } from "@/components/shared/empty-placeholder"
import { Button } from "@/components/ui/button"

export const metadata = constructMetadata({
  title: "Apps – App Review Analyzer",
  description: "Manage your iOS apps and track their reviews.",
})

export default async function AppsPage() {
  // Fetch apps and workspace usage info in parallel
  const [appsResult, usageResult] = await Promise.all([
    getApps(false),
    getWorkspaceUsageInfo(),
  ])

  // Default values if usage fetch fails
  const usage = usageResult.success
    ? usageResult.data
    : { currentAppCount: 0, maxApps: 1, planName: "Starter" }

  return (
    <>
      <DashboardHeader
        heading="Apps"
        text="Manage your iOS apps and track their reviews."
      >
        <AddAppDialog
          currentAppCount={usage.currentAppCount}
          maxApps={usage.maxApps}
          planName={usage.planName}
        />
      </DashboardHeader>

      {!appsResult.success ? (
        <EmptyPlaceholder>
          <EmptyPlaceholder.Icon name="warning" />
          <EmptyPlaceholder.Title>Error loading apps</EmptyPlaceholder.Title>
          <EmptyPlaceholder.Description>
            {appsResult.error || "Failed to load apps. Please try again."}
          </EmptyPlaceholder.Description>
        </EmptyPlaceholder>
      ) : appsResult.data.length === 0 ? (
        <EmptyPlaceholder>
          <EmptyPlaceholder.Icon name="package" />
          <EmptyPlaceholder.Title>No apps added yet</EmptyPlaceholder.Title>
          <EmptyPlaceholder.Description>
            Start tracking reviews by adding your first iOS app.
          </EmptyPlaceholder.Description>
          <AddAppDialog
            currentAppCount={usage.currentAppCount}
            maxApps={usage.maxApps}
            planName={usage.planName}
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First App
              </Button>
            }
          />
        </EmptyPlaceholder>
      ) : (
        <AppTable apps={appsResult.data} />
      )}
    </>
  )
}
