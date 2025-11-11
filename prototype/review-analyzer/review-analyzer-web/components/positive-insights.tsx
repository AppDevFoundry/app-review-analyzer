"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, BarChart3, FolderOpen, Lightbulb, Users } from "lucide-react";

interface PositiveData {
  top_positive_aspects: { [key: string]: number };
  total_positive_reviews: number;
}

interface PositiveInsightsProps {
  data: PositiveData;
}

const aspectIcons: { [key: string]: React.ReactNode } = {
  features: <Heart className="w-4 h-4" />,
  stats_analytics: <BarChart3 className="w-4 h-4" />,
  organization: <FolderOpen className="w-4 h-4" />,
  recommendations: <Lightbulb className="w-4 h-4" />,
  community: <Users className="w-4 h-4" />,
  ui_design: <Heart className="w-4 h-4" />
};

const aspectColors: { [key: string]: string } = {
  features: "text-blue-500",
  stats_analytics: "text-green-500",
  organization: "text-purple-500",
  recommendations: "text-yellow-500",
  community: "text-pink-500",
  ui_design: "text-indigo-500"
};

export function PositiveInsights({ data }: PositiveInsightsProps) {
  const sortedAspects = Object.entries(data.top_positive_aspects)
    .sort(([,a], [,b]) => b - a);

  const totalMentions = Object.values(data.top_positive_aspects).reduce((sum, count) => sum + count, 0);

  const formatAspectName = (aspect: string) => {
    return aspect.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" />
            What Users Love
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{data.total_positive_reviews}</div>
              <div className="text-sm text-muted-foreground">Positive Reviews (4-5 stars)</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{totalMentions}</div>
              <div className="text-sm text-muted-foreground">Positive Mentions</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {sortedAspects.map(([aspect, count], index) => {
          const percentage = (count / Math.max(...Object.values(data.top_positive_aspects))) * 100;
          const shareOfTotal = ((count / totalMentions) * 100).toFixed(1);
          
          return (
            <Card key={aspect}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`${aspectColors[aspect] || "text-gray-500"}`}>
                      {aspectIcons[aspect] || <Heart className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="font-semibold">{formatAspectName(aspect)}</h3>
                      <p className="text-sm text-muted-foreground">
                        {shareOfTotal}% of positive mentions
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">{count}</div>
                    <Badge variant="secondary" className="text-xs">
                      #{index + 1}
                    </Badge>
                  </div>
                </div>
                
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Key Takeaways</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedAspects.slice(0, 3).map(([aspect, count], index) => (
              <div key={aspect} className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                  <div className={`${aspectColors[aspect] || "text-gray-500"}`}>
                    {aspectIcons[aspect] || <Heart className="w-3 h-3" />}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium">{formatAspectName(aspect)}</h4>
                  <p className="text-sm text-muted-foreground">
                    {index === 0 && "Your app's strongest point with significant user appreciation."}
                    {index === 1 && "A major competitive advantage that users consistently praise."}
                    {index === 2 && "Another key strength that contributes to user satisfaction."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}