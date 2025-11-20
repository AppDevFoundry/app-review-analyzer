"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Star, MoreHorizontal, Pause, Play, Trash2, ExternalLink } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/use-toast"
import { updateAppStatus, deleteApp } from "@/app/actions/apps"
import { AppStatus } from "@prisma/client"

interface AppData {
  id: string
  appStoreId: string
  name: string
  iconUrl: string | null
  storeUrl: string | null
  status: AppStatus
  primaryCategory: string | null
  averageRating: number | null
  ratingCount: number | null
  lastSyncedAt: Date | null
  createdAt: Date
  _count: {
    reviews: number
    reviewSnapshots: number
  }
}

interface AppTableProps {
  apps: AppData[]
}

export function AppTable({ apps }: AppTableProps) {
  const router = useRouter()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false)
  const [selectedApp, setSelectedApp] = useState<AppData | null>(null)

  async function handleStatusToggle(app: AppData) {
    // If pausing, show confirmation
    if (app.status === AppStatus.ACTIVE) {
      setSelectedApp(app)
      setPauseDialogOpen(true)
      return
    }

    // If resuming, do it directly
    await executeStatusToggle(app)
  }

  async function executeStatusToggle(app: AppData) {
    setActionLoading(app.id)
    try {
      const newStatus = app.status === AppStatus.ACTIVE ? AppStatus.PAUSED : AppStatus.ACTIVE
      const result = await updateAppStatus({ appId: app.id, status: newStatus })

      if (!result.success) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
        return
      }

      toast({
        title: newStatus === AppStatus.PAUSED ? "App paused" : "App resumed",
        description: newStatus === AppStatus.PAUSED
          ? `${app.name} is now paused. Review tracking is disabled.`
          : `${app.name} is now active. Review tracking is enabled.`,
      })

      router.refresh()
    } finally {
      setActionLoading(null)
      setPauseDialogOpen(false)
      setSelectedApp(null)
    }
  }

  async function handleDelete(app: AppData) {
    setSelectedApp(app)
    setDeleteDialogOpen(true)
  }

  async function executeDelete() {
    if (!selectedApp) return

    setActionLoading(selectedApp.id)
    try {
      const result = await deleteApp({ appId: selectedApp.id, hardDelete: false })

      if (!result.success) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "App deleted",
        description: `${selectedApp.name} has been removed from your workspace.`,
      })

      router.refresh()
    } finally {
      setActionLoading(null)
      setDeleteDialogOpen(false)
      setSelectedApp(null)
    }
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">App</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Reviews</TableHead>
              <TableHead>Analyses</TableHead>
              <TableHead className="text-right">Last Analyzed</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map((app) => (
              <TableRow
                key={app.id}
                className={`cursor-pointer hover:bg-muted/50 ${app.status === AppStatus.PAUSED ? "opacity-60" : ""}`}
                onClick={() => router.push(`/dashboard/apps/${app.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-lg">
                      <AvatarImage src={app.iconUrl || undefined} alt={app.name} />
                      <AvatarFallback className="rounded-lg">
                        {app.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">{app.name}</span>
                      <span className="text-sm text-muted-foreground">{app.primaryCategory || 'Uncategorized'}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      app.status === AppStatus.ACTIVE
                        ? "default"
                        : app.status === AppStatus.PAUSED
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {app.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {app.averageRating ? (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{Number(app.averageRating).toFixed(1)}</span>
                      <span className="text-sm text-muted-foreground">
                        ({app.ratingCount?.toLocaleString()})
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No ratings</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="font-medium">{app._count.reviews.toLocaleString()}</span>
                </TableCell>
                <TableCell>
                  <span className="font-medium">{app._count.reviewSnapshots}</span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {app.lastSyncedAt
                    ? formatDistanceToNow(new Date(app.lastSyncedAt), {
                        addSuffix: true,
                      })
                    : "Never"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={actionLoading === app.id}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/dashboard/apps/${app.id}`)
                        }}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStatusToggle(app)
                        }}
                        disabled={app.status === AppStatus.ARCHIVED}
                      >
                        {app.status === AppStatus.ACTIVE ? (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause Tracking
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Resume Tracking
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(app)
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete App
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pause Confirmation Dialog */}
      <AlertDialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause app tracking?</AlertDialogTitle>
            <AlertDialogDescription>
              Pausing <strong>{selectedApp?.name}</strong> will stop fetching new reviews
              and running analyses until you resume it. Existing data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedApp && executeStatusToggle(selectedApp)}
              disabled={actionLoading !== null}
            >
              {actionLoading ? "Pausing..." : "Pause App"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete app?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedApp?.name}</strong>?
              The app will be removed from your workspace, but review data will be preserved
              and can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              disabled={actionLoading !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? "Deleting..." : "Delete App"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
