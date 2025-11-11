#!/usr/bin/env python3
"""
App Store Review Analyzer
Analyzes iOS app reviews to extract insights, issues, and opportunities
using local processing and optional Ollama LLM integration.
"""

import json
import argparse
import re
from datetime import datetime, timedelta
from collections import Counter, defaultdict
from typing import Dict, List, Tuple, Optional
import statistics
import subprocess
import sys


class ReviewAnalyzer:
    def __init__(self, app_id: str, use_llm: bool = False, llm_model: str = "mistral"):
        self.app_id = app_id
        self.use_llm = use_llm
        self.llm_model = llm_model
        self.reviews_data = {'most_helpful': None, 'most_recent': None}
        self.analysis_results = {}
        
    def load_reviews(self):
        """Load review data from JSON files."""
        try:
            with open(f"{self.app_id}_most_helpful.json", 'r', encoding='utf-8') as f:
                self.reviews_data['most_helpful'] = json.load(f)
            print(f"✓ Loaded {len(self.reviews_data['most_helpful']['reviews'])} most helpful reviews")
        except FileNotFoundError:
            print(f"✗ Could not find {self.app_id}_most_helpful.json")
            
        try:
            with open(f"{self.app_id}_most_recent.json", 'r', encoding='utf-8') as f:
                self.reviews_data['most_recent'] = json.load(f)
            print(f"✓ Loaded {len(self.reviews_data['most_recent']['reviews'])} most recent reviews")
        except FileNotFoundError:
            print(f"✗ Could not find {self.app_id}_most_recent.json")
            
        if not any(self.reviews_data.values()):
            raise ValueError("No review data found. Please run app_reviews_fetcher.py first.")
    
    def get_all_reviews(self) -> List[Dict]:
        """Combine all reviews from both sources, removing duplicates."""
        all_reviews = []
        seen_ids = set()
        
        for source in ['most_helpful', 'most_recent']:
            if self.reviews_data[source]:
                for review in self.reviews_data[source]['reviews']:
                    if review['id'] not in seen_ids:
                        review['source'] = source
                        all_reviews.append(review)
                        seen_ids.add(review['id'])
        
        return all_reviews
    
    def analyze_ratings_distribution(self, reviews: List[Dict]) -> Dict:
        """Analyze rating distribution and statistics."""
        ratings = [int(review['rating']) for review in reviews]
        rating_counts = Counter(ratings)
        
        # Convert integer keys to strings for consistency
        distribution = {str(k): v for k, v in rating_counts.items()}
        
        return {
            'distribution': distribution,
            'total_reviews': len(ratings),
            'average_rating': round(statistics.mean(ratings), 2),
            'median_rating': statistics.median(ratings),
            'low_ratings_count': sum(1 for r in ratings if r <= 3),
            'high_ratings_count': sum(1 for r in ratings if r >= 4)
        }
    
    def analyze_temporal_trends(self, reviews: List[Dict]) -> Dict:
        """Analyze review trends over time."""
        # Parse dates and sort by time
        dated_reviews = []
        for review in reviews:
            try:
                date = datetime.fromisoformat(review['updated'].replace('Z', '+00:00'))
                dated_reviews.append((date, int(review['rating'])))
            except:
                continue
        
        dated_reviews.sort(key=lambda x: x[0])
        
        # Group by month
        monthly_stats = defaultdict(lambda: {'count': 0, 'ratings': []})
        for date, rating in dated_reviews:
            month_key = date.strftime('%Y-%m')
            monthly_stats[month_key]['count'] += 1
            monthly_stats[month_key]['ratings'].append(rating)
        
        # Calculate monthly averages
        monthly_trends = {}
        for month, stats in monthly_stats.items():
            monthly_trends[month] = {
                'count': stats['count'],
                'avg_rating': round(statistics.mean(stats['ratings']), 2)
            }
        
        # Recent trend (last 3 months vs previous 3 months)
        recent_months = sorted(monthly_trends.keys())[-3:]
        previous_months = sorted(monthly_trends.keys())[-6:-3]
        
        recent_avg = statistics.mean([monthly_trends[m]['avg_rating'] for m in recent_months if m in monthly_trends])
        previous_avg = statistics.mean([monthly_trends[m]['avg_rating'] for m in previous_months if m in monthly_trends]) if previous_months else recent_avg
        
        return {
            'monthly_trends': dict(sorted(monthly_trends.items())[-12:]),  # Last 12 months
            'recent_trend': 'improving' if recent_avg > previous_avg else 'declining' if recent_avg < previous_avg else 'stable',
            'recent_avg_rating': round(recent_avg, 2)
        }
    
    def extract_keywords_and_issues(self, reviews: List[Dict]) -> Dict:
        """Extract common keywords and categorize issues from reviews."""
        # Focus on low-rated reviews for issues
        low_rated_reviews = [r for r in reviews if int(r['rating']) <= 3]
        
        # Common issue keywords and categories
        issue_categories = {
            'crashes_bugs': ['crash', 'bug', 'freeze', 'frozen', 'stuck', 'error', 'broken', 'fix', 'glitch'],
            'performance': ['slow', 'lag', 'loading', 'performance', 'speed', 'responsive'],
            'ui_ux': ['interface', 'design', 'confusing', 'intuitive', 'navigation', 'layout', 'ui', 'ux', 'user experience'],
            'features': ['feature', 'missing', 'need', 'want', 'wish', 'add', 'implement', 'functionality'],
            'sync_data': ['sync', 'data', 'lost', 'backup', 'restore', 'cloud', 'save'],
            'pricing': ['expensive', 'price', 'cost', 'subscription', 'free', 'pay', 'premium'],
            'search_discovery': ['search', 'find', 'discover', 'filter', 'sort'],
            'social': ['friends', 'social', 'share', 'community', 'follow', 'profile']
        }
        
        # Count issues by category
        category_counts = defaultdict(lambda: {'count': 0, 'examples': []})
        
        for review in low_rated_reviews:
            content = (review['title'] + ' ' + review['content']).lower()
            
            for category, keywords in issue_categories.items():
                if any(keyword in content for keyword in keywords):
                    category_counts[category]['count'] += 1
                    if len(category_counts[category]['examples']) < 3:  # Keep 3 examples
                        category_counts[category]['examples'].append({
                            'rating': review['rating'],
                            'excerpt': review['content'][:200] + '...' if len(review['content']) > 200 else review['content']
                        })
        
        # Extract feature requests from all reviews
        feature_patterns = [
            r"would be (nice|great|good) if",
            r"wish (it|this|the app)",
            r"should (add|have|include)",
            r"needs? (to|a|an)",
            r"missing",
            r"please add",
            r"feature request"
        ]
        
        feature_requests = []
        for review in reviews:
            content = (review['title'] + ' ' + review['content']).lower()
            for pattern in feature_patterns:
                if re.search(pattern, content):
                    feature_requests.append({
                        'rating': review['rating'],
                        'excerpt': review['content'][:300] + '...' if len(review['content']) > 300 else review['content']
                    })
                    break
        
        return {
            'issue_categories': dict(category_counts),
            'total_issues_found': sum(cat['count'] for cat in category_counts.values()),
            'feature_requests_count': len(feature_requests),
            'feature_request_samples': feature_requests[:5]  # Top 5 samples
        }
    
    def analyze_positive_aspects(self, reviews: List[Dict]) -> Dict:
        """Extract what users love about the app from high-rated reviews."""
        high_rated_reviews = [r for r in reviews if int(r['rating']) >= 4]
        
        positive_keywords = {
            'stats_analytics': ['stats', 'statistics', 'data', 'analytics', 'track', 'progress', 'graphs'],
            'recommendations': ['recommend', 'suggestion', 'discover', 'find new'],
            'ui_design': ['beautiful', 'clean', 'intuitive', 'easy to use', 'simple', 'design'],
            'features': ['feature', 'love', 'great', 'amazing', 'perfect', 'excellent'],
            'community': ['community', 'friends', 'social', 'share'],
            'organization': ['organize', 'track', 'list', 'collection', 'library']
        }
        
        positive_counts = defaultdict(int)
        
        for review in high_rated_reviews:
            content = (review['title'] + ' ' + review['content']).lower()
            
            for category, keywords in positive_keywords.items():
                if any(keyword in content for keyword in keywords):
                    positive_counts[category] += 1
        
        return {
            'top_positive_aspects': dict(sorted(positive_counts.items(), key=lambda x: x[1], reverse=True)[:5]),
            'total_positive_reviews': len(high_rated_reviews)
        }
    
    def query_ollama(self, prompt: str) -> Optional[str]:
        """Query Ollama for LLM analysis."""
        try:
            # Check if Ollama is running
            result = subprocess.run(['ollama', 'list'], capture_output=True, text=True)
            if result.returncode != 0:
                print("⚠️  Ollama is not running. Please start Ollama first.")
                return None
            
            # Run the query
            cmd = ['ollama', 'run', self.llm_model, prompt]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0:
                return result.stdout.strip()
            else:
                print(f"⚠️  Ollama error: {result.stderr}")
                return None
                
        except subprocess.TimeoutExpired:
            print("⚠️  Ollama query timed out")
            return None
        except FileNotFoundError:
            print("⚠️  Ollama not found. Please install Ollama from https://ollama.com")
            return None
        except Exception as e:
            print(f"⚠️  Error querying Ollama: {e}")
            return None
    
    def llm_analyze_issues(self, reviews: List[Dict]) -> Optional[Dict]:
        """Use LLM to analyze issues and opportunities."""
        if not self.use_llm:
            return None
        
        # Prepare a sample of low-rated reviews
        low_rated = [r for r in reviews if int(r['rating']) <= 3][:20]  # Top 20 most relevant
        
        review_texts = []
        for r in low_rated:
            review_texts.append(f"Rating: {r['rating']}/5\nTitle: {r['title']}\nReview: {r['content'][:300]}...")
        
        prompt = f"""Analyze these iOS app reviews and identify:
1. Top 3 most common user complaints
2. Top 3 feature requests
3. Main opportunity for improvement

Reviews:
{chr(10).join(review_texts)}

Provide a concise analysis in JSON format with keys: complaints, feature_requests, main_opportunity"""

        print("\n🤖 Analyzing reviews with Ollama...")
        response = self.query_ollama(prompt)
        
        if response:
            try:
                # Try to parse JSON from response
                # Ollama might return markdown, so extract JSON
                json_match = re.search(r'\{[\s\S]*\}', response)
                if json_match:
                    return json.loads(json_match.group())
                else:
                    # Return as structured text if not JSON
                    return {'llm_analysis': response}
            except:
                return {'llm_analysis': response}
        
        return None
    
    def generate_summary_report(self):
        """Generate final analysis summary."""
        all_reviews = self.get_all_reviews()
        
        print(f"\n📊 Analyzing {len(all_reviews)} reviews for app {self.app_id}...")
        
        # Run analyses
        self.analysis_results['app_id'] = self.app_id
        self.analysis_results['analysis_date'] = datetime.now().isoformat()
        self.analysis_results['total_reviews_analyzed'] = len(all_reviews)
        
        # Basic statistics
        print("  ✓ Calculating rating statistics...")
        self.analysis_results['ratings'] = self.analyze_ratings_distribution(all_reviews)
        
        # Temporal trends
        print("  ✓ Analyzing temporal trends...")
        self.analysis_results['trends'] = self.analyze_temporal_trends(all_reviews)
        
        # Issues and keywords
        print("  ✓ Extracting issues and feature requests...")
        self.analysis_results['issues'] = self.extract_keywords_and_issues(all_reviews)
        
        # Positive aspects
        print("  ✓ Analyzing positive feedback...")
        self.analysis_results['positives'] = self.analyze_positive_aspects(all_reviews)
        
        # LLM analysis if enabled
        if self.use_llm:
            llm_results = self.llm_analyze_issues(all_reviews)
            if llm_results:
                self.analysis_results['llm_insights'] = llm_results
                print("  ✓ LLM analysis complete")
            else:
                print("  ⚠️  LLM analysis skipped (Ollama not available)")
        
        # App metadata
        if self.reviews_data['most_helpful']:
            self.analysis_results['app_name'] = self.reviews_data['most_helpful']['metadata'].get('app_name', 'Unknown')
        
        return self.analysis_results
    
    def save_results(self, output_format: str = 'json'):
        """Save analysis results to file."""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        if output_format == 'json':
            filename = f"{self.app_id}_analysis_{timestamp}.json"
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(self.analysis_results, f, indent=2, ensure_ascii=False)
            print(f"\n✅ Analysis saved to {filename}")
            
        elif output_format == 'markdown':
            filename = f"{self.app_id}_analysis_{timestamp}.md"
            self.save_markdown_report(filename)
            print(f"\n✅ Report saved to {filename}")
    
    def save_markdown_report(self, filename: str):
        """Generate a human-readable markdown report."""
        with open(filename, 'w', encoding='utf-8') as f:
            r = self.analysis_results
            
            f.write(f"# App Review Analysis Report\n\n")
            f.write(f"**App**: {r.get('app_name', 'Unknown')} (ID: {r['app_id']})\n")
            f.write(f"**Analysis Date**: {datetime.fromisoformat(r['analysis_date']).strftime('%Y-%m-%d %H:%M')}\n")
            f.write(f"**Total Reviews Analyzed**: {r['total_reviews_analyzed']}\n\n")
            
            # Executive Summary
            f.write("## Executive Summary\n\n")
            f.write(f"- **Average Rating**: {r['ratings']['average_rating']}/5\n")
            f.write(f"- **Rating Trend**: {r['trends']['recent_trend'].title()}\n")
            f.write(f"- **Issues Found**: {r['issues']['total_issues_found']} issues across {len(r['issues']['issue_categories'])} categories\n")
            f.write(f"- **Feature Requests**: {r['issues']['feature_requests_count']}\n\n")
            
            # Rating Distribution
            f.write("## Rating Distribution\n\n")
            for rating in range(5, 0, -1):
                count = r['ratings']['distribution'].get(str(rating), 0)
                percentage = (count / r['ratings']['total_reviews']) * 100
                bar = '█' * int(percentage / 2)
                f.write(f"{rating}★: {bar} {count} ({percentage:.1f}%)\n")
            
            # Key Issues
            f.write("\n## Key Issues Identified\n\n")
            sorted_issues = sorted(r['issues']['issue_categories'].items(), 
                                 key=lambda x: x[1]['count'], reverse=True)
            
            for category, data in sorted_issues[:5]:
                f.write(f"### {category.replace('_', ' ').title()} ({data['count']} mentions)\n")
                for example in data['examples'][:2]:
                    f.write(f"- *\"{example['excerpt']}\"* (Rating: {example['rating']}★)\n")
                f.write("\n")
            
            # Positive Aspects
            f.write("## What Users Love\n\n")
            for aspect, count in r['positives']['top_positive_aspects'].items():
                f.write(f"- **{aspect.replace('_', ' ').title()}**: {count} mentions\n")
            
            # LLM Insights
            if 'llm_insights' in r:
                f.write("\n## AI-Generated Insights\n\n")
                if isinstance(r['llm_insights'], dict):
                    if 'complaints' in r['llm_insights']:
                        f.write("### Top Complaints\n")
                        for complaint in r['llm_insights'].get('complaints', []):
                            f.write(f"- {complaint}\n")
                    if 'feature_requests' in r['llm_insights']:
                        f.write("\n### Feature Requests\n")
                        for request in r['llm_insights'].get('feature_requests', []):
                            f.write(f"- {request}\n")
                    if 'main_opportunity' in r['llm_insights']:
                        f.write(f"\n### Main Opportunity\n{r['llm_insights']['main_opportunity']}\n")
                else:
                    f.write(r['llm_insights'].get('llm_analysis', ''))
            
            # Recommendations
            f.write("\n## Recommendations\n\n")
            f.write("Based on the analysis, consider:\n\n")
            
            # Auto-generate recommendations based on data
            if r['issues']['issue_categories'].get('crashes_bugs', {}).get('count', 0) > 10:
                f.write("1. **Priority**: Address stability issues and bugs\n")
            if r['issues']['issue_categories'].get('ui_ux', {}).get('count', 0) > 5:
                f.write("2. Improve UI/UX based on user feedback\n")
            if r['issues']['feature_requests_count'] > 10:
                f.write("3. Review and prioritize feature requests\n")
            if r['trends']['recent_trend'] == 'declining':
                f.write("4. **Urgent**: Investigate cause of declining ratings\n")


