import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import AdminTabs from "@/components/AdminTabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Briefcase, Palette, TrendingUp, Calendar, DollarSign, CreditCard, Award, Loader2, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface AnalyticsData {
  totalUsers: number;
  totalBrands: number;
  totalCampaigns: number;
  totalStrategies: number;
  recentUsers: any[];
  campaignsByStatus: Record<string, number>;
  brandsWithMeta: number;
}

interface RevenueData {
  total_mrr: number;
  total_subscribers: number;
  price_breakdown: Array<{
    price_id: string;
    product_name: string;
    monthly_amount_cents: number;
    subscriber_count: number;
    interval: string;
    effective_label: string;
    subscribers: Array<{
      email: string | null;
      customer_id: string;
      subscription_id: string;
      monthly_amount_cents: number;
      discount_label: string | null;
      app_user_id: string | null;
      user_full_name: string | null;
    }>;
  }>;
}

interface TopAffiliate {
  email: string;
  first_name: string;
  last_name: string;
  rewardful_affiliate_id: string | null;
  referral_count: number;
}

export default function Analytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [topAffiliates, setTopAffiliates] = useState<TopAffiliate[]>([]);
  const [expandedPricePoints, setExpandedPricePoints] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchAnalytics();
    fetchTopAffiliates();
    fetchRevenue();
  }, []);

  const togglePricePoint = (priceId: string) => {
    setExpandedPricePoints((prev) => ({
      ...prev,
      [priceId]: !prev[priceId],
    }));
  };

  const fetchRevenue = async () => {
    setRevenueLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { toast.error("Not authenticated"); return; }

      const res = await fetch(
        `https://sqwjbndgighjtifijgws.supabase.co/functions/v1/stripe-admin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "revenue_overview" }),
        }
      );
      if (!res.ok) throw new Error("Failed to fetch revenue");
      const data = await res.json();
      setRevenue(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRevenueLoading(false);
    }
  };

  const fetchTopAffiliates = async () => {
    try {
      // Get approved partners with affiliate IDs, then count referrals
      const { data: partners } = await supabase
        .from("partner_applications")
        .select("email, first_name, last_name, rewardful_affiliate_id")
        .eq("status", "approved")
        .not("rewardful_affiliate_id", "is", null);

      if (!partners || partners.length === 0) {
        setTopAffiliates([]);
        return;
      }

      // Get partner access tokens to count usage (referrals)
      const { data: tokens } = await supabase
        .from("partner_access_tokens")
        .select("email, rewardful_affiliate_id");

      // Count referrals per partner by checking subscriptions with partner metadata
      // For now, use partner_access_tokens as proxy — each token represents a partner
      // We'll also check invite codes usage linked to partners
      const { data: inviteCodes } = await supabase
        .from("invite_codes")
        .select("code, current_uses, description");

      const affiliateMap: Record<string, TopAffiliate> = {};
      partners.forEach((p: any) => {
        affiliateMap[p.email] = {
          email: p.email,
          first_name: p.first_name,
          last_name: p.last_name,
          rewardful_affiliate_id: p.rewardful_affiliate_id,
          referral_count: 0,
        };
      });

      // Match invite codes to partners by description or code pattern
      inviteCodes?.forEach((ic: any) => {
        const desc = (ic.description || "").toLowerCase();
        Object.values(affiliateMap).forEach((affiliate) => {
          const name = `${affiliate.first_name} ${affiliate.last_name}`.toLowerCase();
          if (desc.includes(name) || desc.includes(affiliate.email.toLowerCase())) {
            affiliate.referral_count += ic.current_uses || 0;
          }
        });
      });

      const sorted = Object.values(affiliateMap)
        .sort((a, b) => b.referral_count - a.referral_count)
        .slice(0, 5);

      setTopAffiliates(sorted);
    } catch (err) {
      console.error("Failed to fetch affiliates:", err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: totalBrands } = await supabase
        .from("brands")
        .select("*", { count: "exact", head: true });

      const { count: totalCampaigns } = await supabase
        .from("campaign_workspaces")
        .select("*", { count: "exact", head: true });

      const { count: totalStrategies } = await supabase
        .from("strategies")
        .select("*", { count: "exact", head: true });

      const { data: recentUsers } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: campaigns } = await supabase
        .from("campaign_workspaces")
        .select("progress_status");

      const campaignsByStatus: Record<string, number> = {};
      campaigns?.forEach(c => {
        campaignsByStatus[c.progress_status] = (campaignsByStatus[c.progress_status] || 0) + 1;
      });

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
        <AdminTabs />
        <div>
          <h1 className="text-3xl font-display font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Platform usage, revenue, and partner statistics
          </p>
        </div>

        {/* Revenue Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Revenue Overview
            </CardTitle>
            <CardDescription>Monthly recurring revenue and subscriber breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <div className="flex items-center gap-2 py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading revenue data from Stripe...</span>
              </div>
            ) : revenue ? (
              <div className="space-y-6">
                {/* MRR + Subscribers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4 bg-primary/5">
                    <p className="text-sm text-muted-foreground">Monthly Recurring Revenue</p>
                    <p className="text-3xl font-bold text-primary mt-1">
                      ${(revenue.total_mrr / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ARR: ${((revenue.total_mrr * 12) / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Active Subscribers</p>
                    <p className="text-3xl font-bold mt-1">{revenue.total_subscribers}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Avg. ${revenue.total_subscribers > 0 ? ((revenue.total_mrr / revenue.total_subscribers) / 100).toFixed(2) : '0'}/mo per subscriber
                    </p>
                  </div>
                </div>

                {/* Price Breakdown */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Subscribers by Price Point (click to view users)</h3>
                  <div className="space-y-2">
                    {revenue.price_breakdown.map((tier) => (
                      <div key={tier.price_id} className="rounded-lg border">
                        <button
                          type="button"
                          onClick={() => togglePricePoint(tier.price_id)}
                          className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{tier.product_name}</p>
                              <p className="text-xs text-muted-foreground">{tier.effective_label}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-bold">{tier.subscriber_count}</p>
                              <p className="text-xs text-muted-foreground">
                                ${((tier.monthly_amount_cents * tier.subscriber_count) / 100).toFixed(2)}/mo
                              </p>
                            </div>
                            {expandedPricePoints[tier.price_id] ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>

                        {expandedPricePoints[tier.price_id] && (
                          <div className="border-t bg-muted/20 p-3 space-y-2">
                            {(!tier.subscribers || tier.subscribers.length === 0) ? (
                              <p className="text-xs text-muted-foreground">No subscribers in this price point.</p>
                            ) : (
                              (tier.subscribers || []).map((subscriber) => {
                                const accountQuery = subscriber.app_user_id
                                  ? `userId=${encodeURIComponent(subscriber.app_user_id)}`
                                  : `email=${encodeURIComponent(subscriber.email || "")}`;

                                return (
                                  <div
                                    key={`${tier.price_id}-${subscriber.subscription_id}`}
                                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border bg-background p-2"
                                  >
                                    <div>
                                      <p className="text-sm font-medium">
                                        {subscriber.user_full_name || subscriber.email || "Unknown user"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">{subscriber.email || "No email on file"}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary">
                                        ${(subscriber.monthly_amount_cents / 100).toFixed(2)}/mo
                                      </Badge>
                                      {subscriber.discount_label ? (
                                        <Badge variant="outline">{subscriber.discount_label}</Badge>
                                      ) : null}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate(`/admin/users?${accountQuery}`)}
                                      >
                                        View account
                                        <ExternalLink className="ml-1 h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No revenue data available</p>
            )}
          </CardContent>
        </Card>

        {/* Top Affiliates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Top 5 Partners & Affiliates
            </CardTitle>
            <CardDescription>Highest referrals by partner code usage</CardDescription>
          </CardHeader>
          <CardContent>
            {topAffiliates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No affiliate data yet</p>
            ) : (
              <div className="space-y-3">
                {topAffiliates.map((a, idx) => (
                  <div key={a.email} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-6">#{idx + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{a.first_name} {a.last_name}</p>
                        <p className="text-xs text-muted-foreground">{a.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary">{a.referral_count} referrals</Badge>
                      {a.rewardful_affiliate_id && (
                        <p className="text-xs text-muted-foreground mt-1">ID: {a.rewardful_affiliate_id}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
