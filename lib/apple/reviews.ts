/**
 * Apple App Store Reviews Client
 *
 * Fetches reviews from Apple's RSS JSON feeds with pagination,
 * retry logic, and rate limiting support.
 */

import { ReviewSource } from "@prisma/client"
import { INGESTION_CONFIG, INGESTION_ERROR_CODES, IngestionErrorCode } from "@/config/ingestion"
import { ingestionLogger } from "@/lib/logger"

// ============================================================================
// Types
// ============================================================================

/**
 * Raw review data from Apple RSS feed
 */
export interface AppleRawReview {
  id: { label: string }
  author: { name: { label: string }; uri?: { label: string } }
  title: { label: string }
  content: { label: string; attributes?: { type: string } }
  "im:rating": { label: string }
  "im:version": { label: string }
  "im:voteSum": { label: string }
  "im:voteCount": { label: string }
  updated: { label: string }
  link?: { attributes: { rel: string; href: string } }
}

/**
 * Apple RSS feed link structure
 */
interface AppleFeedLink {
  attributes: {
    rel: string
    type?: string
    href: string
  }
}

/**
 * Apple RSS feed response structure
 */
interface AppleFeedResponse {
  feed: {
    author?: { name: { label: string }; uri: { label: string } }
    entry?: AppleRawReview | AppleRawReview[]
    updated?: { label: string }
    rights?: { label: string }
    title?: { label: string }
    icon?: { label: string }
    link?: AppleFeedLink | AppleFeedLink[]
    id?: { label: string }
  }
}

/**
 * Normalized review structure
 */
export interface NormalizedReview {
  externalId: string
  author: string
  rating: number
  title: string
  content: string
  version: string | null
  voteSum: number
  voteCount: number
  publishedAt: Date
  source: ReviewSource
  raw: AppleRawReview
}

/**
 * Fetch result from a single source
 */
export interface FetchSourceResult {
  reviews: NormalizedReview[]
  pagesProcessed: number
  hasMore: boolean
  appName?: string
}

/**
 * Combined fetch result from all sources
 */
export interface FetchAllResult {
  reviews: NormalizedReview[]
  totalPagesProcessed: number
  sourcesProcessed: ReviewSource[]
  appName?: string
  stats: {
    mostRecentCount: number
    mostHelpfulCount: number
    uniqueCount: number
    duplicateCount: number
  }
}

/**
 * Options for fetching reviews
 */
export interface FetchReviewsOptions {
  /** Country code for the App Store (default: "us") */
  country?: string
  /** Maximum pages to fetch per source */
  maxPages?: number
  /** Maximum total reviews to fetch (across all sources) */
  maxReviews?: number
  /** Delay between page requests (milliseconds) */
  delayMs?: number
  /** Request timeout (milliseconds) */
  timeoutMs?: number
  /** Abort signal for cancellation */
  signal?: AbortSignal
  /** Run ID for logging */
  runId?: string
}

// ============================================================================
// Error Classes
// ============================================================================

export class AppleApiError extends Error {
  code: IngestionErrorCode
  status?: number
  retryAfter?: number

