"use client"

import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { WorkspaceRole } from "@prisma/client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AppActionButtons } from "./app-action-buttons"

interface AppTableProps {
  apps: any[]
  userRole: WorkspaceRole
}

export function AppTable({ apps, userRole }: AppTableProps) {
  const router = useRouter()

  return (
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
            <TableHead className="w-[70px]">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apps.map((app) => (
            <TableRow
              key={app.id}
              className="cursor-pointer hover:bg-muted/50"
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
                    <span className="text-sm text-muted-foreground">{app.category || 'Uncategorized'}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={app.status === "ACTIVE" ? "default" : "secondary"}
                >
                  {app.status}
                </Badge>
              </TableCell>
              <TableCell>
                {app.averageRating ? (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{app.averageRating.toFixed(1)}</span>
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
              <TableCell onClick={(e) => e.stopPropagation()}>
                <AppActionButtons
                  appId={app.id}
                  appName={app.name}
                  appStatus={app.status}
                  userRole={userRole}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
