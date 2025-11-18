"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {
  MoreHorizontal,
  Pause,
  Play,
  Trash2,
  ExternalLink,
  Star,
  Eye,
} from "lucide-react"
import { toast } from "sonner"
import { AppStatus } from "@prisma/client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { updateAppStatus } from "@/actions/update-app-status"
import { deleteApp } from "@/actions/delete-app"

interface AppCardProps {
  app: {
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
  }
  canDelete?: boolean
}

export function AppCard({ app, canDelete = true }: AppCardProps) {
  const [isPending, startTransition] = useTransition()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const isPaused = app.status === AppStatus.PAUSED
  const isArchived = app.status === AppStatus.ARCHIVED

  const handleStatusToggle = () => {
    startTransition(async () => {
      const newStatus = isPaused ? AppStatus.ACTIVE : AppStatus.PAUSED
      const result = await updateAppStatus({ appId: app.id, status: newStatus })

      if (result.status === "success") {
        toast.success(
          newStatus === AppStatus.PAUSED
            ? `Paused "${app.name}"`
            : `Resumed "${app.name}"`
        )
      } else if (result.error) {
        toast.error(result.error.message)
      }
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteApp({ appId: app.id })

      if (result.status === "success") {
        toast.success(`Deleted "${app.name}"`)
        setShowDeleteDialog(false)
      } else if (result.error) {
        toast.error(result.error.message)
      }
    })
  }

  return (
    <>
      <Card className={`relative ${isPaused ? "opacity-60" : ""} ${isArchived ? "hidden" : ""}`}>
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border bg-muted">
            {app.iconUrl ? (
              <Image
                src={app.iconUrl}
                alt={`${app.name} icon`}
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-2xl font-bold text-muted-foreground">
                {app.name.charAt(0)}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-1">
            <div className="flex items-start justify-between">
              <CardTitle className="text-base font-semibold leading-tight">
                {app.name}
              </CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={isPending}
                  >
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/apps/${app.id}`}>
                      <Eye className="mr-2 size-4" />
                      View Details
                    </Link>
                  </DropdownMenuItem>
                  {app.storeUrl && (
                    <DropdownMenuItem asChild>
                      <a href={app.storeUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 size-4" />
                        View in App Store
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleStatusToggle}>
                    {isPaused ? (
                      <>
                        <Play className="mr-2 size-4" />
                        Resume Tracking
                      </>
                    ) : (
                      <>
                        <Pause className="mr-2 size-4" />
                        Pause Tracking
                      </>
                    )}
                  </DropdownMenuItem>
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <CardDescription className="line-clamp-1">
              {app.developerName || "Unknown developer"}
            </CardDescription>

            <div className="flex items-center gap-2">
              {app.primaryCategory && (
                <Badge variant="secondary" className="text-xs">
                  {app.primaryCategory}
                </Badge>
              )}
              {isPaused && (
                <Badge variant="outline" className="text-xs">
                  Paused
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {app.averageRating != null && (
              <div className="flex items-center gap-1">
                <Star className="size-4 fill-yellow-400 text-yellow-400" />
                <span>{app.averageRating.toFixed(1)}</span>
              </div>
            )}
            {app.ratingCount != null && (
              <span>{app.ratingCount.toLocaleString()} ratings</span>
            )}
          </div>
        </CardContent>

        <CardFooter className="text-xs text-muted-foreground">
          {app.lastSyncedAt ? (
            <>Last synced {formatDistanceToNow(app.lastSyncedAt, { addSuffix: true })}</>
          ) : (
            <>Never synced</>
          )}
        </CardFooter>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{app.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the app from your tracking list. Review data will be
              retained but the app will no longer appear in your dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
