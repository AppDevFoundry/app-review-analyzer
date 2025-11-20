import { notFound } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { ChevronLeft, Star, Calendar, MessageSquare, TrendingUp, Download } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { getAppDetails, getAppReviews, getAppInsights } from "@/app/actions/apps"
import { getQuotaStatus } from "@/app/actions/reviews"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { FetchReviewsButton } from "@/components/reviews/fetch-reviews-button"
import { IngestionHistory } from "@/components/reviews/ingestion-history"
import { QuotaIndicator, LastSyncedIndicator } from "@/components/reviews/ingestion-status"

interface AppDetailsPageProps {
  params: {
    id: string
  }
}

export default async function AppDetailsPage({ params }: AppDetailsPageProps) {
  // Fetch all data in parallel
  const [appResult, reviewsResult, insightsResult, quotaResult] = await Promise.all([
    getAppDetails(params.id),
    getAppReviews(params.id, { limit: 100 }),
    getAppInsights(params.id),
    getQuotaStatus(),
  ])

  if (!appResult.success || !appResult.data) {
    notFound()
  }

  const app = appResult.data
  const reviews = reviewsResult.success ? reviewsResult.data : []
  const insights = insightsResult.success ? insightsResult.data : null
  const quota = quotaResult.success ? quotaResult.data : null

  // Calculate rating distribution from reviews
  const ratingCounts = reviews.reduce((acc, review) => {
    acc[review.rating] = (acc[review.rating] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/apps">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Apps
          </Button>
        </Link>
      </div>

      {/* App Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 rounded-xl">
            <AvatarImage src={app.iconUrl || undefined} alt={app.name} />
            <AvatarFallback className="rounded-xl text-lg">
              {app.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">{app.name}</h1>
            <p className="text-muted-foreground">{app.category || "Uncategorized"}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={app.status === "ACTIVE" ? "default" : "secondary"}>
                {app.status}
              </Badge>
              {app.averageRating && (
                <div className="flex items-center gap-1 text-sm">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{app.averageRating.toFixed(1)}</span>
                  <span className="text-muted-foreground">
                    ({app.ratingCount?.toLocaleString()} ratings)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fetch Reviews Button */}
        <div className="flex flex-col items-end gap-2">
          <FetchReviewsButton
            appId={app.id}
            appName={app.name}
            appStatus={app.status}
            runsUsedToday={quota?.manualRunsUsedToday || 0}
            maxRunsPerDay={quota?.manualRunsPerDay || 1}
          />
          {quota && (
            <QuotaIndicator
              used={quota.manualRunsUsedToday}
              limit={quota.manualRunsPerDay}
              showLabel={false}
            />
          )}
          <LastSyncedIndicator lastSyncedAt={app.lastSyncedAt} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{app._count.reviews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {reviews.length} loaded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analyses</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{app._count.reviewSnapshots}</div>
            <p className="text-xs text-muted-foreground">
              {app.reviewSnapshots?.length || 0} recent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Synced</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {app.lastSyncedAt
                ? formatDistanceToNow(new Date(app.lastSyncedAt), { addSuffix: true })
                : "Never"}
            </div>
            <p className="text-xs text-muted-foreground">
              {app.lastSyncedAt ? format(new Date(app.lastSyncedAt), "PPP") : "No data"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="reviews" className="space-y-4">
        <TabsList>
          <TabsTrigger value="reviews">
            Reviews ({reviews.length})
          </TabsTrigger>
          <TabsTrigger value="insights">
            Insights {insights?.insights?.length ? `(${insights.insights.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="history">
            Analysis History ({app._count.reviewSnapshots})
          </TabsTrigger>
          <TabsTrigger value="ingestion">
            Fetch History
          </TabsTrigger>
        </TabsList>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="space-y-4">
          {/* Rating Distribution */}
          {Object.keys(ratingCounts).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rating Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = ratingCounts[rating] || 0
                  const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                  return (
                    <div key={rating} className="flex items-center gap-2">
                      <div className="flex items-center gap-1 w-16">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{rating}</span>
                      </div>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {count}
                      </span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Reviews List */}
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Reviews Yet</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    Reviews will appear here once they're fetched from the App Store.
                  </p>
                </CardContent>
              </Card>
            ) : (
              reviews.map((review) => (
                <Card key={review.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < review.rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-muted"
                                }`}
                              />
                            ))}
                          </div>
                          {review.version && (
                            <Badge variant="outline" className="text-xs">
                              v{review.version}
                            </Badge>
                          )}
                        </div>
                        {review.title && (
                          <CardTitle className="text-base">{review.title}</CardTitle>
                        )}
                        <CardDescription className="flex items-center gap-2">
                          <span>{review.author || "Anonymous"}</span>
                          {review.country && (
                            <>
                              <span>•</span>
                              <span>{review.country}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>
                            {formatDistanceToNow(new Date(review.publishedAt), { addSuffix: true })}
                          </span>
                        </CardDescription>
                      </div>
                      {review.voteSum > 0 && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <span className="font-medium">{review.voteSum}</span>
                          <span>helpful</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{review.content}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          {!insights || !insights.insights || insights.insights.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Insights Yet</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Insights will appear here once an analysis is run on the reviews.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {insights.insights.map((insight: any) => (
                <Card key={insight.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            insight.priority === "HIGH" ? "destructive" :
                            insight.priority === "MEDIUM" ? "default" : "secondary"
                          }>
                            {insight.priority}
                          </Badge>
                          <Badge variant="outline">{insight.type.replace(/_/g, " ")}</Badge>
                          {insight.category && (
                            <Badge variant="outline">{insight.category.replace(/_/g, " ")}</Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg">{insight.summary}</CardTitle>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {insight.reviewLinks?.length || 0} mentions
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{insight.description}</p>

                    {insight.reviewLinks && insight.reviewLinks.length > 0 && (
                      <div className="space-y-2">
                        <Separator />
                        <h4 className="text-sm font-medium">Example Reviews:</h4>
                        {insight.reviewLinks.map((link: any) => (
                          <div key={link.id} className="pl-4 border-l-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="flex">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3 w-3 ${
                                      i < link.review.rating
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-muted"
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                by {link.review.author || "Anonymous"}
                              </span>
                            </div>
                            {link.review.title && (
                              <p className="text-sm font-medium">{link.review.title}</p>
                            )}
                            {link.excerpt && (
                              <p className="text-sm text-muted-foreground italic">
                                &quot;{link.excerpt}&quot;
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Analysis History Tab */}
        <TabsContent value="history" className="space-y-4">
          {!app.reviewSnapshots || app.reviewSnapshots.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Analysis History</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Analysis history will appear here once reviews are analyzed.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {app.reviewSnapshots.map((snapshot: any) => (
                <Card key={snapshot.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">
                          Analysis from {format(new Date(snapshot.createdAt), "PPP")}
                        </CardTitle>
                        <CardDescription>
                          {formatDistanceToNow(new Date(snapshot.createdAt), { addSuffix: true })}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {snapshot.totalReviewsAnalyzed?.toLocaleString() || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">reviews analyzed</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Insights:</span>{" "}
                        <span className="font-medium">{snapshot._count.insights}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Ingestion History Tab */}
        <TabsContent value="ingestion" className="space-y-4">
          <IngestionHistory appId={app.id} limit={10} showCard={false} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
