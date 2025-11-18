/**
 * Apple App Store API utilities
 *
 * Provides functions to:
 * - Parse App Store IDs from URLs
 * - Fetch app metadata from iTunes Lookup API
 * - Cache results aggressively (24 hours)
 * - Support mock mode for testing/development
 */

/**
 * Normalized App Store metadata
 */
export interface AppStoreMetadata {
  appStoreId: string
  name: string
  developerName: string
  iconUrl: string
  storeUrl: string
  primaryCategory: string
  averageRating?: number
  ratingCount?: number
  bundleId?: string
  country: string
}

/**
 * Raw response from iTunes Lookup API
 */
interface iTunesLookupResult {
  resultCount: number
  results: Array<{
    trackId: number
    trackName: string
    artistName: string
    artworkUrl512?: string
    artworkUrl100?: string
    trackViewUrl: string
    primaryGenreName: string
    averageUserRating?: number
    userRatingCount?: number
    bundleId?: string
  }>
}

/**
 * Parse App Store ID from various URL formats
 *
 * Supports:
 * - Numeric ID: "1570489264"
 * - App Store URL: "https://apps.apple.com/us/app/storygraph/id1570489264"
 * - Share link: "https://apps.apple.com/app/id1570489264"
 * - With query params: "https://apps.apple.com/us/app/storygraph/id1570489264?mt=8"
 *
 * @param identifier - App Store ID or URL
 * @returns Numeric app ID string, or null if invalid
 */
export function parseAppStoreId(identifier: string): string | null {
  if (!identifier || typeof identifier !== "string") {
    return null
  }

  const trimmed = identifier.trim()

  // If it's already a numeric ID
  if (/^\d+$/.test(trimmed)) {
    return trimmed
  }

  // Extract from URL patterns
  // Pattern 1: /id<number>
  const urlMatch = trimmed.match(/\/id(\d+)/)
  if (urlMatch) {
    return urlMatch[1]
  }

  // Pattern 2: ?id=<number>
  const queryMatch = trimmed.match(/[?&]id=(\d+)/)
  if (queryMatch) {
    return queryMatch[1]
  }

  return null
}

/**
 * Mock metadata for testing/development
 * Set MOCK_APPLE_API=true in .env to enable
 */
const MOCK_METADATA: Record<string, AppStoreMetadata> = {
  "1570489264": {
    appStoreId: "1570489264",
    name: "StoryGraph",
    developerName: "StoryGraph",
    iconUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/12/34/56/mockicon.png",
    storeUrl: "https://apps.apple.com/us/app/storygraph/id1570489264",
    primaryCategory: "Books",
    averageRating: 4.8,
    ratingCount: 15234,
    bundleId: "com.storygraph.app",
    country: "us",
  },
  // Add more mock apps as needed for testing
}

/**
 * Fetch app metadata from iTunes Lookup API
 *
 * Features:
 * - 24-hour cache via Next.js fetch
 * - 5-second timeout with AbortController
 * - Mock mode for testing (MOCK_APPLE_API=true)
 * - Fallback icon URLs (512 -> 100 -> placeholder)
 *
 * @param appStoreId - Numeric App Store ID
 * @param country - Two-letter country code (default: "us")
 * @returns App metadata or null if not found
 */
export async function fetchAppStoreMetadata(
  appStoreId: string,
  country: string = "us"
): Promise<AppStoreMetadata | null> {
  // Mock mode for testing/development
  if (process.env.MOCK_APPLE_API === "true") {
    console.log(`[Apple API] Mock mode: fetching ${appStoreId}`)
    const mockData = MOCK_METADATA[appStoreId]
    if (mockData) {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 100))
      return mockData
    }
    return null
  }

  const url = `https://itunes.apple.com/lookup?id=${appStoreId}&entity=software&country=${country}`

  try {
    console.log(`[Apple API] Fetching metadata for app ${appStoreId} (${country})`)

    // Fetch with timeout and aggressive caching
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      signal: controller.signal,
      next: {
        // Cache for 24 hours
        revalidate: 60 * 60 * 24,
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`[Apple API] HTTP error: ${response.status}`)
      return null
    }

    const data: iTunesLookupResult = await response.json()

    if (data.resultCount === 0 || !data.results || data.results.length === 0) {
      console.warn(`[Apple API] No results found for app ${appStoreId}`)
      return null
    }

    const app = data.results[0]

    // Normalize metadata
    const metadata: AppStoreMetadata = {
      appStoreId: appStoreId,
      name: app.trackName,
      developerName: app.artistName,
      iconUrl: app.artworkUrl512 || app.artworkUrl100 || "",
      storeUrl: app.trackViewUrl,
      primaryCategory: app.primaryGenreName,
      averageRating: app.averageUserRating,
      ratingCount: app.userRatingCount,
      bundleId: app.bundleId,
      country,
    }

    // Ensure HTTPS for icon URL
    if (metadata.iconUrl && metadata.iconUrl.startsWith("http:")) {
      metadata.iconUrl = metadata.iconUrl.replace("http:", "https:")
    }

    console.log(`[Apple API] Successfully fetched metadata for ${app.trackName}`)
    return metadata
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.error(`[Apple API] Timeout fetching app ${appStoreId}`)
      } else {
        console.error(`[Apple API] Error fetching app ${appStoreId}:`, error.message)
      }
    }
    return null
  }
}

/**
 * Validate that an App Store ID exists and is accessible
 * Useful for form validation before creating an App record
 *
 * @param identifier - App Store ID or URL
 * @param country - Two-letter country code
 * @returns Metadata if valid, null otherwise
 */
export async function validateAppStoreId(
  identifier: string,
  country?: string
): Promise<AppStoreMetadata | null> {
  const appStoreId = parseAppStoreId(identifier)

  if (!appStoreId) {
    return null
  }

  return fetchAppStoreMetadata(appStoreId, country)
}