  constructor(message: string, code: IngestionErrorCode, status?: number, retryAfter?: number) {
    super(message)
    this.name = "AppleApiError"
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map sort type to ReviewSource enum
 */
function mapSortToSource(sort: "mostRecent" | "mostHelpful"): ReviewSource {
  return sort === "mostRecent" ? ReviewSource.MOST_RECENT : ReviewSource.MOST_HELPFUL
}

/**
 * Map sort type to Apple API parameter
 */
function sortToAppleParam(sort: "mostRecent" | "mostHelpful"): string {
  return sort === "mostRecent" ? "mostrecent" : "mosthelpful"
}

/**
 * Build Apple RSS feed URL
 */
function buildFeedUrl(
  appStoreId: string,
  sort: "mostRecent" | "mostHelpful",
  page: number,
  country: string
): string {
  const sortParam = sortToAppleParam(sort)
  return `${INGESTION_CONFIG.appleBaseUrl}/${country}/rss/customerreviews/page=${page}/id=${appStoreId}/sortby=${sortParam}/json`
}

/**
 * Normalize a raw Apple review to our internal format
 */
function normalizeReview(raw: AppleRawReview, source: ReviewSource): NormalizedReview {
  const rating = parseInt(raw["im:rating"]?.label || "0", 10)

  if (rating < 1 || rating > 5) {
    throw new Error(`Invalid rating value: ${rating}`)
  }

  return {
    externalId: raw.id?.label || "",
    author: raw.author?.name?.label || "Anonymous",
    rating,
    title: raw.title?.label || "",
    content: raw.content?.label || "",
    version: raw["im:version"]?.label || null,
    voteSum: parseInt(raw["im:voteSum"]?.label || "0", 10),
    voteCount: parseInt(raw["im:voteCount"]?.label || "0", 10),
    publishedAt: new Date(raw.updated?.label || Date.now()),
    source,
    raw,
  }
}

/**
 * Extract next page URL from feed links
 */
function getNextPageUrl(feed: AppleFeedResponse["feed"]): string | null {
  if (!feed.link) return null

  const links = Array.isArray(feed.link) ? feed.link : [feed.link]
  const nextLink = links.find((link) => link.attributes?.rel === "next")

  if (!nextLink) return null

  let nextUrl = nextLink.attributes.href

  // Convert XML URL to JSON format if needed
  if (nextUrl.includes("/xml")) {
    nextUrl = nextUrl.replace("/xml", "/json")
  }

  // Remove urlDesc parameter if present
  if (nextUrl.includes("?urlDesc=")) {
    nextUrl = nextUrl.split("?urlDesc=")[0]
  }

  return nextUrl
}

/**
 * Extract app name from feed title
 */
function extractAppName(feed: AppleFeedResponse["feed"]): string | null {
  const title = feed.title?.label
  if (!title) return null

  // Remove " Customer Reviews" suffix
  return title.replace(/ Customer Reviews$/, "")
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"))
      return
    }

    const timeout = setTimeout(resolve, ms)

    signal?.addEventListener("abort", () => {
      clearTimeout(timeout)
      reject(new DOMException("Aborted", "AbortError"))
    })
  })
}

/**
 * Fetch with timeout and abort support
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  // Link external signal to our controller
  if (signal) {
    signal.addEventListener("abort", () => controller.abort())
  }

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "AppReviewAnalyzer/1.0",
      },
    })

    clearTimeout(timeout)
    return response
  } catch (error) {
    clearTimeout(timeout)
    throw error
  }
}

// ============================================================================
// Main Client Class
// ============================================================================

/**
 * Apple App Store Reviews Client
 */
export class AppleReviewsClient {
  private country: string
  private maxPages: number
  private delayMs: number
  private timeoutMs: number
  private maxRetries: number
  private retryDelays: number[]

  constructor(options: Partial<FetchReviewsOptions> = {}) {
    this.country = options.country || INGESTION_CONFIG.defaultCountry
    this.maxPages = options.maxPages || INGESTION_CONFIG.maxPagesPerSource
    this.delayMs = options.delayMs || INGESTION_CONFIG.delayBetweenPagesMs
    this.timeoutMs = options.timeoutMs || INGESTION_CONFIG.requestTimeoutMs
    this.maxRetries = INGESTION_CONFIG.maxRetries
    this.retryDelays = [...INGESTION_CONFIG.retryDelaysMs]
  }

