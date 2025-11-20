/**
 * Simple in-memory rate limiter
 *
 * Tracks API calls per key (e.g., workspace ID) and enforces limits.
 * Uses a sliding window approach with automatic cleanup.
 */

interface RateLimitEntry {
  count: number
  windowStart: number
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map()
  private windowMs: number
  private maxRequests: number

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs

    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000)
  }

  /**
   * Check if a key is rate limited
   * @param key - Identifier (e.g., workspaceId)
   * @returns true if within limits, false if rate limited
   */
  check(key: string): boolean {
    const now = Date.now()
    const entry = this.limits.get(key)

    // No entry or window expired
    if (!entry || now - entry.windowStart > this.windowMs) {
      this.limits.set(key, { count: 1, windowStart: now })
      return true
    }

    // Within window, check count
    if (entry.count >= this.maxRequests) {
      return false // Rate limited
    }

    // Increment count
    entry.count++
    return true
  }

  /**
   * Get remaining requests for a key
   */
  remaining(key: string): number {
    const entry = this.limits.get(key)
    if (!entry) {
      return this.maxRequests
    }

    const now = Date.now()
    if (now - entry.windowStart > this.windowMs) {
      return this.maxRequests
    }

    return Math.max(0, this.maxRequests - entry.count)
  }

  /**
   * Get time until window resets (in ms)
   */
  resetIn(key: string): number {
    const entry = this.limits.get(key)
    if (!entry) {
      return 0
    }

    const now = Date.now()
    const elapsed = now - entry.windowStart
    return Math.max(0, this.windowMs - elapsed)
  }

  /**
   * Clean up expired entries
   */
  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of Array.from(this.limits.entries())) {
      if (now - entry.windowStart > this.windowMs) {
        this.limits.delete(key)
      }
    }
  }

  /**
   * Reset rate limit for a key (useful for testing)
   */
  reset(key: string) {
    this.limits.delete(key)
  }

  /**
   * Reset all rate limits (useful for testing)
   */
  resetAll() {
    this.limits.clear()
  }
}

/**
 * Rate limiter for Apple API calls
 * Limit: 10 calls per minute per workspace
 */
export const appleApiLimiter = new RateLimiter(
  10, // max requests
  60 * 1000 // 1 minute window
)

/**
 * Check if Apple API call is allowed for a workspace
 * @param workspaceId - Workspace identifier
 * @returns true if allowed, false if rate limited
 */
export function canCallAppleApi(workspaceId: string): boolean {
  // Skip rate limiting in test/dev environments
  if (process.env.NODE_ENV === "test" || process.env.MOCK_APPLE_API === "true") {
    return true
  }

  return appleApiLimiter.check(workspaceId)
}

/**
 * Get rate limit info for a workspace
 */
export function getAppleApiLimitInfo(workspaceId: string) {
  return {
    remaining: appleApiLimiter.remaining(workspaceId),
    resetIn: appleApiLimiter.resetIn(workspaceId),
    resetAt: new Date(Date.now() + appleApiLimiter.resetIn(workspaceId)),
  }
}
