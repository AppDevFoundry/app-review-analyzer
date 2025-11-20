/**
 * MSW (Mock Service Worker) request handlers
 *
 * These handlers intercept network requests during tests
 * and return mock responses.
 */

import { http, HttpResponse } from "msw"
import { getMockResponse } from "./apple-api"

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
]
