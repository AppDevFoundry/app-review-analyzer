"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Star, TrendingUp, AlertTriangle, Users, MessageSquare, Download } from "lucide-react";
import Link from "next/link";
import { RatingChart } from "@/components/rating-chart";
import { IssuesBreakdown } from "@/components/issues-breakdown";
import { PositiveInsights } from "@/components/positive-insights";
import { FeatureRequests } from "@/components/feature-requests";

interface AnalysisData {
  app_id: string;
  app_name: string;
  analysis_date: string;
  total_reviews_analyzed: number;
  ratings: {
    average_rating: number;
    total_reviews: number;
    distribution: { [key: string]: number };
    low_ratings_count: number;
    high_ratings_count: number;
  };
  trends: {
    recent_trend: string;
    recent_avg_rating: number;
    monthly_trends: { [key: string]: { count: number; avg_rating: number } };
  };
  issues: {
    total_issues_found: number;
    feature_requests_count: number;
    issue_categories: { [key: string]: { count: number; examples: any[] } };
    feature_request_samples: any[];
  };
  positives: {
    top_positive_aspects: { [key: string]: number };
    total_positive_reviews: number;
  };
}

export default function AnalyzePage() {
  const params = useParams();
  const appId = params.appId as string;
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAnalysisData = async () => {
      try {
        setLoading(true);
        // In a real app, this would be an API call
        // For now, we'll try to load the JSON file from the parent directory
        const response = await fetch(`/api/analysis/${appId}`);
        
        if (!response.ok) {
          throw new Error('Analysis data not found');
        }
        
        const data = await response.json();
        setAnalysisData(data);
      } catch (err) {
        console.error('Error loading analysis data:', err);
        setError('Analysis data not found. Please run the Python analyzer first.');
      } finally {
        setLoading(false);
      }
    };

    if (appId) {
      loadAnalysisData();
    }
  }, [appId]);

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600';
      case 'declining': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4" />;
      case 'declining': return <TrendingUp className="w-4 h-4 rotate-180" />;
      default: return <TrendingUp className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading analysis data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysisData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Analysis Data Not Found</h2>
          <p className="text-muted-foreground mb-4">
            {error || 'No analysis data available for this app ID.'}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            To generate analysis data, run the Python analyzer:
          </p>
          <code className="bg-muted px-3 py-1 rounded text-sm">
            python3 review_analyzer.py --app-id {appId}
          </code>
          <div className="mt-6">
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">
              {analysisData.app_name || `App ${appId}`}
            </h1>
            <p className="text-muted-foreground">
              Analysis of {analysisData.total_reviews_analyzed.toLocaleString()} reviews
            </p>
          </div>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Average Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.ratings.average_rating}/5</div>
            <p className="text-xs text-muted-foreground">
              {analysisData.ratings.total_reviews} total reviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Recent Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold flex items-center gap-2 ${getTrendColor(analysisData.trends.recent_trend)}`}>
              {getTrendIcon(analysisData.trends.recent_trend)}
              {analysisData.trends.recent_trend}
            </div>
            <p className="text-xs text-muted-foreground">
              {analysisData.trends.recent_avg_rating}/5 recently
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Issues Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.issues.total_issues_found}</div>
            <p className="text-xs text-muted-foreground">
              Across {Object.keys(analysisData.issues.issue_categories).length} categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-green-500" />
              Feature Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.issues.feature_requests_count}</div>
            <p className="text-xs text-muted-foreground">
              User suggestions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="positives">Positives</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid lg:grid-cols-2 gap-6">
            <RatingChart data={analysisData.ratings} />
            <Card>
              <CardHeader>
                <CardTitle>Key Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Rating Distribution</h4>
                  <p className="text-sm text-muted-foreground">
                    {Math.round((analysisData.ratings.high_ratings_count / analysisData.ratings.total_reviews) * 100)}% 
                    of reviews are 4-5 stars, indicating generally positive user sentiment.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Top Issues</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(analysisData.issues.issue_categories)
                      .sort(([,a], [,b]) => b.count - a.count)
                      .slice(0, 3)
                      .map(([category, data]) => (
                        <Badge key={category} variant="secondary">
                          {category.replace('_', ' ')}: {data.count}
                        </Badge>
                      ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">User Satisfaction</h4>
                  <p className="text-sm text-muted-foreground">
                    Trend is {analysisData.trends.recent_trend} with recent average of {analysisData.trends.recent_avg_rating}/5 stars.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="issues">
          <IssuesBreakdown data={analysisData.issues} />
        </TabsContent>

        <TabsContent value="positives">
          <PositiveInsights data={analysisData.positives} />
        </TabsContent>

        <TabsContent value="features">
          <FeatureRequests data={analysisData.issues.feature_request_samples} />
        </TabsContent>
      </Tabs>
    </div>
  );
}