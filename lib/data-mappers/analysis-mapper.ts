import {
  Prisma,
  SnapshotStatus,
  InsightType,
  InsightCategory,
  InsightPriority,
} from "@prisma/client"

/**
 * Raw analysis JSON structure from Python analyzer
 */
export interface RawAnalysisData {
  app_id: string
  app_name: string
  analysis_date: string
  total_reviews_analyzed: number
  ratings: {
    distribution: Record<string, number> // "1", "2", "3", "4", "5"
    total_reviews: number
    average_rating: number
    median_rating: number
    low_ratings_count: number
    high_ratings_count: number
  }
  trends: {
    monthly_trends: Record<string, { count: number; avg_rating: number }> // "YYYY-MM"
    recent_trend: "improving" | "declining" | "stable"
    recent_avg_rating: number
  }
  issues: {
    issue_categories: Record<
      string,
      {
        count: number
        examples: Array<{
          rating: string
          excerpt: string
        }>
      }
    >
    total_issues_found: number
    feature_requests_count: number
    feature_request_samples: Array<{
      rating: string
      excerpt: string
    }>
  }
  positives: {
    top_positive_aspects: Record<string, number>
    total_positive_reviews: number
  }
  llm_insights?: {
    complaints: Array<{
      complaint: string
      count: number
    }>
    feature_requests: Array<{
      request: string
      count: number
    }>
    main_opportunity: string
  }
}

/**
 * Result of mapping analysis data to Prisma models
 */
export interface AnalysisMappingResult {
  snapshot: Omit<Prisma.ReviewSnapshotCreateInput, "workspace" | "app">
  ratingDistribution: Omit<Prisma.RatingDistributionCreateInput, "reviewSnapshot">
  monthlyTrends: Array<Omit<Prisma.MonthlyTrendCreateInput, "reviewSnapshot">>
  insights: Array<Omit<Prisma.ReviewSnapshotInsightCreateInput, "reviewSnapshot" | "workspace">>
  positiveAspects: Array<Omit<Prisma.PositiveAspectCreateInput, "reviewSnapshot">>
  llmInsight?: Omit<Prisma.LLMInsightCreateInput, "reviewSnapshot">
}

/**
 * Map issue category key to InsightCategory enum
 */
function mapIssueCategoryToEnum(categoryKey: string): InsightCategory {
  const mapping: Record<string, InsightCategory> = {
    features: InsightCategory.FEATURES,
    pricing: InsightCategory.PRICING,
    ui_ux: InsightCategory.UI_UX,
    sync_data: InsightCategory.SYNC_DATA,
    search_discovery: InsightCategory.SEARCH_DISCOVERY,
    crashes_bugs: InsightCategory.CRASHES_BUGS,
    performance: InsightCategory.PERFORMANCE,
    social: InsightCategory.SOCIAL,
  }

  return mapping[categoryKey] || InsightCategory.FEATURES
}

/**
 * Convert raw analysis JSON to Prisma create inputs
 */
