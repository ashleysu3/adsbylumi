import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Briefcase, Palette, TrendingUp, Calendar } from "lucide-react";

interface AnalyticsData {
  totalUsers: number;
  totalBrands: number;
  totalCampaigns: number;
  totalStrategies: number;
  recentUsers: any[];
  campaignsByStatus: Record<string, number>;
  brandsWithMeta: number;
}

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch total users
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Fetch total brands
      const { count: totalBrands } = await supabase
        .from("brands")
        .select("*", { count: "exact", head: true });

      // Fetch total campaigns
      const { count: totalCampaigns } = await supabase
        .from("campaign_workspaces")
        .select("*", { count: "exact", head: true });

      // Fetch total strategies
      const { count: totalStrategies } = await supabase
        .from("strategies")
        .select("*", { count: "exact", head: true });

      // Fetch recent users
      const { data: recentUsers } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      // Fetch campaigns by status
      const { data: campaigns } = await supabase
        .from("campaign_workspaces")
        .select("progress_status");

      const campaignsByStatus: Record<string, number> = {};
      campaigns?.forEach(c => {
        campaignsByStatus[c.progress_status] = (campaignsByStatus[c.progress_status] || 0) + 1;
      });

      // Fetch brands with Meta connected
      const { count: brandsWithMeta } = await supabase
        .from("brands")
        .select("*", { count: "exact", head: true })
        .not("meta_account_id", "is", null);

      setAnalytics({
        totalUsers: totalUsers || 0,
        totalBrands: totalBrands || 0,
        totalCampaigns: totalCampaigns || 0,
        totalStrategies: totalStrategies || 0,
        recentUsers: recentUsers || [],
        campaignsByStatus,
        brandsWithMeta: brandsWithMeta || 0,
      });
    } catch (error: any) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!analytics) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Failed to load analytics</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Platform usage and user statistics
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalUsers}</div>
              <p className="text-xs text-muted-foreground">Registered accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Brands</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalBrands}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.brandsWithMeta} with Meta connected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
              <Palette className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalCampaigns}</div>
              <p className="text-xs text-muted-foreground">Campaign workspaces</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Strategies</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalStrategies}</div>
              <p className="text-xs text-muted-foreground">Generated strategies</p>
            </CardContent>
          </Card>
        </div>

        {/* Campaign Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Status Distribution</CardTitle>
            <CardDescription>Current status of all campaign workspaces</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(analytics.campaignsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {status.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
            <CardDescription>Last 10 user registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.recentUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div className="space-y-1">
                    <p className="font-medium">{user.full_name || "No name"}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(user.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