  /**
   * Fetch a single page with retry logic
   */
  private async fetchPage(
    url: string,
    runId?: string,
    signal?: AbortSignal
  ): Promise<AppleFeedResponse> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Check for abort before each attempt
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError")
        }

        const response = await fetchWithTimeout(url, this.timeoutMs, signal)

        // Handle HTTP errors
        if (!response.ok) {
          if (response.status === 404) {
            throw new AppleApiError(
              "App not found on App Store",
              INGESTION_ERROR_CODES.APPLE_NOT_FOUND,
              404
            )
          }

          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get("Retry-After") || "60", 10)
            throw new AppleApiError(
              "Rate limited by Apple",
              INGESTION_ERROR_CODES.APPLE_RATE_LIMITED,
              429,
              retryAfter
            )
          }

          throw new AppleApiError(
            `Apple API returned ${response.status}`,
            INGESTION_ERROR_CODES.APPLE_API_ERROR,
            response.status
          )
        }

        const data = (await response.json()) as AppleFeedResponse
        return data
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't retry on abort
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error
        }

        // Don't retry on 404 or rate limit
        if (error instanceof AppleApiError) {
          if (error.code === INGESTION_ERROR_CODES.APPLE_NOT_FOUND) {
            throw error
          }
          if (error.code === INGESTION_ERROR_CODES.APPLE_RATE_LIMITED) {
            throw error
          }
        }

        // Log retry attempt
        if (runId) {
          ingestionLogger.appleApiError(runId, url, error, attempt + 1)
        }

        // Wait before retrying (if not last attempt)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelays[attempt] || this.retryDelays[this.retryDelays.length - 1]
          await sleep(delay, signal)
        }
      }
    }

    // All retries exhausted
    throw lastError || new AppleApiError(
      "Failed to fetch from Apple API after retries",
      INGESTION_ERROR_CODES.APPLE_API_ERROR
    )
  }

  /**
   * Fetch reviews from a single source (mostRecent or mostHelpful)
   */
  async fetchSource(
    appStoreId: string,
    sort: "mostRecent" | "mostHelpful",
    options: Partial<FetchReviewsOptions> = {}
  ): Promise<FetchSourceResult> {
    const reviews: NormalizedReview[] = []
    const source = mapSortToSource(sort)
    const maxPages = options.maxPages || this.maxPages
    const maxReviews = options.maxReviews || Infinity
    const country = options.country || this.country
    const runId = options.runId

    let page = 1
    let hasMore = true
    let appName: string | undefined
    let currentUrl: string | null = buildFeedUrl(appStoreId, sort, page, country)

    while (currentUrl && page <= maxPages && reviews.length < maxReviews) {
      // Check for cancellation
      if (options.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError")
      }

      // Add delay between pages (except first page)
      if (page > 1) {
        await sleep(this.delayMs, options.signal)
      }

      // Fetch the page
      const data = await this.fetchPage(currentUrl, runId, options.signal)

      // Extract app name from first page
      if (!appName && data.feed) {
        appName = extractAppName(data.feed) || undefined
      }

      // Extract reviews
      const entries = data.feed?.entry
      if (entries) {
        const entryArray = Array.isArray(entries) ? entries : [entries]

        for (const entry of entryArray) {
          if (reviews.length >= maxReviews) break

          try {
            const normalized = normalizeReview(entry, source)
            reviews.push(normalized)
          } catch {
            // Skip invalid reviews but continue processing
            continue
          }
        }

        // Log progress
        if (runId) {
          ingestionLogger.pageFetched(runId, page, sort, entryArray.length)
        }
      }

      // Check for next page
      const nextUrl = data.feed ? getNextPageUrl(data.feed) : null

      if (nextUrl && nextUrl !== currentUrl) {
        currentUrl = nextUrl
        page++
      } else {
        hasMore = false
        currentUrl = null
      }
    }

    return {
      reviews,
      pagesProcessed: page,
      hasMore: page >= maxPages || reviews.length >= maxReviews,
      appName,
    }
  }

  /**
   * Fetch reviews from both sources (mostRecent and mostHelpful)
   * and deduplicate by external ID
   */
  async fetchAll(
    appStoreId: string,
    options: Partial<FetchReviewsOptions> = {}
  ): Promise<FetchAllResult> {
    const country = options.country || this.country
    const maxReviews = options.maxReviews || Infinity
    const runId = options.runId

    // Calculate per-source limits
    const perSourceLimit = Math.ceil(maxReviews / 2)

    // Fetch from mostRecent source first
    const recentResult = await this.fetchSource(appStoreId, "mostRecent", {
      ...options,
      country,
      maxReviews: perSourceLimit,
    })

    // Add delay between sources
    await sleep(INGESTION_CONFIG.delayBetweenSourcesMs, options.signal)

    // Fetch from mostHelpful source
    const helpfulResult = await this.fetchSource(appStoreId, "mostHelpful", {
      ...options,
      country,
      maxReviews: perSourceLimit,
    })

    // Deduplicate reviews by external ID
    const reviewMap = new Map<string, NormalizedReview>()
    let duplicateCount = 0

    // Add recent reviews first
    for (const review of recentResult.reviews) {
      reviewMap.set(review.externalId, review)
    }

    // Add helpful reviews (skip duplicates)
    for (const review of helpfulResult.reviews) {
      if (reviewMap.has(review.externalId)) {
        duplicateCount++
      } else {
        reviewMap.set(review.externalId, review)
      }
    }

    const uniqueReviews = Array.from(reviewMap.values())

    return {
      reviews: uniqueReviews,
      totalPagesProcessed: recentResult.pagesProcessed + helpfulResult.pagesProcessed,
      sourcesProcessed: [ReviewSource.MOST_RECENT, ReviewSource.MOST_HELPFUL],
      appName: recentResult.appName || helpfulResult.appName,
      stats: {
        mostRecentCount: recentResult.reviews.length,
        mostHelpfulCount: helpfulResult.reviews.length,
        uniqueCount: uniqueReviews.length,
        duplicateCount,
      },
    }
  }
}