export function mapAnalysisToPrisma(
  rawData: RawAnalysisData,
  workspaceId: string,
  appId: string
): AnalysisMappingResult {
  const analysisDate = new Date(rawData.analysis_date)

  // Map ReviewSnapshot
  const snapshot: Omit<Prisma.ReviewSnapshotCreateInput, "workspace" | "app"> = {
    status: SnapshotStatus.SUCCEEDED,
    analysisDate,
    totalReviewsAnalyzed: rawData.total_reviews_analyzed,
    averageRating: rawData.ratings.average_rating,
    medianRating: rawData.ratings.median_rating,
    lowRatingsCount: rawData.ratings.low_ratings_count,
    highRatingsCount: rawData.ratings.high_ratings_count,
    positiveCount: rawData.positives.total_positive_reviews,
    neutralCount: 0, // Not provided in prototype, calculate if needed
    negativeCount: rawData.ratings.low_ratings_count,
    recentTrend: rawData.trends.recent_trend,
    recentAvgRating: rawData.trends.recent_avg_rating,
  }

  // Map RatingDistribution
  const dist = rawData.ratings.distribution
  const ratingDistribution: Omit<
    Prisma.RatingDistributionCreateInput,
    "reviewSnapshot"
  > = {
    oneStar: dist["1"] || 0,
    twoStar: dist["2"] || 0,
    threeStar: dist["3"] || 0,
    fourStar: dist["4"] || 0,
    fiveStar: dist["5"] || 0,
    totalReviews: rawData.ratings.total_reviews,
  }

  // Map MonthlyTrends
  const monthlyTrends: Array<Omit<Prisma.MonthlyTrendCreateInput, "reviewSnapshot">> =
    Object.entries(rawData.trends.monthly_trends).map(([month, data]) => ({
      month,
      reviewCount: data.count,
      averageRating: data.avg_rating,
    }))

  // Map ReviewSnapshotInsights from issue categories
  const insights: Array<
    Omit<Prisma.ReviewSnapshotInsightCreateInput, "reviewSnapshot" | "workspace">
  > = []

  // Add issue category insights
  Object.entries(rawData.issues.issue_categories).forEach(([categoryKey, categoryData]) => {
    const category = mapIssueCategoryToEnum(categoryKey)

    // Create an insight for each example (for now - could aggregate later)
    categoryData.examples.forEach((example, index) => {
      insights.push({
        type: InsightType.BUG_OR_COMPLAINT,
        category,
        priority: InsightPriority.MEDIUM,
        title: `${categoryKey.replace(/_/g, " ").toUpperCase()} Issue`,
        description: example.excerpt,
        mentionCount: categoryData.count,
        themeKey: categoryKey,
        rawExcerpt: example.excerpt,
      })
    })
  })

  // Add feature request insights
  rawData.issues.feature_request_samples.forEach((sample, index) => {
    insights.push({
      type: InsightType.FEATURE_REQUEST,
      category: null,
      priority: InsightPriority.HIGH,
      title: "Feature Request",
      description: sample.excerpt,
      mentionCount: rawData.issues.feature_requests_count,
      themeKey: "feature_request",
      rawExcerpt: sample.excerpt,
    })
  })

  // Add praise insights from positive aspects
  Object.entries(rawData.positives.top_positive_aspects).forEach(([aspect, count]) => {
    insights.push({
      type: InsightType.PRAISE,
      category: null,
      priority: InsightPriority.LOW,
      title: `Positive: ${aspect.replace(/_/g, " ")}`,
      description: `Users appreciate ${aspect.replace(/_/g, " ")}`,
      mentionCount: count,
      themeKey: aspect,
      rawExcerpt: null,
    })
  })

  // Map PositiveAspects
  const positiveAspects: Array<Omit<Prisma.PositiveAspectCreateInput, "reviewSnapshot">> =
    Object.entries(rawData.positives.top_positive_aspects).map(([aspect, count]) => ({
      aspect,
      mentionCount: count,
    }))

  // Map LLMInsight (if present)
  let llmInsight: Omit<Prisma.LLMInsightCreateInput, "reviewSnapshot"> | undefined
  if (rawData.llm_insights) {
    llmInsight = {
      complaints: rawData.llm_insights.complaints as Prisma.InputJsonValue,
      featureRequests: rawData.llm_insights.feature_requests as Prisma.InputJsonValue,
      mainOpportunity: rawData.llm_insights.main_opportunity,
    }
  }

  return {
    snapshot,
    ratingDistribution,
    monthlyTrends,
    insights,
    positiveAspects,
    llmInsight,
  }
}

/**
 * Extract app metadata from analysis data
 */
export function extractAppMetadataFromAnalysis(rawData: RawAnalysisData): {
  appStoreId: string
  name: string
} {
  return {
    appStoreId: rawData.app_id,
    name: rawData.app_name,
  }
}
