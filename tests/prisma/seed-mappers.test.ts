import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"

// Types matching the seed script
interface PrototypeReview {
  id: string
  author: string
  rating: string
  version: string
  title: string
  content: string
  updated: string
  vote_sum: string
  vote_count: string
}

interface PrototypeReviewsFile {
  metadata: {
    app_id: string
    sort_by: string
    fetch_timestamp: string
    total_pages: number
    total_reviews: number
    app_name: string
  }
  reviews: PrototypeReview[]
}

interface PrototypeAnalysisFile {
  app_id: string
  analysis_date: string
  total_reviews_analyzed: number
  ratings: {
    distribution: Record<string, number>
    total_reviews: number
    average_rating: number
  }
  issues: {
    issue_categories: Record<string, { count: number }>
    total_issues_found: number
    feature_requests_count: number
  }
  positives: {
    top_positive_aspects: Record<string, number>
    total_positive_reviews: number
  }
  llm_insights: {
    complaints: Array<{ complaint: string; count: number }>
    feature_requests: Array<{ request: string; count: number }>
    main_opportunity: string
  }
}

// Mapper functions (these should match the seed script logic)
function mapReviewSource(sortBy: string): "MOST_RECENT" | "MOST_HELPFUL" | "UNKNOWN" {
  switch (sortBy) {
    case "mostrecent":
      return "MOST_RECENT"
    case "mosthelpful":
      return "MOST_HELPFUL"
    default:
      return "UNKNOWN"
  }
}

function mapIssueCategoryToThemeKey(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]/g, "_")
}

function computeSentimentCounts(distribution: Record<string, number>): {
  positiveCount: number
  neutralCount: number
  negativeCount: number
} {
  const d = distribution
  return {
    positiveCount: (d["4"] || 0) + (d["5"] || 0),
    neutralCount: d["3"] || 0,
    negativeCount: (d["1"] || 0) + (d["2"] || 0),
  }
}

function determinePriority(count: number): "LOW" | "MEDIUM" | "HIGH" {
  if (count >= 10) return "HIGH"
  if (count >= 5) return "MEDIUM"
  return "LOW"
}

// Load test fixtures
function loadFixture<T>(filename: string): T {
  const path = resolve(__dirname, "../fixtures", filename)
  const content = readFileSync(path, "utf-8")
  return JSON.parse(content) as T
}

describe("Seed mapper functions", () => {
  describe("mapReviewSource", () => {
    it("should map 'mostrecent' to MOST_RECENT", () => {
      expect(mapReviewSource("mostrecent")).toBe("MOST_RECENT")
    })

    it("should map 'mosthelpful' to MOST_HELPFUL", () => {
      expect(mapReviewSource("mosthelpful")).toBe("MOST_HELPFUL")
    })

    it("should map unknown values to UNKNOWN", () => {
      expect(mapReviewSource("other")).toBe("UNKNOWN")
      expect(mapReviewSource("")).toBe("UNKNOWN")
      expect(mapReviewSource("random")).toBe("UNKNOWN")
    })
  })

  describe("mapIssueCategoryToThemeKey", () => {
    it("should convert to lowercase", () => {
      expect(mapIssueCategoryToThemeKey("UI_UX")).toBe("ui_ux")
      expect(mapIssueCategoryToThemeKey("CRASHES")).toBe("crashes")
    })

    it("should replace non-alphanumeric chars with underscores", () => {
      expect(mapIssueCategoryToThemeKey("crashes-bugs")).toBe("crashes_bugs")
      expect(mapIssueCategoryToThemeKey("sync/data")).toBe("sync_data")
    })

    it("should handle spaces", () => {
      expect(mapIssueCategoryToThemeKey("user interface")).toBe("user_interface")
    })
  })

  describe("computeSentimentCounts", () => {
    it("should correctly categorize ratings", () => {
      const distribution = {
        "1": 10,
        "2": 20,
        "3": 30,
        "4": 40,
        "5": 50,
      }

      const result = computeSentimentCounts(distribution)

      expect(result.positiveCount).toBe(90) // 4★ + 5★
      expect(result.neutralCount).toBe(30) // 3★
      expect(result.negativeCount).toBe(30) // 1★ + 2★
    })

    it("should handle missing ratings", () => {
      const distribution = {
        "5": 100,
      }

      const result = computeSentimentCounts(distribution)

      expect(result.positiveCount).toBe(100)
      expect(result.neutralCount).toBe(0)
      expect(result.negativeCount).toBe(0)
    })

    it("should handle empty distribution", () => {
      const distribution = {}

      const result = computeSentimentCounts(distribution)

      expect(result.positiveCount).toBe(0)
      expect(result.neutralCount).toBe(0)
      expect(result.negativeCount).toBe(0)
    })
  })

  describe("determinePriority", () => {
    it("should return HIGH for counts >= 10", () => {
      expect(determinePriority(10)).toBe("HIGH")
      expect(determinePriority(100)).toBe("HIGH")
    })

    it("should return MEDIUM for counts 5-9", () => {
      expect(determinePriority(5)).toBe("MEDIUM")
      expect(determinePriority(9)).toBe("MEDIUM")
    })

    it("should return LOW for counts < 5", () => {
      expect(determinePriority(4)).toBe("LOW")
      expect(determinePriority(1)).toBe("LOW")
      expect(determinePriority(0)).toBe("LOW")
    })
  })
})