// ============================================================================
// Mock Client for Testing
// ============================================================================

/**
 * Mock Apple Reviews Client for testing
 * Returns predefined review data without making network requests
 */
export class MockAppleReviewsClient extends AppleReviewsClient {
  private mockReviews: NormalizedReview[]
  private mockAppName: string

  constructor(mockReviews: NormalizedReview[] = [], mockAppName = "Test App") {
    super()
    this.mockReviews = mockReviews
    this.mockAppName = mockAppName
  }

  setMockData(reviews: NormalizedReview[], appName?: string) {
    this.mockReviews = reviews
    if (appName) this.mockAppName = appName
  }

  async fetchSource(
    appStoreId: string,
    sort: "mostRecent" | "mostHelpful",
    options: Partial<FetchReviewsOptions> = {}
  ): Promise<FetchSourceResult> {
    // Simulate some delay
    await sleep(10)

    const source = mapSortToSource(sort)
    const filtered = this.mockReviews.filter((r) => r.source === source)

    return {
      reviews: filtered,
      pagesProcessed: 1,
      hasMore: false,
      appName: this.mockAppName,
    }
  }

  async fetchAll(
    appStoreId: string,
    options: Partial<FetchReviewsOptions> = {}
  ): Promise<FetchAllResult> {
    // Simulate some delay
    await sleep(20)

    const recentReviews = this.mockReviews.filter((r) => r.source === ReviewSource.MOST_RECENT)
    const helpfulReviews = this.mockReviews.filter((r) => r.source === ReviewSource.MOST_HELPFUL)

    // Deduplicate
    const reviewMap = new Map<string, NormalizedReview>()
    let duplicateCount = 0

    for (const review of [...recentReviews, ...helpfulReviews]) {
      if (reviewMap.has(review.externalId)) {
        duplicateCount++
      } else {
        reviewMap.set(review.externalId, review)
      }
    }

    return {
      reviews: Array.from(reviewMap.values()),
      totalPagesProcessed: 2,
      sourcesProcessed: [ReviewSource.MOST_RECENT, ReviewSource.MOST_HELPFUL],
      appName: this.mockAppName,
      stats: {
        mostRecentCount: recentReviews.length,
        mostHelpfulCount: helpfulReviews.length,
        uniqueCount: reviewMap.size,
        duplicateCount,
      },
    }
  }
}

/**
 * Create an Apple Reviews Client
 * Returns mock client in test mode
 */
export function createAppleReviewsClient(
  options?: Partial<FetchReviewsOptions>
): AppleReviewsClient {
  if (process.env.MOCK_APPLE_API === "true") {
    return new MockAppleReviewsClient()
  }

  return new AppleReviewsClient(options)
}
