/**
 * Review Ingestion Configuration
 *
 * Constants and defaults for the review ingestion service.
 * These values control fetch behavior, retry logic, and rate limiting.
 */

export const INGESTION_DEFAULTS = {
  /**
   * Maximum pages to fetch per source (mostRecent or mostHelpful)
   * Each page typically contains 10-50 reviews
   */
  MAX_PAGES_PER_SOURCE: 10,

  /**
   * Request timeout in milliseconds
   * Apple's RSS feed usually responds within 2-3 seconds
   */
  REQUEST_TIMEOUT_MS: 8000,

  /**
   * Retry delays in milliseconds for exponential backoff
   * [attempt1, attempt2, attempt3]
   */
  RETRY_DELAYS_MS: [500, 1500, 3000],

  /**
   * Minimum delay between consecutive requests (milliseconds)
   * Prevents hammering Apple's servers
   */
  MIN_DELAY_BETWEEN_REQUESTS_MS: 250,

  /**
   * Maximum concurrent source fetches
   * (e.g., fetching mostRecent and mostHelpful in parallel)
   */
  MAX_CONCURRENT_SOURCES: 2,

  /**
   * Reviews per page (typical Apple RSS response)
   * Used for progress estimation
   */
  ESTIMATED_REVIEWS_PER_PAGE: 25,

  /**
   * Default country code for App Store
   */
  DEFAULT_COUNTRY: "us",
} as const

/**
 * Apple RSS Feed endpoints
 */
export const APPLE_RSS_ENDPOINTS = {
  /**
   * Base URL for customer reviews RSS feed
   * Pattern: /us/rss/customerreviews/page={page}/id={appId}/sortBy={sort}/json
   */
  BASE_URL: "https://itunes.apple.com",

  /**
   * Sort options for RSS feed
   */
  SORT: {
    MOST_RECENT: "mostRecent",
    MOST_HELPFUL: "mostHelpful",
  },
} as const

/**
 * Error codes for ingestion failures
 */
export const INGESTION_ERROR_CODES = {
  APPLE_API_ERROR: "APPLE_API_ERROR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  PLAN_LIMIT_EXCEEDED: "PLAN_LIMIT_EXCEEDED",
  NETWORK_ERROR: "NETWORK_ERROR",
  PARSE_ERROR: "PARSE_ERROR",
  APP_NOT_FOUND: "APP_NOT_FOUND",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  TIMEOUT: "TIMEOUT",
  UNKNOWN: "UNKNOWN",
} as const

/**
 * Build Apple RSS feed URL
 */
export function buildAppleRSSUrl(options: {
  appStoreId: string
  country: string
  sortBy: "mostRecent" | "mostHelpful"
  page: number
}): string {
  const { appStoreId, country, sortBy, page } = options
  return `${APPLE_RSS_ENDPOINTS.BASE_URL}/${country}/rss/customerreviews/page=${page}/id=${appStoreId}/sortBy=${sortBy}/json`
}

/**
 * Type exports for constants
 */
export type IngestionErrorCode =
  (typeof INGESTION_ERROR_CODES)[keyof typeof INGESTION_ERROR_CODES]
