import { DashboardHeader } from "@/components/dashboard/header"
import { AppTableSkeleton } from "@/components/apps/app-table-skeleton"

export default function AppsLoadingPage() {
  return (
    <>
      <DashboardHeader
        heading="Apps"
        text="Manage your iOS apps and track their reviews."
      />
      <AppTableSkeleton />
    </>
  )
}
