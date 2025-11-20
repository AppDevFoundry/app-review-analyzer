/**
 * Apple RSS Reviews Fetcher
 *
 * Fetches and normalizes reviews from Apple's RSS feed.
 * Handles pagination, retry logic, and rate limiting.
 *
 * Reference: Python prototype at prototype/review-analyzer/app_reviews_fetcher.py
 */

import type { ReviewSource } from "@prisma/client"
import pLimit from "p-limit"

import {
  APPLE_RSS_ENDPOINTS,
  buildAppleRSSUrl,
  INGESTION_DEFAULTS,
  INGESTION_ERROR_CODES,
  type IngestionErrorCode,
} from "@/config/ingestion"
import { canCallAppleReviewsApi } from "@/lib/rate-limiter"

/**
 * Normalized review DTO (matches Review model)
 */
export interface NormalizedReview {
  externalReviewId: string
  rating: number
  title: string | null
  content: string
  author: string | null
  version: string | null
  country: string | null
  language: string | null
  publishedAt: Date
  voteSum: number
  voteCount: number
  source: ReviewSource
  metadata: unknown // Store raw Apple JSON
}

/**
 * Apple RSS feed entry (raw structure)
 */
interface AppleRSSEntry {
  id: {
    label: string // Format: "https://itunes.apple.com/rss/customerreviews/id=REVIEWID/json"
  }
  author: {
    name?: { label?: string }
    uri?: { label?: string }
  }
  "im:rating"?: { label?: string }
  "im:version"?: { label?: string }
  title?: { label?: string }
  content?: {
    label?: string
    attributes?: { type?: string }
  }
  updated?: { label?: string }
  "im:voteSum"?: { label?: string }
  "im:voteCount"?: { label?: string }
  link?: {
    attributes?: {
      rel?: string
      href?: string
    }
  }[]
}

/**
 * Apple RSS feed structure
 */
interface AppleRSSFeed {
  feed?: {
    entry?: AppleRSSEntry[]
    link?: Array<{
      attributes?: {
        rel?: string
        href?: string
      }
    }>
  }
}

/**
 * Fetch options
 */
export interface FetchReviewsOptions {
  appStoreId: string
  country?: string
  sources?: ("mostRecent" | "mostHelpful")[]
  limit?: number // Max reviews across all sources
  maxPagesPerSource?: number
  workspaceId?: string // For rate limiting
}

/**
 * Fetch result
 */
export interface FetchReviewsResult {
  reviews: NormalizedReview[]
  totalFetched: number
  duplicateCount: number
  sourcesProcessed: string[]
  errors: Array<{
    source: string
    page: number
    error: string
    code: IngestionErrorCode
  }>
}

/**
 * Fetch reviews from Apple RSS feed
 *
 * @param options - Fetch configuration
 * @returns Normalized reviews and metadata
 */
export async function fetchReviewsFromRSS(
  options: FetchReviewsOptions
): Promise<FetchReviewsResult> {
  const {
    appStoreId,
    country = process.env.APPLE_REVIEWS_COUNTRY || INGESTION_DEFAULTS.DEFAULT_COUNTRY,
    sources = ["mostRecent", "mostHelpful"],
    limit = 1000,
    maxPagesPerSource = INGESTION_DEFAULTS.MAX_PAGES_PER_SOURCE,
    workspaceId,
  } = options

  const result: FetchReviewsResult = {
    reviews: [],
    totalFetched: 0,
    duplicateCount: 0,
    sourcesProcessed: [],
    errors: [],
  }

  // Check if we're in mock mode
  if (process.env.MOCK_APPLE_API === "true") {
    console.log("[Apple Reviews] Mock mode enabled, returning mock data")
    return getMockReviews(appStoreId, country, sources, limit)
  }

  // Fetch from each source concurrently (with controlled concurrency)
  const limiter = pLimit(INGESTION_DEFAULTS.MAX_CONCURRENT_SOURCES)
  const sourcePromises = sources.map((sortBy) =>
    limiter(async () => {
      try {
        const sourceReviews = await fetchFromSource({
          appStoreId,
          country,
          sortBy,
          maxPages: maxPagesPerSource,
          limit: Math.ceil(limit / sources.length), // Split limit across sources
          workspaceId,
        })

        result.sourcesProcessed.push(sortBy)
        return sourceReviews
      } catch (error) {
        const errorCode = categorizeError(error)
        result.errors.push({
          source: sortBy,
          page: 0,
          error: error instanceof Error ? error.message : String(error),
          code: errorCode,
        })
        return []
      }
    })
  )

  const sourceResults = await Promise.all(sourcePromises)

  // Deduplicate reviews across sources
  const reviewMap = new Map<string, NormalizedReview>()
  for (const reviews of sourceResults) {
    for (const review of reviews) {
      if (!reviewMap.has(review.externalReviewId)) {
        reviewMap.set(review.externalReviewId, review)
        result.totalFetched++
      } else {
        result.duplicateCount++
      }
    }
  }

  result.reviews = Array.from(reviewMap.values())

  // Trim to limit
  if (result.reviews.length > limit) {
    result.reviews = result.reviews.slice(0, limit)
  }

  return result
}

