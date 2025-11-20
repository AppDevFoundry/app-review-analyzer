# Python Analyzer Output Specification

This document specifies the expected JSON output format from the Python review analyzer script for seamless integration with the App Review Analyzer database.

## Current Format (v1.0 - Prototype)

The current Python analyzer outputs analysis results in this format:

```json
{
  "app_id": "1570489264",
  "app_name": "StoryGraph",
  "analysis_date": "2025-08-04T21:13:50.246233",
  "total_reviews_analyzed": 739,
  "ratings": {
    "distribution": {"1": 62, "2": 37, "3": 78, "4": 102, "5": 460},
    "total_reviews": 739,
    "average_rating": 4.17,
    "median_rating": 5,
    "low_ratings_count": 177,
    "high_ratings_count": 562
  },
  "trends": {
    "monthly_trends": {
      "2024-09": {"count": 6, "avg_rating": 4.17},
      "2024-10": {"count": 45, "avg_rating": 4.2}
    },
    "recent_trend": "improving",
    "recent_avg_rating": 4.38
  },
  "issues": {
    "issue_categories": {
      "features": {
        "count": 89,
        "examples": [
          {"rating": "3", "excerpt": "There's a ton of potential..."}
        ]
      }
    },
    "total_issues_found": 334,
    "feature_requests_count": 78,
    "feature_request_samples": [
      {"rating": "4", "excerpt": "I love the functionality..."}
    ]
  },
  "positives": {
    "top_positive_aspects": {
      "features": 475,
      "stats_analytics": 393
    },
    "total_positive_reviews": 562
  },
  "llm_insights": {
    "complaints": [
      {"complaint": "UI/UX issues", "count": 10}
    ],
    "feature_requests": [
      {"request": "Enhanced Kindle integration", "count": 2}
    ],
    "main_opportunity": "Improving the user interface..."
  }
}
```

## Recommended Enhanced Format (v2.0)

To enable direct linking between insights and reviews, we recommend enhancing the output to include review IDs:

```json
{
  // ... all existing fields from v1.0 ...

  "issues": {
    "issue_categories": {
      "features": {
        "count": 89,
        "review_ids": [                    // NEW: Array of all review IDs for this category
          "12968046981",
          "12955303975",
          "12944654788"
        ],
        "examples": [
          {
            "review_id": "12968046981",    // NEW: Include review ID with each example
            "rating": "3",
            "excerpt": "There's a ton of potential..."
          }
        ]
      }
    },
    "feature_request_samples": [
      {
        "review_id": "12955303975",        // NEW: Include review ID with each sample
        "rating": "4",
        "excerpt": "I love the functionality..."
      }
    ]
  }
}
```

## Benefits of Enhanced Format

1. **Direct Review Linkage**: Create `ReviewInsightLink` records without fuzzy matching
2. **Multi-Category Support**: Same review can be linked to multiple insight categories
3. **Reliability**: No risk of excerpt matching failures
4. **Performance**: Faster seed/import process without matching overhead
5. **Traceability**: Easy to show users "which reviews mentioned this issue"

## Implementation Guide

### Modifying the Python Analyzer

Update `prototype/review-analyzer/review_analyzer.py`:

```python
def analyze_reviews_by_category(reviews):
    categories = {
        "features": {"count": 0, "review_ids": [], "examples": []},
        "pricing": {"count": 0, "review_ids": [], "examples": []},
        # ... other categories
    }

    for review in reviews:
        category = detect_category(review)

        # Add review ID to the category
        categories[category]["review_ids"].append(review["id"])
        categories[category]["count"] += 1

        # Add to examples with review ID
        if len(categories[category]["examples"]) < 3:
            categories[category]["examples"].append({
                "review_id": review["id"],  # Include ID
                "rating": review["rating"],
                "excerpt": truncate(review["content"], 200)
            })

    return categories
```

### Database Import Changes

Once the enhanced format is available, update `lib/data-mappers/analysis-mapper.ts`:

```typescript
// Instead of storing only excerpts for matching later:
rawExcerpt: example.excerpt

// Store the review_id directly:
linkedReviewIds: categoryData.review_ids

// And in seed.ts, create ReviewInsightLink records directly:
for (const reviewId of insight.linkedReviewIds) {
  await prisma.reviewInsightLink.create({
    data: {
      insightId: insight.id,
      reviewId: reviewId,
      relevanceScore: 1.0  // Perfect match since it's direct
    }
  })
}
```

## Backward Compatibility

The current seed script supports both formats:

- **v1.0 (current)**: Uses excerpt matching with 100% exact match rate
- **v2.0 (enhanced)**: Will use direct review IDs when available

The database schema already supports both approaches via the `ReviewSnapshotInsight.rawExcerpt` field (for v1.0) and the `ReviewInsightLink` table (for both versions).

## Migration Path

1. **Phase 1** (Current): Use v1.0 format with excerpt matching
2. **Phase 2**: Update Python analyzer to output v2.0 format
3. **Phase 3**: Update seed/import scripts to use review_ids when available
4. **Phase 4**: Deprecate excerpt matching code once v2.0 is stable

## Testing

Test data files are located in `prototype/review-analyzer/`:

- `1570489264_most_recent.json` - Raw reviews (500 items)
- `1570489264_most_helpful.json` - Raw reviews (500 items)
- `1570489264_analysis_*.json` - Analysis results (v1.0 format)

When testing v2.0 format, ensure:
- All `review_id` values reference valid reviews in the raw review files
- No duplicate review IDs within a single category (use Set/unique)
- Review IDs are strings, not integers (matching the JSON input format)
