"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Star, TrendingUp, Users, MessageSquare } from "lucide-react";

export default function Home() {
  const [appId, setAppId] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const router = useRouter();

  const handleAnalyze = async () => {
    if (!appId.trim()) return;
    
    setIsAnalyzing(true);
    // Simulate analysis loading
    await new Promise(resolve => setTimeout(resolve, 1000));
    router.push(`/analyze/${appId.trim()}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAnalyze();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-4">
          iOS App Store
          <span className="text-primary"> Review Analyzer</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Extract actionable insights from iOS app reviews. Identify user pain points, 
          feature requests, and opportunities for improvement.
        </p>
        
        {/* Input Form */}
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Search className="w-5 h-5" />
              Analyze App Reviews
            </CardTitle>
            <CardDescription>
              Enter an iOS App Store app ID to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Enter App ID (e.g., 1570489264)"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                onKeyPress={handleKeyPress}
                className="text-center"
              />
              <p className="text-xs text-muted-foreground">
                Find the App ID in the app's App Store URL
              </p>
            </div>
            <Button 
              onClick={handleAnalyze} 
              disabled={!appId.trim() || isAnalyzing}
              className="w-full"
              size="lg"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Reviews"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Features Section */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="w-5 h-5 text-yellow-500" />
              Rating Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Comprehensive rating distribution and trend analysis with temporal insights.
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              Issue Detection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Automatically categorize user complaints into crashes, UI/UX, performance, and more.
            </CardDescription>
          </CardContent>
          </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Feature Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Extract and prioritize feature requests from user feedback.
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-purple-500" />
              Positive Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Understand what users love about the app to maintain competitive advantages.
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Example Section */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Try with Example</CardTitle>
          <CardDescription>
            Test the analyzer with StoryGraph (App ID: 1570489264), a popular book tracking app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            onClick={() => setAppId("1570489264")}
            className="mr-2"
          >
            Load Example
          </Button>
          <span className="text-sm text-muted-foreground">
            Then click "Analyze Reviews" above
          </span>
        </CardContent>
      </Card>
    </div>
  );
}