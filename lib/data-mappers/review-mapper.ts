import { Prisma, ReviewSource } from "@prisma/client"

/**
 * Raw review structure from the Python fetcher
 */
export interface RawReview {
  id: string
  author: string
  rating: string // Note: stored as string in JSON
  version: string
  title: string
  content: string
  updated: string // ISO 8601 datetime
  vote_sum: string // Note: stored as string in JSON
  vote_count: string // Note: stored as string in JSON
}

/**
 * Metadata structure from the Python fetcher
 */
export interface RawReviewsMetadata {
  app_id: string
  app_name?: string
  sort_by: "mostrecent" | "mosthelpful"
  fetch_timestamp: string
  total_pages: number
  total_reviews: number
}

/**
 * Complete structure of the raw reviews JSON file
 */
export interface RawReviewsData {
  metadata: RawReviewsMetadata
  reviews: RawReview[]
}

/**
 * Convert raw review JSON to Prisma create input
 */
export function mapReviewToPrisma(
  rawReview: RawReview,
  workspaceId: string,
  appId: string,
  source: ReviewSource
): Prisma.ReviewCreateInput {
  // Parse numeric string fields
  const rating = parseInt(rawReview.rating, 10)
  const voteSum = parseInt(rawReview.vote_sum || "0", 10)
  const voteCount = parseInt(rawReview.vote_count || "0", 10)

  // Parse ISO 8601 date
  const publishedAt = new Date(rawReview.updated)

  // Validate rating is in expected range
  if (rating < 1 || rating > 5) {
    throw new Error(`Invalid rating: ${rating}. Expected 1-5.`)
  }

  return {
    workspace: {
      connect: { id: workspaceId },
    },
    app: {
      connect: { id: appId },
    },
    externalReviewId: rawReview.id,
    rating,
    title: rawReview.title || null,
    content: rawReview.content,
    author: rawReview.author || null,
    version: rawReview.version || null,
    publishedAt,
    voteSum,
    voteCount,
    source,
    // Store original JSON for reference
    metadata: rawReview as unknown as Prisma.InputJsonValue,
  }
}

/**
 * Convert source string to ReviewSource enum
 */
export function mapSourceToEnum(sortBy: string): ReviewSource {
  switch (sortBy.toLowerCase()) {
    case "mostrecent":
      return ReviewSource.MOST_RECENT
    case "mosthelpful":
      return ReviewSource.MOST_HELPFUL
    default:
      return ReviewSource.UNKNOWN
  }
}

/**
 * Batch map reviews from a raw JSON file
 */
export function mapReviewsFromFile(
  rawData: RawReviewsData,
  workspaceId: string,
  appId: string
): Prisma.ReviewCreateInput[] {
  const source = mapSourceToEnum(rawData.metadata.sort_by)

  return rawData.reviews.map((rawReview) =>
    mapReviewToPrisma(rawReview, workspaceId, appId, source)
  )
}

/**
 * Create a deduplicated map of reviews by externalReviewId
 * Useful when processing multiple files (most_recent + most_helpful)
 */
export function deduplicateReviews(
  reviews: Prisma.ReviewCreateInput[]
): Prisma.ReviewCreateInput[] {
  const seen = new Set<string>()
  const deduplicated: Prisma.ReviewCreateInput[] = []

  for (const review of reviews) {
    const externalId = review.externalReviewId
    if (!seen.has(externalId)) {
      seen.add(externalId)
      deduplicated.push(review)
    }
  }

  return deduplicated
}

/**
 * Extract app metadata from raw reviews data
 */
export function extractAppMetadata(rawData: RawReviewsData): {
  appStoreId: string
  name?: string
} {
  return {
    appStoreId: rawData.metadata.app_id,
    name: rawData.metadata.app_name,
  }
}