/**
 * Fetch reviews from a single source
 */
async function fetchFromSource(options: {
  appStoreId: string
  country: string
  sortBy: "mostRecent" | "mostHelpful"
  maxPages: number
  limit: number
  workspaceId?: string
}): Promise<NormalizedReview[]> {
  const { appStoreId, country, sortBy, maxPages, limit, workspaceId } = options

  const reviews: NormalizedReview[] = []
  let currentPage = 1
  let hasNextPage = true

  while (hasNextPage && currentPage <= maxPages && reviews.length < limit) {
    // Check rate limit
    if (workspaceId && !canCallAppleReviewsApi(workspaceId)) {
      throw new Error("Rate limit exceeded for workspace")
    }

    // Add delay between requests
    if (currentPage > 1) {
      await sleep(INGESTION_DEFAULTS.MIN_DELAY_BETWEEN_REQUESTS_MS)
    }

    const url = buildAppleRSSUrl({ appStoreId, country, sortBy, page: currentPage })

    try {
      const response = await fetchWithRetry(url)
      const { reviews: pageReviews, nextPageUrl } = parseAppleRSSResponse(
        response,
        sortBy,
        country
      )

      reviews.push(...pageReviews)

      // Check if there's a next page
      hasNextPage = !!nextPageUrl
      currentPage++

      // Stop if we've reached the limit
      if (reviews.length >= limit) {
        break
      }
    } catch (error) {
      console.error(`[Apple Reviews] Error fetching page ${currentPage}:`, error)
      throw error
    }
  }

  return reviews.slice(0, limit)
}

/**
 * Fetch with retry logic and exponential backoff
 */
async function fetchWithRetry(
  url: string,
  attempt = 0
): Promise<AppleRSSFeed> {
  const maxAttempts = INGESTION_DEFAULTS.RETRY_DELAYS_MS.length + 1

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), INGESTION_DEFAULTS.REQUEST_TIMEOUT_MS)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "App Review Analyzer/1.0",
        Accept: "application/json",
      },
    })

    clearTimeout(timeout)

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`App not found: ${response.status}`)
      }
      if (response.status === 429) {
        throw new Error(`Rate limited by Apple: ${response.status}`)
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return data as AppleRSSFeed
  } catch (error) {
    // Retry on network errors, timeouts, or 5xx errors
    if (attempt < maxAttempts - 1) {
      const delay = INGESTION_DEFAULTS.RETRY_DELAYS_MS[attempt]
      console.log(`[Apple Reviews] Retry attempt ${attempt + 1} after ${delay}ms`)
      await sleep(delay)
      return fetchWithRetry(url, attempt + 1)
    }

    throw error
  }
}

/**
 * Parse Apple RSS response and normalize to Review DTOs
 */
export function parseAppleRSSResponse(
  response: AppleRSSFeed,
  source: "mostRecent" | "mostHelpful",
  country: string
): { reviews: NormalizedReview[]; nextPageUrl: string | null } {
  const reviews: NormalizedReview[] = []
  const entries = response.feed?.entry || []

  for (const entry of entries) {
    try {
      const review = normalizeAppleEntry(entry, source, country)
      if (review) {
        reviews.push(review)
      }
    } catch (error) {
      console.error("[Apple Reviews] Error normalizing entry:", error, entry)
      // Continue processing other entries
    }
  }

  // Extract next page URL
  const nextPageUrl = extractNextPageUrl(response)

  return { reviews, nextPageUrl }
}