def main():
    parser = argparse.ArgumentParser(
        description='Analyze iOS App Store reviews to extract insights and opportunities',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic analysis (no LLM)
  python review_analyzer.py --app-id 1570489264
  
  # Analysis with Ollama LLM
  python review_analyzer.py --app-id 1570489264 --llm
  
  # Use specific Ollama model
  python review_analyzer.py --app-id 1570489264 --llm --model llama3.2
  
  # Output as markdown report
  python review_analyzer.py --app-id 1570489264 --output markdown
        """
    )
    
    parser.add_argument(
        '--app-id',
        required=True,
        help='iOS App Store app ID to analyze'
    )
    
    parser.add_argument(
        '--llm',
        action='store_true',
        help='Use Ollama LLM for deeper insights (requires Ollama installed)'
    )
    
    parser.add_argument(
        '--model',
        default='mistral',
        help='Ollama model to use (default: mistral)'
    )
    
    parser.add_argument(
        '--output',
        choices=['json', 'markdown', 'both'],
        default='both',
        help='Output format (default: both)'
    )
    
    args = parser.parse_args()
    
    # Create analyzer
    analyzer = ReviewAnalyzer(args.app_id, use_llm=args.llm, llm_model=args.model)
    
    try:
        # Load reviews
        analyzer.load_reviews()
        
        # Generate analysis
        analyzer.generate_summary_report()
        
        # Save results
        if args.output in ['json', 'both']:
            analyzer.save_results('json')
        if args.output in ['markdown', 'both']:
            analyzer.save_results('markdown')
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()