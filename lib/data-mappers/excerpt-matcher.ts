import { Review } from "@prisma/client"

/**
 * Result of matching an excerpt to reviews
 */
export interface ExcerptMatchResult {
  matched: boolean
  reviewId: string | null
  confidence: number // 0-1, where 1 is exact match
  method: "exact" | "fuzzy" | "none"
}

/**
 * Statistics about excerpt matching process
 */
export interface ExcerptMatchingStats {
  totalExcerpts: number
  exactMatches: number
  fuzzyMatches: number
  unmatched: number
  averageConfidence: number
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
}

/**
 * Calculate similarity between two strings using simple character overlap
 * Returns a score between 0 and 1
 */
function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeText(str1)
  const normalized2 = normalizeText(str2)

  // Check if one is a substring of the other (common for excerpts)
  if (normalized2.includes(normalized1) || normalized1.includes(normalized2)) {
    const lengthRatio = Math.min(normalized1.length, normalized2.length) /
                        Math.max(normalized1.length, normalized2.length)
    return Math.min(lengthRatio + 0.3, 1.0) // Boost score for substring matches
  }

  // Simple character overlap score
  const set1 = new Set(normalized1.split(" "))
  const set2 = new Set(normalized2.split(" "))

  const intersection = new Set(Array.from(set1).filter((x) => set2.has(x)))
  const union = new Set([...Array.from(set1), ...Array.from(set2)])

  return intersection.size / union.size
}

/**
 * Match a single excerpt to a list of reviews
 *
 * @param excerpt - The excerpt text to match (may be truncated with "...")
 * @param reviews - List of reviews to search
 * @param minConfidence - Minimum confidence threshold (default: 0.6)
 * @returns Match result with review ID if found
 */
export function matchExcerptToReviews(
  excerpt: string,
  reviews: Review[],
  minConfidence: number = 0.6
): ExcerptMatchResult {
  if (!excerpt || excerpt.trim() === "") {
    return {
      matched: false,
      reviewId: null,
      confidence: 0,
      method: "none",
    }
  }

  // Remove trailing "..." if present (common in excerpts)
  const cleanExcerpt = excerpt.replace(/\.{3,}$/, "").trim()
  const normalizedExcerpt = normalizeText(cleanExcerpt)

  let bestMatch: { reviewId: string; confidence: number; method: "exact" | "fuzzy" } | null =
    null

  for (const review of reviews) {
    const reviewContent = review.content || ""
    const reviewTitle = review.title || ""
    const fullText = `${reviewTitle} ${reviewContent}`

    // Try exact substring match first (fastest)
    const normalizedReview = normalizeText(fullText)
    if (normalizedReview.includes(normalizedExcerpt)) {
      return {
        matched: true,
        reviewId: review.id,
        confidence: 1.0,
        method: "exact",
      }
    }

    // Try fuzzy matching
    const similarity = calculateSimilarity(cleanExcerpt, fullText)
    if (similarity >= minConfidence) {
      if (!bestMatch || similarity > bestMatch.confidence) {
        bestMatch = {
          reviewId: review.id,
          confidence: similarity,
          method: "fuzzy",
        }
      }
    }
  }

  if (bestMatch) {
    return {
      matched: true,
      reviewId: bestMatch.reviewId,
      confidence: bestMatch.confidence,
      method: bestMatch.method,
    }
  }

  return {
    matched: false,
    reviewId: null,
    confidence: 0,
    method: "none",
  }
}

/**
 * Batch match multiple excerpts to reviews
 *
 * @param excerpts - Array of excerpt texts
 * @param reviews - List of reviews to search
 * @param minConfidence - Minimum confidence threshold
 * @returns Array of match results in same order as excerpts
 */
export function batchMatchExcerpts(
  excerpts: string[],
  reviews: Review[],
  minConfidence: number = 0.6
): ExcerptMatchResult[] {
  return excerpts.map((excerpt) => matchExcerptToReviews(excerpt, reviews, minConfidence))
}

/**
 * Calculate statistics about excerpt matching results
 */
export function calculateMatchingStats(matches: ExcerptMatchResult[]): ExcerptMatchingStats {
  const totalExcerpts = matches.length
  const exactMatches = matches.filter((m) => m.method === "exact").length
  const fuzzyMatches = matches.filter((m) => m.method === "fuzzy").length
  const unmatched = matches.filter((m) => !m.matched).length

  const totalConfidence = matches.reduce((sum, m) => sum + m.confidence, 0)
  const averageConfidence = totalExcerpts > 0 ? totalConfidence / totalExcerpts : 0

  return {
    totalExcerpts,
    exactMatches,
    fuzzyMatches,
    unmatched,
    averageConfidence,
  }
}

/**
 * Filter reviews by rating to improve matching accuracy
 * Since excerpts in the analysis include rating info, we can pre-filter
 */
export function filterReviewsByRating(reviews: Review[], rating: number): Review[] {
  return reviews.filter((review) => review.rating === rating)
}

/**
 * Create ReviewInsightLink data from match results
 */
export function createInsightLinksFromMatches(
  insightId: string,
  matches: ExcerptMatchResult[]
): Array<{ insightId: string; reviewId: string; relevanceScore: number }> {
  return matches
    .filter((match) => match.matched && match.reviewId)
    .map((match) => ({
      insightId,
      reviewId: match.reviewId!,
      relevanceScore: match.confidence,
    }))
}
