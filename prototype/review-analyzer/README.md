# iOS App Store Review Analyzer

A Python-based tool to fetch and analyze iOS App Store reviews, extracting actionable insights about user complaints, feature requests, and opportunities for app improvement.

## Features

- **Review Fetching**: Automatically fetches all paginated reviews (Most Helpful & Most Recent)
- **Statistical Analysis**: Rating distributions, temporal trends, and averages
- **Issue Categorization**: Automatically categorizes issues into crashes, performance, UI/UX, etc.
- **Feature Extraction**: Identifies feature requests from review text
- **Positive Insights**: Extracts what users love about the app
- **LLM Integration**: Optional Ollama integration for deeper AI-powered insights
- **Multiple Output Formats**: JSON for programmatic use, Markdown for human reading

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd review-analyzer
```

2. No external dependencies required for basic functionality! Uses Python standard library only.

3. (Optional) For LLM analysis, install Ollama:
```bash
# macOS
brew install ollama

# or download from https://ollama.com
```

## Usage

### Step 1: Fetch Reviews
First, fetch reviews for any iOS app using its App Store ID:

```bash
python3 app_reviews_fetcher.py --app-id 1570489264
```

This creates:
- `1570489264_most_helpful.json` - Top helpful reviews
- `1570489264_most_recent.json` - Latest reviews

### Step 2: Analyze Reviews

#### Basic Analysis (No LLM)
```bash
python3 review_analyzer.py --app-id 1570489264
```

#### With Ollama LLM for Deeper Insights
```bash
# First, start Ollama and pull a model
ollama pull mistral

# Then run analysis with LLM
python3 review_analyzer.py --app-id 1570489264 --llm
```

#### Output Options
```bash
# JSON only (for web apps/APIs)
python3 review_analyzer.py --app-id 1570489264 --output json

# Markdown report only
python3 review_analyzer.py --app-id 1570489264 --output markdown

# Both formats (default)
python3 review_analyzer.py --app-id 1570489264 --output both
```

## Output Examples

### Markdown Report
The tool generates comprehensive markdown reports including:
- Executive summary with key metrics
- Rating distribution visualization
- Categorized issues with example reviews
- What users love about the app
- AI-generated insights (if LLM enabled)
- Actionable recommendations

### JSON Output
Structured data perfect for:
- Building dashboards
- API integrations
- Further processing
- Competitive analysis tools

## Example Insights

From analyzing the StoryGraph app (ID: 1570489264):

**Issues Found:**
- Features: 89 mentions (missing Kindle integration, social features)
- Crashes/Bugs: 75 mentions (app freezing, import issues)
- UI/UX: 45 mentions (confusing interface, navigation issues)
- Performance: 39 mentions (slow loading, lag)

**What Users Love:**
- Statistics and analytics (393 mentions)
- Book organization features (315 mentions)
- Recommendation engine (187 mentions)

## Recommended Ollama Models

For best results with review analysis:
- **Mistral 7B** - Good balance of speed and quality
- **Llama 3.2 3B** - Faster, lighter option
- **Qwen2.5 7B** - Great for multilingual reviews

## Future Enhancements

- Next.js web interface for visualization
- Batch processing for competitor analysis
- Trend tracking over time
- Automated report generation
- API service for integration

## File Structure
```
review-analyzer/
├── app_reviews_fetcher.py    # Fetches reviews from Apple RSS
├── review_analyzer.py        # Analyzes reviews for insights
├── requirements.txt          # Python dependencies (optional)
├── .gitignore               # Excludes JSON output files
└── README.md                # This file
```

## License

MIT License - feel free to use for your app market research!