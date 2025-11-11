"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Star, TrendingUp, Users } from "lucide-react";

interface FeatureRequest {
  rating: string;
  excerpt: string;
}

interface FeatureRequestsProps {
  data: FeatureRequest[];
}

export function FeatureRequests({ data }: FeatureRequestsProps) {
  // Group requests by rating to show priority insights
  const requestsByRating = data.reduce((acc, request) => {
    const rating = request.rating;
    if (!acc[rating]) {
      acc[rating] = [];
    }
    acc[rating].push(request);
    return acc;
  }, {} as { [key: string]: FeatureRequest[] });

  const averageRating = data.length > 0 
    ? (data.reduce((sum, req) => sum + parseInt(req.rating), 0) / data.length).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Feature Requests Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{data.length}</div>
              <div className="text-sm text-muted-foreground">Total Requests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{averageRating}/5</div>
              <div className="text-sm text-muted-foreground">Avg Rating</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Object.keys(requestsByRating).length}
              </div>
              <div className="text-sm text-muted-foreground">Rating Levels</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Request Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Request Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <div>
                <div className="font-medium">High Priority</div>
                <div className="text-sm text-muted-foreground">
                  {(requestsByRating['5'] || []).length + (requestsByRating['4'] || []).length} from 4-5★ reviews
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <div className="font-medium">Critical Issues</div>
                <div className="text-sm text-muted-foreground">
                  {(requestsByRating['1'] || []).length + (requestsByRating['2'] || []).length} from 1-2★ reviews
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Star className="w-5 h-5 text-yellow-500" />
              <div>
                <div className="font-medium">Enhancements</div>
                <div className="text-sm text-muted-foreground">
                  {(requestsByRating['3'] || []).length} from 3★ reviews
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Requests List */}
      <div className="space-y-4">
        {data.length > 0 ? (
          data.map((request, index) => (
            <Card key={index}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={parseInt(request.rating) >= 4 ? "default" : parseInt(request.rating) >= 3 ? "secondary" : "destructive"}
                    >
                      {request.rating}/5 ★
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {parseInt(request.rating) >= 4 && "High Priority"}
                      {parseInt(request.rating) === 3 && "Enhancement"}
                      {parseInt(request.rating) <= 2 && "Critical Need"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Request #{index + 1}
                  </div>
                </div>
                
                <blockquote className="border-l-2 border-muted pl-4 italic text-muted-foreground">
                  "{request.excerpt}"
                </blockquote>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <Lightbulb className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No Feature Requests Found</h3>
              <p className="text-sm text-muted-foreground">
                No specific feature requests were detected in the analyzed reviews.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Action Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-red-100 p-1 mt-0.5">
                  <TrendingUp className="w-3 h-3 text-red-600" />
                </div>
                <div>
                  <h4 className="font-medium">Critical Requests</h4>
                  <p className="text-sm text-muted-foreground">
                    Address requests from 1-2 star reviews first as they represent user frustrations that could lead to churn.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-green-100 p-1 mt-0.5">
                  <Star className="w-3 h-3 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">Enhancement Opportunities</h4>
                  <p className="text-sm text-muted-foreground">
                    Consider requests from high-rated reviews to further delight satisfied users and maintain competitive advantage.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-blue-100 p-1 mt-0.5">
                  <Users className="w-3 h-3 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium">User Research</h4>
                  <p className="text-sm text-muted-foreground">
                    Conduct deeper user research on the most common themes to validate implementation priority.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}