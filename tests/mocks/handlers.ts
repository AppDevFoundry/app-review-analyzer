/**
 * MSW (Mock Service Worker) request handlers
 *
 * These handlers intercept network requests during tests
 * and return mock responses.
 */

import { http, HttpResponse } from "msw"
import { getMockResponse } from "./apple-api"
import { generateMockRSSFeed, generateEmptyRSSFeed } from "./apple-reviews-rss"

export const handlers = [
  // Mock iTunes Lookup API
  http.get("https://itunes.apple.com/lookup", ({ request }) => {
    const url = new URL(request.url)
    const appId = url.searchParams.get("id")

    if (!appId) {
      return HttpResponse.json(
        { error: "Missing id parameter" },
        { status: 400 }
      )
    }

    const mockResponse = getMockResponse(appId)
    return HttpResponse.json(mockResponse)
  }),

  // Mock Apple RSS Reviews API
  http.get("https://itunes.apple.com/:country/rss/customerreviews/*", ({ request, params }) => {
    const url = new URL(request.url)
    const path = url.pathname

    // Extract app ID from path like /us/rss/customerreviews/page=1/id=1570489264/sortby=mostrecent/json
    const idMatch = path.match(/\/id=(\d+)/)
    const pageMatch = path.match(/\/page=(\d+)/)
    const sortMatch = path.match(/\/sortby=(mostrecent|mosthelpful)/)

    if (!idMatch) {
      return HttpResponse.json(
        { error: "Missing app ID" },
        { status: 400 }
      )
    }

    const appStoreId = idMatch[1]
    const page = pageMatch ? parseInt(pageMatch[1], 10) : 1
    const sortBy = (sortMatch?.[1] || "mostrecent") as "mostrecent" | "mosthelpful"

    // Return empty feed for unknown app ID
    if (appStoreId === "99999999999") {
      return HttpResponse.json(generateEmptyRSSFeed(appStoreId, sortBy))
    }

    // Generate mock feed with reviews
    const feed = generateMockRSSFeed(appStoreId, sortBy, page, 10)
    return HttpResponse.json(feed)
  }),
]
