"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Star } from "lucide-react";

interface RatingData {
  average_rating: number;
  total_reviews: number;
  distribution: { [key: string]: number };
  low_ratings_count: number;
  high_ratings_count: number;
}

interface RatingChartProps {
  data: RatingData;
}

export function RatingChart({ data }: RatingChartProps) {
  // Transform the distribution data for the chart
  const chartData = Object.entries(data.distribution)
    .map(([rating, count]) => ({
      rating: `${rating}★`,
      count,
      percentage: ((count / data.total_reviews) * 100).toFixed(1)
    }))
    .sort((a, b) => parseInt(b.rating) - parseInt(a.rating));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Rating Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Average Rating Display */}
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-3xl font-bold text-primary mb-1">
              {data.average_rating}/5
            </div>
            <div className="flex justify-center items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= Math.round(data.average_rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Based on {data.total_reviews.toLocaleString()} reviews
            </p>
          </div>

          {/* Bar Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="rating" />
                <YAxis />
                <Tooltip 
                  formatter={(value: any) => [value, 'Reviews']}
                  labelFormatter={(label) => `Rating: ${label}`}
                />
                <Bar 
                  dataKey="count" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Distribution Breakdown */}
          <div className="space-y-2">
            {chartData.map(({ rating, count, percentage }) => (
              <div key={rating} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{rating}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 min-w-[100px]">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{count}</span>
                  <span>({percentage}%)</span>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                {data.high_ratings_count}
              </div>
              <div className="text-xs text-muted-foreground">4-5 Star Reviews</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600">
                {data.low_ratings_count}
              </div>
              <div className="text-xs text-muted-foreground">1-3 Star Reviews</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}