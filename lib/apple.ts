/**
 * Apple App Store metadata fetcher and utilities.
 *
 * Supports a mock mode for development/testing that returns sample data
 * without hitting the real Apple API. Enable with MOCK_APPLE_API=true.
 */

// =============================================================================
// Types
// =============================================================================

export type AppStoreMetadata = {
  appStoreId: string
  name: string
  developerName: string
  iconUrl: string
  storeUrl: string
  primaryCategory: string
  averageRating?: number
  ratingCount?: number
  bundleId?: string
  description?: string
  version?: string
  releaseDate?: string
  country: string
}

export type AppleLookupResponse = {
  resultCount: number
  results: AppleLookupResult[]
}

export type AppleLookupResult = {
  trackId: number
  trackName: string
  artistName: string
  artworkUrl512?: string
  artworkUrl100?: string
  artworkUrl60?: string
  trackViewUrl: string
  primaryGenreName: string
  averageUserRating?: number
  userRatingCount?: number
  bundleId?: string
  description?: string
  version?: string
  releaseDate?: string
}

export class AppStoreError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "INVALID_ID" | "NETWORK_ERROR" | "API_ERROR"
  ) {
    super(message)
    this.name = "AppStoreError"
  }
}

// =============================================================================
// Mock Data
// =============================================================================

/**
 * Sample apps for mock mode. These represent real apps with realistic data.
 */
