"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bug, Zap, Palette, Search, DollarSign, RefreshCw, Users } from "lucide-react";

interface IssueCategory {
  count: number;
  examples: Array<{
    rating: string;
    excerpt: string;
  }>;
}

interface IssuesData {
  total_issues_found: number;
  feature_requests_count: number;
  issue_categories: { [key: string]: IssueCategory };
}

interface IssuesBreakdownProps {
  data: IssuesData;
}

const categoryIcons: { [key: string]: React.ReactNode } = {
  crashes_bugs: <Bug className="w-4 h-4" />,
  performance: <Zap className="w-4 h-4" />,
  ui_ux: <Palette className="w-4 h-4" />,
  search_discovery: <Search className="w-4 h-4" />,
  pricing: <DollarSign className="w-4 h-4" />,
  sync_data: <RefreshCw className="w-4 h-4" />,
  social: <Users className="w-4 h-4" />,
  features: <AlertTriangle className="w-4 h-4" />
};

const categoryColors: { [key: string]: string } = {
  crashes_bugs: "text-red-500",
  performance: "text-orange-500", 
  ui_ux: "text-blue-500",
  search_discovery: "text-purple-500",
  pricing: "text-green-500",
  sync_data: "text-yellow-500",
  social: "text-pink-500",
  features: "text-indigo-500"
};

export function IssuesBreakdown({ data }: IssuesBreakdownProps) {
  const sortedCategories = Object.entries(data.issue_categories)
    .sort(([,a], [,b]) => b.count - a.count);

  const formatCategoryName = (category: string) => {
    return category.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Issues Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{data.total_issues_found}</div>
              <div className="text-sm text-muted-foreground">Total Issues</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{Object.keys(data.issue_categories).length}</div>
              <div className="text-sm text-muted-foreground">Categories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{data.feature_requests_count}</div>
              <div className="text-sm text-muted-foreground">Feature Requests</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {sortedCategories.map(([category, categoryData]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={categoryColors[category] || "text-gray-500"}>
                    {categoryIcons[category] || <AlertTriangle className="w-4 h-4" />}
                  </span>
                  {formatCategoryName(category)}
                  <Badge variant="secondary">{categoryData.count} mentions</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {((categoryData.count / data.total_issues_found) * 100).toFixed(1)}% of issues
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Progress bar */}
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${(categoryData.count / Math.max(...Object.values(data.issue_categories).map(c => c.count))) * 100}%` 
                    }}
                  />
                </div>

                {/* Example reviews */}
                {categoryData.examples && categoryData.examples.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Example Reviews:</h4>
                    {categoryData.examples.map((example, index) => (
                      <div key={index} className="border-l-2 border-muted pl-4 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={`text-xs ${
                                  star <= parseInt(example.rating)
                                    ? 'text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {example.rating}/5
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground italic">
                          "{example.excerpt}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}