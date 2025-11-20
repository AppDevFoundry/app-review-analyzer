import { Suspense } from "react"
import { constructMetadata } from "@/lib/utils"
import { DashboardHeader } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { AppTable } from "@/components/apps/app-table"
import { AppTableSkeleton } from "@/components/apps/app-table-skeleton"
import { getApps } from "@/app/actions/apps"
import { EmptyPlaceholder } from "@/components/shared/empty-placeholder"

export const metadata = constructMetadata({
  title: "Apps – App Review Analyzer",
  description: "Manage your iOS apps and track their reviews.",
})

export default async function AppsPage() {
  const result = await getApps(false)

  return (
    <>
      <DashboardHeader
        heading="Apps"
        text="Manage your iOS apps and track their reviews."
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add App
        </Button>
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
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Your First App
          </Button>
        </EmptyPlaceholder>
      ) : (
        <AppTable apps={result.data} />
      )}
    </>
  )
}