const MOCK_APPS: Record<string, AppStoreMetadata> = {
  // The StoryGraph - Book tracking app
  "1570489264": {
    appStoreId: "1570489264",
    name: "The StoryGraph",
    developerName: "The StoryGraph Ltd",
    iconUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple116/v4/b5/2e/5b/b52e5b6c-d7a5-c8a7-3f8e-6e6e6e6e6e6e/AppIcon-1x_U007emarketing-0-7-0-85-220.png/512x512bb.jpg",
    storeUrl: "https://apps.apple.com/us/app/the-storygraph/id1570489264",
    primaryCategory: "Books",
    averageRating: 4.2,
    ratingCount: 2847,
    bundleId: "com.thestorygraph.app",
    description: "Track your reading and get personalized book recommendations.",
    version: "1.20",
    releaseDate: "2021-06-15",
    country: "us",
  },
  // Goodreads - Competitor
  "355833469": {
    appStoreId: "355833469",
    name: "Goodreads: Book Reviews",
    developerName: "Goodreads Inc.",
    iconUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/a3/3d/5a/a33d5a7e-8d8d-8d8d-8d8d-8d8d8d8d8d8d/AppIcon-1x_U007emarketing-0-7-0-85-220.png/512x512bb.jpg",
    storeUrl: "https://apps.apple.com/us/app/goodreads-book-reviews/id355833469",
    primaryCategory: "Books",
    averageRating: 4.8,
    ratingCount: 1243567,
    bundleId: "com.goodreads.Goodreads",
    description: "Find and share books you love.",
    version: "5.47.1",
    releaseDate: "2010-03-31",
    country: "us",
  },
  // Libby - Library app
  "1076402606": {
    appStoreId: "1076402606",
    name: "Libby, by OverDrive",
    developerName: "OverDrive, Inc.",
    iconUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple116/v4/c4/4b/4b/c44b4b4b-4b4b-4b4b-4b4b-4b4b4b4b4b4b/AppIcon-1x_U007emarketing-0-7-0-85-220.png/512x512bb.jpg",
    storeUrl: "https://apps.apple.com/us/app/libby-by-overdrive/id1076402606",
    primaryCategory: "Books",
    averageRating: 4.7,
    ratingCount: 892341,
    bundleId: "com.overdrive.libby",
    description: "Borrow ebooks and audiobooks from your library.",
    version: "10.4.1",
    releaseDate: "2016-07-20",
    country: "us",
  },
  // Headspace - Health/Wellness
  "493145008": {
    appStoreId: "493145008",
    name: "Headspace: Mindful Meditation",
    developerName: "Headspace Inc.",
    iconUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/h1/h2/h3/h1h2h3h4-h5h6-h7h8-h9h0-hahahahahaha/AppIcon-1x_U007emarketing-0-7-0-85-220.png/512x512bb.jpg",
    storeUrl: "https://apps.apple.com/us/app/headspace-mindful-meditation/id493145008",
    primaryCategory: "Health & Fitness",
    averageRating: 4.9,
    ratingCount: 1567234,
    bundleId: "com.getsomeheadspace.headspace",
    description: "Sleep, meditation, and mindfulness.",
    version: "4.192.0",
    releaseDate: "2012-01-08",
    country: "us",
  },
  // Notion - Productivity
  "1232780281": {
    appStoreId: "1232780281",
    name: "Notion - Notes, Tasks, Wikis",
    developerName: "Notion Labs, Incorporated",
    iconUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple116/v4/n1/n2/n3/n1n2n3n4-n5n6-n7n8-n9n0-nananananana/AppIcon-1x_U007emarketing-0-7-0-85-220.png/512x512bb.jpg",
    storeUrl: "https://apps.apple.com/us/app/notion-notes-tasks-wikis/id1232780281",
    primaryCategory: "Productivity",
    averageRating: 4.7,
    ratingCount: 234567,
    bundleId: "notion.id",
    description: "Write, plan, and get organized.",
    version: "3.14.0",
    releaseDate: "2018-09-05",
    country: "us",
  },
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Check if mock mode is enabled.
 * Set MOCK_APPLE_API=true in .env.local to enable.
 */
export function isMockModeEnabled(): boolean {
  return process.env.MOCK_APPLE_API === "true"
}

/**
 * Get list of available mock app IDs for development reference.
 */
export function getMockAppIds(): string[] {
  return Object.keys(MOCK_APPS)
}

/**
 * Get mock app metadata by ID (for testing).
 */
export function getMockApp(appStoreId: string): AppStoreMetadata | undefined {
  return MOCK_APPS[appStoreId]
}

// =============================================================================
// ID Parsing
// =============================================================================

/**
 * Parse an App Store ID from various input formats.
 *
 * Supported formats:
 * - Numeric ID: "1570489264"
 * - Standard URL: "https://apps.apple.com/us/app/the-storygraph/id1570489264"
 * - Short URL: "https://apps.apple.com/app/id1570489264"
 * - With query params: "https://apps.apple.com/us/app/id1570489264?platform=iphone"
 * - Share URL: "https://apps.apple.com/us/app/id1570489264?mt=8"
 *
 * @param identifier - The App Store URL or numeric ID
 * @returns The extracted numeric App Store ID
 * @throws AppStoreError if the identifier is invalid
 */
export function parseAppStoreId(identifier: string): string {
  const trimmed = identifier.trim()

  // If it's just a number, return it
  if (/^\d+$/.test(trimmed)) {
    return trimmed
  }

  // Try to extract ID from URL patterns
  // Pattern 1: /id{digits} in path
  const pathMatch = trimmed.match(/\/id(\d+)/)
  if (pathMatch) {
    return pathMatch[1]
  }

  // Pattern 2: id={digits} in query string
  const queryMatch = trimmed.match(/[?&]id=(\d+)/)
  if (queryMatch) {
    return queryMatch[1]
  }

  // Pattern 3: Just digits anywhere after removing non-essential parts
  // This handles edge cases like "app/1570489264" without /id prefix
  const digitsMatch = trimmed.match(/\/(\d{6,})(?:[/?]|$)/)
  if (digitsMatch) {
    return digitsMatch[1]
  }

  throw new AppStoreError(
    `Invalid App Store identifier: "${trimmed}". Please provide a valid App Store URL or numeric ID.`,
    "INVALID_ID"
  )
}

// =============================================================================
// Metadata Fetching
// =============================================================================

/**
 * Fetch app metadata from Apple's iTunes Lookup API.
 *
 * In mock mode (MOCK_APPLE_API=true), returns sample data without network calls.
 *
 * @param appStoreId - The numeric App Store ID
 * @param country - The country code (default: "us")
 * @param options - Additional options
 * @returns The normalized app metadata
 * @throws AppStoreError if the app is not found or network fails
 */
export async function fetchAppStoreMetadata(
  appStoreId: string,
  country: string = "us",
  options: {
    timeout?: number
    skipMock?: boolean // Force real API even if mock mode is enabled
  } = {}
): Promise<AppStoreMetadata> {
  const { timeout = 5000, skipMock = false } = options

  // Check mock mode
  if (isMockModeEnabled() && !skipMock) {
    console.info(`[Apple API] Mock mode: Looking up app ${appStoreId}`)

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 200))

    const mockApp = MOCK_APPS[appStoreId]
    if (mockApp) {
      console.info(`[Apple API] Mock mode: Found "${mockApp.name}"`)
      return { ...mockApp, country }
    }

    // In mock mode, allow any ID by generating fake data
    if (process.env.MOCK_APPLE_API_ALLOW_ANY === "true") {
      console.info(`[Apple API] Mock mode: Generating fake data for ${appStoreId}`)
      return {
        appStoreId,
        name: `Test App ${appStoreId}`,
        developerName: "Test Developer",
        iconUrl: "https://placehold.co/512x512/orange/white?text=App",
        storeUrl: `https://apps.apple.com/${country}/app/id${appStoreId}`,
        primaryCategory: "Utilities",
        averageRating: 4.0,
        ratingCount: 100,
        bundleId: `com.test.app${appStoreId}`,
        country,
      }
    }

    throw new AppStoreError(
      `App not found with ID: ${appStoreId}. Available mock apps: ${Object.keys(MOCK_APPS).join(", ")}`,
      "NOT_FOUND"
    )
  }

  // Real API call
  const url = `https://itunes.apple.com/lookup?id=${appStoreId}&country=${country}&entity=software`

  console.info(`[Apple API] Fetching metadata for app ${appStoreId} from ${country}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new AppStoreError(
        `Apple API returned status ${response.status}`,
        "API_ERROR"
      )
    }

    const data: AppleLookupResponse = await response.json()

    if (data.resultCount === 0 || !data.results[0]) {
      throw new AppStoreError(
        `No app found with ID: ${appStoreId}`,
        "NOT_FOUND"
      )
    }

    const result = data.results[0]
    const metadata = normalizeMetadata(result, country)

    console.info(`[Apple API] Found "${metadata.name}" by ${metadata.developerName}`)

    return metadata
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof AppStoreError) {
      throw error
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new AppStoreError(
          `Request timed out after ${timeout}ms`,
          "NETWORK_ERROR"
        )
      }

      throw new AppStoreError(
        `Network error: ${error.message}`,
        "NETWORK_ERROR"
      )
    }

    throw new AppStoreError(
      "Unknown error fetching app metadata",
      "NETWORK_ERROR"
    )
  }
}

/**
 * Normalize Apple API response to our internal type.
 */
function normalizeMetadata(
  result: AppleLookupResult,
  country: string
): AppStoreMetadata {
  // Get the best available icon URL (prefer 512, fall back to smaller)
  const iconUrl =
    result.artworkUrl512 ||
    result.artworkUrl100?.replace("100x100", "512x512") ||
    result.artworkUrl60?.replace("60x60", "512x512") ||
    ""

  // Ensure HTTPS
  const secureIconUrl = iconUrl.replace(/^http:/, "https:")

  return {
    appStoreId: String(result.trackId),
    name: result.trackName,
    developerName: result.artistName,
    iconUrl: secureIconUrl,
    storeUrl: result.trackViewUrl,
    primaryCategory: result.primaryGenreName,
    averageRating: result.averageUserRating,
    ratingCount: result.userRatingCount,
    bundleId: result.bundleId,
    description: result.description,
    version: result.version,
    releaseDate: result.releaseDate,
    country,
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Parse identifier and fetch metadata in one call.
 * Handles both URL and numeric ID inputs.
 */
export async function lookupApp(
  identifier: string,
  country: string = "us"
): Promise<AppStoreMetadata> {
  const appStoreId = parseAppStoreId(identifier)
  return fetchAppStoreMetadata(appStoreId, country)
}

/**
 * Validate that an identifier can be parsed without fetching.
 * Useful for client-side validation before form submission.
 */
export function isValidAppStoreIdentifier(identifier: string): boolean {
  try {
    parseAppStoreId(identifier)
    return true
  } catch {
    return false
  }
}
