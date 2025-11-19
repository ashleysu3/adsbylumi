import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building2, Globe, Target, TrendingUp, Edit } from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    fetchBrandData();
  }, []);

  const fetchBrandData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user's first brand
      const { data: brandData, error: brandError } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (brandError) throw brandError;
      setBrand(brandData);

      // Fetch subscription
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setSubscription(subData);
    } catch (error: any) {
      toast.error(error.message || "Failed to load brand data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!brand) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>No Brand Found</CardTitle>
            <CardDescription>
              It looks like you haven't set up a brand yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = "/onboarding"}>
              Set Up Brand
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Brand Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-4xl font-editorial font-semibold tracking-tight">
              {brand.name}
            </h2>
            <p className="text-muted-foreground text-lg">
              Your strategic command center
            </p>
          </div>
          {subscription && (
            <Badge variant="secondary" className="text-base px-4 py-2">
              {subscription.tier.replace("_", " ").toUpperCase()}
            </Badge>
          )}
        </div>

        {/* Brand Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-editorial">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Building2 className="h-5 w-5 text-accent" />
                <CardTitle>Brand Profile</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {brand.website_url && (
                <div className="flex items-start space-x-3">
                  <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Website</p>
                    <a
                      href={brand.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-accent hover:underline"
                    >
                      {brand.website_url}
                    </a>
                  </div>
                </div>
              )}
              
              {brand.industry && (
                <div className="flex items-start space-x-3">
                  <Target className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Industry</p>
                    <p className="text-sm text-muted-foreground">{brand.industry}</p>
                  </div>
                </div>
              )}
              
              <Button variant="outline" className="w-full mt-4">
                <Edit className="mr-2 h-4 w-4" />
                Edit Brand Profile
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-editorial">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                <CardTitle>Value Proposition</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {brand.value_proposition ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {brand.value_proposition}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No value proposition set yet. Add one to help craft better ad strategies.
                </p>
              )}
              
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm font-medium mb-2">Target Audience</p>
                {brand.target_audience ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {brand.target_audience}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Not defined yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="shadow-editorial border-accent/20">
          <CardHeader>
            <CardTitle>Ready to Plan Your Next Campaign?</CardTitle>
            <CardDescription>
              The Ad Planner will help you craft psychology-driven strategies for Meta Ads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" className="h-12 px-8" onClick={() => window.location.href = "/planning"}>
              Open Ad Planner
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