/**
 * Normalize a single Apple RSS entry to our Review format
 */
function normalizeAppleEntry(
  entry: AppleRSSEntry,
  source: "mostRecent" | "mostHelpful",
  country: string
): NormalizedReview | null {
  // Extract review ID from the entry.id.label
  // Format: "https://itunes.apple.com/rss/customerreviews/id=REVIEWID/json"
  const idMatch = entry.id?.label?.match(/id=(\d+)/)
  if (!idMatch) {
    return null
  }

  const externalReviewId = idMatch[1]

  // Parse rating (1-5)
  const rating = parseInt(entry["im:rating"]?.label || "0", 10)
  if (rating < 1 || rating > 5) {
    return null
  }

  // Extract other fields
  const title = entry.title?.label || null
  const content = entry.content?.label || ""
  const author = entry.author?.name?.label || null
  const version = entry["im:version"]?.label || null
  const publishedAt = entry.updated?.label
    ? new Date(entry.updated.label)
    : new Date()
  const voteSum = parseInt(entry["im:voteSum"]?.label || "0", 10)
  const voteCount = parseInt(entry["im:voteCount"]?.label || "0", 10)

  // Determine review source enum
  const reviewSource: ReviewSource =
    source === "mostRecent" ? "MOST_RECENT" : "MOST_HELPFUL"

  return {
    externalReviewId,
    rating,
    title,
    content,
    author,
    version,
    country,
    language: null, // Apple RSS doesn't provide language info reliably
    publishedAt,
    voteSum,
    voteCount,
    source: reviewSource,
    metadata: entry, // Store raw entry for debugging
  }
}

/**
 * Extract next page URL from RSS feed
 */
function extractNextPageUrl(response: AppleRSSFeed): string | null {
  const links = response.feed?.link || []

  for (const link of links) {
    if (link.attributes?.rel === "next") {
      return link.attributes?.href || null
    }
  }

  return null
}

/**
 * Categorize error for better reporting
 */
function categorizeError(error: unknown): IngestionErrorCode {
  if (!(error instanceof Error)) {
    return INGESTION_ERROR_CODES.UNKNOWN
  }

  const message = error.message.toLowerCase()

  if (message.includes("rate limit")) {
    return INGESTION_ERROR_CODES.RATE_LIMIT_EXCEEDED
  }
  if (message.includes("not found") || message.includes("404")) {
    return INGESTION_ERROR_CODES.APP_NOT_FOUND
  }
  if (message.includes("timeout") || message.includes("aborted")) {
    return INGESTION_ERROR_CODES.TIMEOUT
  }
  if (message.includes("network") || message.includes("fetch")) {
    return INGESTION_ERROR_CODES.NETWORK_ERROR
  }
  if (message.includes("json") || message.includes("parse")) {
    return INGESTION_ERROR_CODES.PARSE_ERROR
  }

  return INGESTION_ERROR_CODES.APPLE_API_ERROR
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Get mock reviews for testing
 */
function getMockReviews(
  appStoreId: string,
  country: string,
  sources: string[],
  limit: number
): FetchReviewsResult {
  const reviews: NormalizedReview[] = []

  // Generate some mock reviews
  const mockCount = Math.min(limit, 20)
  for (let i = 0; i < mockCount; i++) {
    reviews.push({
      externalReviewId: `mock_${appStoreId}_${i}`,
      rating: Math.floor(Math.random() * 5) + 1,
      title: `Mock Review ${i + 1}`,
      content: `This is a mock review for testing purposes. Review number ${i + 1}.`,
      author: `MockUser${i}`,
      version: "1.0.0",
      country,
      language: "en",
      publishedAt: new Date(Date.now() - i * 86400000), // Spread over days
      voteSum: Math.floor(Math.random() * 50),
      voteCount: Math.floor(Math.random() * 100),
      source: i % 2 === 0 ? "MOST_RECENT" : "MOST_HELPFUL",
      metadata: { mock: true },
    })
  }

  return {
    reviews,
    totalFetched: mockCount,
    duplicateCount: 0,
    sourcesProcessed: sources,
    errors: [],
  }
}
