#!/usr/bin/env python3
"""
iOS App Store Reviews Fetcher
Fetches all reviews (Most Helpful and Most Recent) for a given iOS app ID
from Apple's RSS feeds and saves them to JSON files.
"""

import json
import argparse
import time
import urllib.request
import urllib.error
from datetime import datetime
from typing import Dict, List, Optional, Tuple


class AppReviewsFetcher:
    BASE_URL = "https://itunes.apple.com/us/rss/customerreviews"
    DELAY_BETWEEN_REQUESTS = 1  # seconds
    MAX_RETRIES = 3
    
    def __init__(self, app_id: str):
        self.app_id = app_id
        self.session_stats = {
            "pages_fetched": 0,
            "total_reviews": 0,
            "errors": 0
        }
    
    def fetch_url(self, url: str) -> Optional[Dict]:
        """Fetch JSON data from URL with retry logic."""
        for attempt in range(self.MAX_RETRIES):
            try:
                print(f"Fetching: {url}")
                with urllib.request.urlopen(url) as response:
                    data = json.loads(response.read().decode('utf-8'))
                    self.session_stats["pages_fetched"] += 1
                    return data
            except (urllib.error.HTTPError, urllib.error.URLError) as e:
                print(f"Network error (attempt {attempt + 1}/{self.MAX_RETRIES}): {e}")
                self.session_stats["errors"] += 1
                if attempt < self.MAX_RETRIES - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                else:
                    print(f"Failed to fetch {url} after {self.MAX_RETRIES} attempts")
                    return None
            except json.JSONDecodeError as e:
                print(f"JSON parsing error: {e}")
                self.session_stats["errors"] += 1
                return None
    
    def extract_reviews(self, data: Dict) -> List[Dict]:
        """Extract review entries from RSS feed data."""
        reviews = []
        
        if 'feed' in data and 'entry' in data['feed']:
            entries = data['feed']['entry']
            # Handle single entry (not a list)
            if isinstance(entries, dict):
                entries = [entries]
            
            for entry in entries:
                review = {
                    'id': entry.get('id', {}).get('label', ''),
                    'author': entry.get('author', {}).get('name', {}).get('label', ''),
                    'rating': entry.get('im:rating', {}).get('label', ''),
                    'version': entry.get('im:version', {}).get('label', ''),
                    'title': entry.get('title', {}).get('label', ''),
                    'content': entry.get('content', {}).get('label', ''),
                    'updated': entry.get('updated', {}).get('label', ''),
                    'vote_sum': entry.get('im:voteSum', {}).get('label', '0'),
                    'vote_count': entry.get('im:voteCount', {}).get('label', '0')
                }
                reviews.append(review)
        
        return reviews
    
    def get_next_page_url(self, data: Dict) -> Optional[str]:
        """Extract next page URL from feed links."""
        if 'feed' in data and 'link' in data['feed']:
            links = data['feed']['link']
            # Ensure links is a list
            if isinstance(links, dict):
                links = [links]
            
            for link in links:
                if link.get('attributes', {}).get('rel') == 'next':
                    next_url = link['attributes']['href']
                    # Convert XML URL back to JSON format
                    if 'xml' in next_url:
                        next_url = next_url.replace('/xml', '/json')
                        # Remove the urlDesc parameter
                        if '?urlDesc=' in next_url:
                            next_url = next_url.split('?urlDesc=')[0]
                    return next_url
        
        return None
    
    def fetch_all_reviews(self, sort_by: str) -> Tuple[List[Dict], Dict]:
        """Fetch all reviews for given sort type (mosthelpful or mostrecent)."""
        all_reviews = []
        metadata = {
            'app_id': self.app_id,
            'sort_by': sort_by,
            'fetch_timestamp': datetime.now().isoformat(),
            'total_pages': 0,
            'total_reviews': 0
        }
        
        # Start with first page
        url = f"{self.BASE_URL}/page=1/id={self.app_id}/sortby={sort_by}/json"
        page_num = 1
        
        while url:
            print(f"\nFetching page {page_num} for {sort_by} reviews...")
            
            # Rate limiting
            if page_num > 1:
                time.sleep(self.DELAY_BETWEEN_REQUESTS)
            
            # Fetch page
            data = self.fetch_url(url)
            if not data:
                print(f"Failed to fetch page {page_num}, stopping pagination")
                break
            
            # Extract reviews from this page
            reviews = self.extract_reviews(data)
            all_reviews.extend(reviews)
            print(f"Found {len(reviews)} reviews on page {page_num}")
            
            # Get app name if available
            if 'feed' in data and 'title' in data['feed'] and not metadata.get('app_name'):
                metadata['app_name'] = data['feed']['title'].get('label', '').replace(' Customer Reviews', '')
            
            # Check for next page
            next_url = self.get_next_page_url(data)
            if next_url and next_url != url:  # Avoid infinite loops
                url = next_url
                page_num += 1
            else:
                print(f"No more pages found. Total pages: {page_num}")
                break
        
        metadata['total_pages'] = page_num
        metadata['total_reviews'] = len(all_reviews)
        self.session_stats["total_reviews"] += len(all_reviews)
        
        return all_reviews, metadata
    
    def save_reviews_to_file(self, reviews: List[Dict], metadata: Dict, sort_by: str):
        """Save reviews and metadata to JSON file."""
        filename = f"{self.app_id}_{sort_by}.json"
        
        output = {
            'metadata': metadata,
            'reviews': reviews
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        
        print(f"\nSaved {len(reviews)} reviews to {filename}")
    
    def fetch_and_save_all(self):
        """Fetch both Most Helpful and Most Recent reviews and save to files."""
        print(f"Starting review fetch for App ID: {self.app_id}")
        print("=" * 50)
        
        # Fetch Most Helpful reviews
        print("\n[1/2] Fetching Most Helpful reviews...")
        helpful_reviews, helpful_metadata = self.fetch_all_reviews('mosthelpful')
        self.save_reviews_to_file(helpful_reviews, helpful_metadata, 'most_helpful')
        
        # Fetch Most Recent reviews
        print("\n[2/2] Fetching Most Recent reviews...")
        recent_reviews, recent_metadata = self.fetch_all_reviews('mostrecent')
        self.save_reviews_to_file(recent_reviews, recent_metadata, 'most_recent')
        
        # Print summary
        print("\n" + "=" * 50)
        print("FETCH COMPLETE!")
        print(f"App Name: {helpful_metadata.get('app_name', 'Unknown')}")
        print(f"Total Most Helpful reviews: {helpful_metadata['total_reviews']}")
        print(f"Total Most Recent reviews: {recent_metadata['total_reviews']}")
        print(f"Total pages fetched: {self.session_stats['pages_fetched']}")
        print(f"Total errors encountered: {self.session_stats['errors']}")
        print("\nOutput files:")
        print(f"  - {self.app_id}_most_helpful.json")
        print(f"  - {self.app_id}_most_recent.json")


def main():
    parser = argparse.ArgumentParser(
        description='Fetch iOS App Store reviews from Apple RSS feeds',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Example:
  python app_reviews_fetcher.py --app-id 1570489264
  
This will create:
  - 1570489264_most_helpful.json
  - 1570489264_most_recent.json
        """
    )
    
    parser.add_argument(
        '--app-id',
        required=True,
        help='iOS App Store app ID (e.g., 1570489264 for StoryGraph)'
    )
    
    args = parser.parse_args()
    
    # Create fetcher and run
    fetcher = AppReviewsFetcher(args.app_id)
    
    try:
        fetcher.fetch_and_save_all()
    except KeyboardInterrupt:
        print("\n\nFetch interrupted by user")
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        raise


if __name__ == "__main__":
    main()