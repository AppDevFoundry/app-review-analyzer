import { redirect, notFound } from "next/navigation"
import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, ExternalLink, Star } from "lucide-react"

import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { canAccessWorkspace } from "@/lib/workspaces"

import { DashboardHeader } from "@/components/dashboard/header"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyPlaceholder } from "@/components/shared/empty-placeholder"

interface AppDetailPageProps {
  params: { appId: string }
}

export async function generateMetadata({
  params,
}: AppDetailPageProps): Promise<Metadata> {
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    select: { name: true },
  })

  return {
    title: app ? `${app.name} – App Review Analyzer` : "App Not Found",
  }
}

export default async function AppDetailPage({ params }: AppDetailPageProps) {
  // 1. Get authenticated user
  const user = await getCurrentUser()
  if (!user?.id) {
    redirect("/login")
  }

  // 2. Get the app
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: {
      _count: {
        select: {
          reviews: true,
          snapshots: true,
        },
      },
    },
  })

  if (!app) {
    notFound()
  }

  // 3. Verify user has access
  const hasAccess = await canAccessWorkspace(user.id, app.workspaceId)
  if (!hasAccess) {
    redirect("/dashboard/apps")
  }

  return (
    <>
      <DashboardHeader
        heading={app.name}
        text={app.developerName || "Unknown developer"}
      >
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/apps"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ArrowLeft className="mr-2 size-4" />
            Back to Apps
          </Link>
          {app.storeUrl && (
            <a
              href={app.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <ExternalLink className="mr-2 size-4" />
              View in App Store
            </a>
          )}
        </div>
      </DashboardHeader>

      <div className="container pb-8">
        <div className="grid gap-6 md:grid-cols-3">
          {/* App Info Card */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border bg-muted">
                {app.iconUrl ? (
                  <Image
                    src={app.iconUrl}
                    alt={`${app.name} icon`}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-3xl font-bold text-muted-foreground">
                    {app.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <CardTitle>{app.name}</CardTitle>
                <CardDescription>{app.developerName}</CardDescription>
                <div className="flex gap-2">
                  {app.primaryCategory && (
                    <Badge variant="secondary">{app.primaryCategory}</Badge>
                  )}
                  <Badge
                    variant={app.status === "ACTIVE" ? "default" : "outline"}
                  >
                    {app.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                {app.averageRating != null && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Rating</dt>
                    <dd className="flex items-center gap-1 font-medium">
                      <Star className="size-4 fill-yellow-400 text-yellow-400" />
                      {Number(app.averageRating).toFixed(1)}
                    </dd>
                  </div>
                )}
                {app.ratingCount != null && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Total Ratings</dt>
                    <dd className="font-medium">
                      {app.ratingCount.toLocaleString()}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Reviews Tracked</dt>
                  <dd className="font-medium">{app._count.reviews}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Analyses Run</dt>
                  <dd className="font-medium">{app._count.snapshots}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Placeholder for future content */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Analysis & Insights</CardTitle>
              <CardDescription>
                Review analysis and insights will appear here once implemented.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyPlaceholder className="border-0">
                <EmptyPlaceholder.Icon name="lineChart" />
                <EmptyPlaceholder.Title>Coming Soon</EmptyPlaceholder.Title>
                <EmptyPlaceholder.Description>
                  This is where you&apos;ll see review trends, sentiment analysis,
                  and AI-generated insights. Stay tuned for Task 3 & 4!
                </EmptyPlaceholder.Description>
              </EmptyPlaceholder>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
