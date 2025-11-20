/**
 * iTunes Lookup API Integration
 *
 * Fetches app metadata from Apple's iTunes Lookup API
 * API Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
 */

export interface iTunesAppResult {
  trackId: number
  trackName: string
  bundleId: string
  artistName: string
  primaryGenreName: string
  genres: string[]
  averageUserRating: number
  userRatingCount: number
  artworkUrl60: string
  artworkUrl100: string
  artworkUrl512: string
  version: string
  releaseNotes?: string
  description: string
  currentVersionReleaseDate: string
  price: number
  currency: string
  contentAdvisoryRating: string
  trackViewUrl: string
}

export interface iTunesLookupResponse {
  resultCount: number
  results: iTunesAppResult[]
}

/**
 * Fetch app details from iTunes Lookup API
 */
export async function fetchAppFromiTunes(
  appStoreId: string,
  country: string = "us"
): Promise<iTunesAppResult | null> {
  try {
    const url = `https://itunes.apple.com/lookup?id=${appStoreId}&country=${country}&entity=software`

    const response = await fetch(url, {
      headers: {
        "User-Agent": "App Review Analyzer/1.0",
      },
    })

    if (!response.ok) {
      console.error(`[iTunes Lookup] HTTP ${response.status}: ${response.statusText}`)
      return null
    }

    const data: iTunesLookupResponse = await response.json()

    if (data.resultCount === 0 || !data.results || data.results.length === 0) {
      console.error(`[iTunes Lookup] No results found for app ID: ${appStoreId}`)
      return null
    }

    return data.results[0]
  } catch (error) {
    console.error(`[iTunes Lookup] Error fetching app ${appStoreId}:`, error)
    return null
  }
}

/**
 * Get high-resolution app icon URL
 * Converts the default 100x100 artwork URL to 512x512
 */
export function getHighResIconUrl(artworkUrl: string): string {
  // Convert 100x100bb.jpg to 512x512bb.jpg for better quality
  return artworkUrl.replace(/100x100bb\.jpg$/, "512x512bb.jpg")
}

/**
 * Extract app metadata for database storage
 */
export function extractAppMetadata(result: iTunesAppResult) {
  return {
    name: result.trackName,
    bundleId: result.bundleId,
    developerName: result.artistName,
    primaryCategory: result.primaryGenreName,
    iconUrl: result.artworkUrl512 || getHighResIconUrl(result.artworkUrl100),
    averageRating: result.averageUserRating || null,
    ratingCount: result.userRatingCount || null,
    appStoreUrl: result.trackViewUrl,
    currentVersion: result.version,
    description: result.description,
  }
}
