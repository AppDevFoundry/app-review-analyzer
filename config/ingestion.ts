import { WorkspacePlan } from "@prisma/client"

/**
 * Configuration for the review ingestion service
 */
export const INGESTION_CONFIG = {
  /**
   * Maximum pages to fetch per source (mostRecent, mostHelpful)
   * Each page typically contains ~50 reviews
   */
  maxPagesPerSource: 10,

  /**
   * Request timeout for Apple API calls (milliseconds)
   */
  requestTimeoutMs: 10000,

  /**
   * Delay between paginated requests to avoid rate limiting (milliseconds)
   */
  delayBetweenPagesMs: 1000,

  /**
   * Delay between fetching different sources (milliseconds)
   */
  delayBetweenSourcesMs: 2000,

  /**
   * Retry delays for failed requests (milliseconds, exponential backoff)
   */
  retryDelaysMs: [500, 1500, 3000],

  /**
   * Maximum retry attempts for failed requests
   */
  maxRetries: 3,

  /**
   * Apple RSS feed base URL
   */
  appleBaseUrl: "https://itunes.apple.com",

  /**
   * Default country for reviews (can be overridden per workspace/app)
   */
  defaultCountry: process.env.APPLE_REVIEWS_COUNTRY || "us",
} as const

/**
 * Manual ingestion run limits per plan per day
 * This limits how many times a user can manually trigger "Fetch Reviews"
 */
export const MANUAL_INGESTION_LIMITS: Record<WorkspacePlan, number> = {
  [WorkspacePlan.STARTER]: 1,
  [WorkspacePlan.PRO]: 5,
  [WorkspacePlan.BUSINESS]: 20,
}

/**
 * Get the manual ingestion limit for a plan
 */
export function getManualIngestionLimit(plan: WorkspacePlan): number {
  return MANUAL_INGESTION_LIMITS[plan]
}

/**
 * Ingestion error codes for structured error handling
 */
export const INGESTION_ERROR_CODES = {
  // Client errors
  INVALID_APP_ID: "INVALID_APP_ID",
  APP_NOT_FOUND: "APP_NOT_FOUND",
  APP_PAUSED: "APP_PAUSED",
  APP_ARCHIVED: "APP_ARCHIVED",

  // Permission/quota errors
  PERMISSION_DENIED: "PERMISSION_DENIED",
  PLAN_LIMIT_EXCEEDED: "PLAN_LIMIT_EXCEEDED",
  DAILY_LIMIT_EXCEEDED: "DAILY_LIMIT_EXCEEDED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Apple API errors
  APPLE_API_ERROR: "APPLE_API_ERROR",
  APPLE_RATE_LIMITED: "APPLE_RATE_LIMITED",
  APPLE_NOT_FOUND: "APPLE_NOT_FOUND",
  APPLE_TIMEOUT: "APPLE_TIMEOUT",

  // System errors
  DATABASE_ERROR: "DATABASE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  INGESTION_CANCELLED: "INGESTION_CANCELLED",
} as const

export type IngestionErrorCode = typeof INGESTION_ERROR_CODES[keyof typeof INGESTION_ERROR_CODES]

/**
 * Human-readable error messages for each error code
 */
export const INGESTION_ERROR_MESSAGES: Record<IngestionErrorCode, string> = {
  [INGESTION_ERROR_CODES.INVALID_APP_ID]: "The provided app ID is invalid.",
  [INGESTION_ERROR_CODES.APP_NOT_FOUND]: "The app was not found in our system.",
  [INGESTION_ERROR_CODES.APP_PAUSED]: "Cannot fetch reviews for a paused app. Please resume the app first.",
  [INGESTION_ERROR_CODES.APP_ARCHIVED]: "Cannot fetch reviews for an archived app.",
  [INGESTION_ERROR_CODES.PERMISSION_DENIED]: "You don't have permission to fetch reviews for this app.",
  [INGESTION_ERROR_CODES.PLAN_LIMIT_EXCEEDED]: "You've reached the maximum reviews per run for your plan. Upgrade to fetch more.",
  [INGESTION_ERROR_CODES.DAILY_LIMIT_EXCEEDED]: "You've reached the daily limit for manual review fetches. Try again tomorrow or upgrade your plan.",
  [INGESTION_ERROR_CODES.RATE_LIMIT_EXCEEDED]: "Too many requests. Please wait a moment and try again.",
  [INGESTION_ERROR_CODES.APPLE_API_ERROR]: "Failed to fetch reviews from the App Store. Please try again later.",
  [INGESTION_ERROR_CODES.APPLE_RATE_LIMITED]: "The App Store is rate limiting requests. Please try again in a few minutes.",
  [INGESTION_ERROR_CODES.APPLE_NOT_FOUND]: "This app was not found on the App Store.",
  [INGESTION_ERROR_CODES.APPLE_TIMEOUT]: "The App Store request timed out. Please try again.",
  [INGESTION_ERROR_CODES.DATABASE_ERROR]: "A database error occurred. Please try again.",
  [INGESTION_ERROR_CODES.INTERNAL_ERROR]: "An unexpected error occurred. Please try again.",
  [INGESTION_ERROR_CODES.INGESTION_CANCELLED]: "The ingestion process was cancelled.",
}

/**
 * Get human-readable error message for an error code
 */
export function getIngestionErrorMessage(code: IngestionErrorCode): string {
  return INGESTION_ERROR_MESSAGES[code] || INGESTION_ERROR_MESSAGES[INGESTION_ERROR_CODES.INTERNAL_ERROR]
}