describe("Fixture data validation", () => {
  let analysisData: PrototypeAnalysisFile
  let reviewsData: PrototypeReviewsFile

  beforeAll(() => {
    analysisData = loadFixture<PrototypeAnalysisFile>("sample-analysis.json")
    reviewsData = loadFixture<PrototypeReviewsFile>("sample-reviews.json")
  })

  describe("sample-analysis.json", () => {
    it("should have valid app_id", () => {
      expect(analysisData.app_id).toBe("1570489264")
    })

    it("should have ratings distribution that sums correctly", () => {
      const dist = analysisData.ratings.distribution
      const sum = Object.values(dist).reduce((a, b) => a + b, 0)
      expect(sum).toBe(analysisData.ratings.total_reviews)
    })

    it("should have llm_insights with complaints and feature requests", () => {
      expect(analysisData.llm_insights.complaints).toBeInstanceOf(Array)
      expect(analysisData.llm_insights.complaints.length).toBeGreaterThan(0)
      expect(analysisData.llm_insights.feature_requests).toBeInstanceOf(Array)
      expect(analysisData.llm_insights.feature_requests.length).toBeGreaterThan(0)
    })

    it("should have main_opportunity summary", () => {
      expect(typeof analysisData.llm_insights.main_opportunity).toBe("string")
      expect(analysisData.llm_insights.main_opportunity.length).toBeGreaterThan(0)
    })

    it("should map to correct sentiment counts", () => {
      const result = computeSentimentCounts(analysisData.ratings.distribution)

      // Based on fixture: 1:62, 2:37, 3:78, 4:102, 5:460
      expect(result.positiveCount).toBe(562) // 102 + 460
      expect(result.neutralCount).toBe(78)
      expect(result.negativeCount).toBe(99) // 62 + 37
    })
  })

  describe("sample-reviews.json", () => {
    it("should have matching app_id", () => {
      expect(reviewsData.metadata.app_id).toBe("1570489264")
    })

    it("should have reviews array with correct structure", () => {
      expect(reviewsData.reviews).toBeInstanceOf(Array)
      expect(reviewsData.reviews.length).toBeGreaterThan(0)

      const firstReview = reviewsData.reviews[0]
      expect(firstReview.id).toBeDefined()
      expect(firstReview.author).toBeDefined()
      expect(firstReview.rating).toBeDefined()
      expect(firstReview.content).toBeDefined()
      expect(firstReview.updated).toBeDefined()
    })

    it("should have parseable ratings", () => {
      for (const review of reviewsData.reviews) {
        const rating = parseInt(review.rating, 10)
        expect(rating).toBeGreaterThanOrEqual(1)
        expect(rating).toBeLessThanOrEqual(5)
      }
    })

    it("should have parseable dates", () => {
      for (const review of reviewsData.reviews) {
        const date = new Date(review.updated)
        expect(date.getTime()).not.toBeNaN()
      }
    })

    it("should map sort_by to correct ReviewSource", () => {
      const source = mapReviewSource(reviewsData.metadata.sort_by)
      expect(source).toBe("MOST_RECENT")
    })
  })
})

// Helper to make beforeAll work in describe blocks
function beforeAll(fn: () => void | Promise<void>) {
  // This is a simplified version - in real tests, use Vitest's beforeAll
  fn()
}
