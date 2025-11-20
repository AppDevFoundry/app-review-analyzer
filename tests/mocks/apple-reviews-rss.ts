/**
 * Mock data for Apple RSS Reviews API
 *
 * Provides mock review data for testing the review ingestion system.
 */

export interface MockRSSEntry {
  id: string
  author: { name: string; uri?: string }
  title: string
  content: { type: string; label: string }
  "im:rating": { label: string }
  "im:version": { label: string }
  "im:voteSum": { label: string }
  "im:voteCount": { label: string }
  updated: { label: string }
}

export interface MockRSSFeed {
  feed: {
    author: { name: { label: string }; uri: { label: string } }
    entry?: MockRSSEntry[]
    link: Array<{
      attributes: {
        rel: string
        type?: string
        href: string
      }
    }>
  }
}

/**
 * Generate mock RSS feed response
 */
export function generateMockRSSFeed(
  appStoreId: string,
  sortBy: "mostrecent" | "mosthelpful",
  page: number = 1,
  entryCount: number = 10
): MockRSSFeed {
  const entries: MockRSSEntry[] = []

  for (let i = 0; i < entryCount; i++) {
    const reviewNum = (page - 1) * 50 + i + 1
    entries.push({
      id: `https://itunes.apple.com/review/${appStoreId}-${reviewNum}`,
      author: {
        name: `User${reviewNum}`,
        uri: `https://itunes.apple.com/user/id${reviewNum}`,
      },
      title: `Review ${reviewNum} Title`,
      content: {
        type: "text",
        label: `This is the content of review ${reviewNum}. ${sortBy === "mosthelpful" ? "Very helpful!" : "Recent review!"}`,
      },
      "im:rating": { label: String((reviewNum % 5) + 1) },
      "im:version": { label: "1.2.3" },
      "im:voteSum": { label: sortBy === "mosthelpful" ? String(100 - i) : String(i) },
      "im:voteCount": { label: String(Math.floor(Math.random() * 50) + 10) },
      updated: {
        label: new Date(Date.now() - i * 86400000).toISOString(),
      },
    })
  }

  const links: MockRSSFeed["feed"]["link"] = [
    {
      attributes: {
        rel: "self",
        href: `https://itunes.apple.com/us/rss/customerreviews/page=${page}/id=${appStoreId}/sortby=${sortBy}/json`,
      },
    },
    {
      attributes: {
        rel: "first",
        href: `https://itunes.apple.com/us/rss/customerreviews/page=1/id=${appStoreId}/sortby=${sortBy}/json`,
      },
    },
  ]

  // Add next link if not last page (simulate 3 pages total)
  if (page < 3) {
    links.push({
      attributes: {
        rel: "next",
        href: `https://itunes.apple.com/us/rss/customerreviews/page=${page + 1}/id=${appStoreId}/sortby=${sortBy}/json`,
      },
    })
  }

  // Add last link
  links.push({
    attributes: {
      rel: "last",
      href: `https://itunes.apple.com/us/rss/customerreviews/page=3/id=${appStoreId}/sortby=${sortBy}/json`,
    },
  })

  return {
    feed: {
      author: {
        name: { label: "iTunes Store" },
        uri: { label: "http://www.apple.com/itunes/" },
      },
      entry: entries,
      link: links,
    },
  }
}

/**
 * Generate empty feed (no reviews)
 */
export function generateEmptyRSSFeed(
  appStoreId: string,
  sortBy: "mostrecent" | "mosthelpful"
): MockRSSFeed {
  return {
    feed: {
      author: {
        name: { label: "iTunes Store" },
        uri: { label: "http://www.apple.com/itunes/" },
      },
      link: [
        {
          attributes: {
            rel: "self",
            href: `https://itunes.apple.com/us/rss/customerreviews/page=1/id=${appStoreId}/sortby=${sortBy}/json`,
          },
        },
      ],
    },
  }
}
