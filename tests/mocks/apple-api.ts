/**
 * Mock Apple API responses for testing
 */

export const mockStoryGraphResponse = {
  resultCount: 1,
  results: [
    {
      trackId: 1570489264,
      trackName: "StoryGraph",
      artistName: "StoryGraph",
      artworkUrl512:
        "https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/aa/bb/cc/storygraph.png",
      artworkUrl100:
        "https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/aa/bb/cc/storygraph-100.png",
      trackViewUrl: "https://apps.apple.com/us/app/storygraph/id1570489264",
      primaryGenreName: "Books",
      averageUserRating: 4.8,
      userRatingCount: 15234,
      bundleId: "com.storygraph.app",
    },
  ],
}

export const mockGoodreadsResponse = {
  resultCount: 1,
  results: [
    {
      trackId: 355833469,
      trackName: "Goodreads",
      artistName: "Goodreads Inc",
      artworkUrl512:
        "https://is1-ssl.mzstatic.com/image/thumb/Purple116/v4/dd/ee/ff/goodreads.png",
      artworkUrl100:
        "https://is1-ssl.mzstatic.com/image/thumb/Purple116/v4/dd/ee/ff/goodreads-100.png",
      trackViewUrl: "https://apps.apple.com/us/app/goodreads/id355833469",
      primaryGenreName: "Books",
      averageUserRating: 4.5,
      userRatingCount: 125678,
      bundleId: "com.goodreads.app",
    },
  ],
}

export const mockNotFoundResponse = {
  resultCount: 0,
  results: [],
}

/**
 * Mock responses by app ID
 */
export const mockAppResponses: Record<string, any> = {
  "1570489264": mockStoryGraphResponse,
  "355833469": mockGoodreadsResponse,
}

/**
 * Get mock response for an app ID
 */
export function getMockResponse(appId: string) {
  return mockAppResponses[appId] || mockNotFoundResponse
}
