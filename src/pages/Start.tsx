import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Progress } from "@/components/ui/progress";
import { useBrand } from "@/contexts/BrandContext";
import { useLumiAssistant } from "@/components/LumiAssistant";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageShimmer } from "@/components/GradientShimmer";
import {
  PlusCircle,
  RefreshCw,
  BarChart3,
  Sparkles,
  Link2,
  CheckCircle2,
  ArrowRight,
  Package,
  Megaphone,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  Palette,
  Zap,
  Mail,
  Building2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LumiEducationCard } from "@/components/LumiEducationCard";

interface UserState {
  hasOffers: boolean;
  hasCampaigns: boolean;
  hasLiveCampaigns: boolean;
  hasDraftCampaigns: boolean;
  isMetaConnected: boolean;
  isMetaTokenExpiring: boolean;
  offerCount: number;
  campaignCount: number;
  draftCount: number;
  recommendationCount: number;
}

interface AttentionItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  actionLabel: string;
  severity: "critical" | "warning" | "info";
}

export default function Start() {
  const navigate = useNavigate();
  const { activeBrand, loading: brandLoading } = useBrand();
  const { setLumiUserState } = useLumiAssistant();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);
  const [trendInsights, setTrendInsights] = useState<any[] | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendFetched, setTrendFetched] = useState(false);
  const [userState, setUserState] = useState<UserState>({
    hasOffers: false,
    hasCampaigns: false,
    hasLiveCampaigns: false,
    hasDraftCampaigns: false,
    isMetaConnected: false,
    isMetaTokenExpiring: false,
    offerCount: 0,
    campaignCount: 0,
    draftCount: 0,
    recommendationCount: 0,
  });

  useEffect(() => {
    if (brandLoading) return;
    if (!activeBrand) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) navigate("/auth");
      });
      return;
    }
    setBrand(activeBrand);
    checkUserState(activeBrand);
  }, [brandLoading, activeBrand?.id]);

  // Fetch trend insights once after user state is loaded
  useEffect(() => {
    if (loading || trendFetched || !activeBrand?.id || !userState.hasOffers) return;
    setTrendLoading(true);
    setTrendFetched(true);
    supabase.functions.invoke('generate-trend-insights', { body: { brandId: activeBrand.id } })
      .then(({ data, error }) => {
        if (!error && data?.insights && Array.isArray(data.insights) && data.insights.length > 0) {
          setTrendInsights(data.insights.slice(0, 3));
        }
      })
      .catch(() => {})
      .finally(() => setTrendLoading(false));
  }, [loading, trendFetched, activeBrand?.id, userState.hasOffers]);

  const checkUserState = async (currentBrand: any) => {
    setLoading(true);
    try {
      const [offersResult, campaignsResult] = await Promise.all([
        supabase
          .from("offers")
          .select("id")
          .eq("brand_id", currentBrand.id)
          .eq("archived", false),
        supabase
          .from("campaign_workspaces")
          .select("id, progress_status, performance_report_latest")
          .eq("brand_id", currentBrand.id)
          .eq("archived", false),
      ]);

      const offers = offersResult.data || [];
      const campaigns = campaignsResult.data || [];
      const liveCampaigns = campaigns.filter((c) =>
        ["live", "completed", "ready_to_publish"].includes(c.progress_status)
      );
      const draftCampaigns = campaigns.filter((c) =>
        ["draft", "creative_in_progress", "waiting_for_assets"].includes(c.progress_status)
      );

      // Count workspaces with recommendations in their latest report
      let recCount = 0;
      campaigns.forEach((c: any) => {
        const report = c.performance_report_latest;
        if (report && typeof report === "object") {
          const recs = (report as any).recommendations;
          if (Array.isArray(recs)) recCount += recs.length;
        }
      });

      const tokenExpiry = currentBrand.meta_token_expires_at;
      const isExpiring = tokenExpiry
        ? new Date(tokenExpiry).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
        : false;

      const newState = {
        hasOffers: offers.length > 0,
        hasCampaigns: campaigns.length > 0,
        hasLiveCampaigns: liveCampaigns.length > 0,
        hasDraftCampaigns: draftCampaigns.length > 0,
        isMetaConnected: !!currentBrand.meta_account_id,
        isMetaTokenExpiring: isExpiring,
        offerCount: offers.length,
        campaignCount: campaigns.length,
        draftCount: draftCampaigns.length,
        recommendationCount: recCount,
      };
      setUserState(newState);
      // Push to Lumi context for dynamic starters
      setLumiUserState(newState);
    } catch (error) {
      console.error("Error checking user state:", error);
    } finally {
      setLoading(false);
    }
  };

  // Build prioritized attention items
  const getAttentionItems = (): AttentionItem[] => {
    const items: AttentionItem[] = [];

    // Critical: Meta broken
    if (!userState.isMetaConnected && userState.hasOffers) {
      items.push({
        id: "meta-disconnected",
        title: "Connect your Meta account",
        description: "You need a Meta connection to publish ads and see performance data.",
        icon: <Link2 className="h-5 w-5" />,
        action: () => navigate("/settings"),
        actionLabel: "Fix Connection",
        severity: "critical",
      });
    }

    // Warning: Meta token expiring
    if (userState.isMetaConnected && userState.isMetaTokenExpiring) {
      items.push({
        id: "meta-token-expiring",
        title: "Meta connection needs attention",
        description: "Your Meta token is expiring soon. Reconnect to avoid disruptions.",
        icon: <AlertTriangle className="h-5 w-5" />,
        action: () => navigate("/settings"),
        actionLabel: "Reconnect",
        severity: "warning",
      });
    }

    // Critical: No offers
    if (!userState.hasOffers) {
      items.push({
        id: "no-offers",
        title: "Add your first offer",
        description: "Tell us what you're promoting so we can create targeted ads.",
        icon: <Package className="h-5 w-5" />,
        action: () => navigate("/dashboard"),
        actionLabel: "Add Offer",
        severity: "critical",
      });
    }

    // Warning: Recommendations need review
    if (userState.recommendationCount > 0) {
      items.push({
        id: "recommendations",
        title: `${userState.recommendationCount} recommendation${userState.recommendationCount !== 1 ? "s" : ""} need review`,
        description: "Lumi has suggestions to improve your ad performance.",
        icon: <Sparkles className="h-5 w-5" />,
        action: () => navigate("/data"),
        actionLabel: "Review",
        severity: "warning",
      });
    }

    // Info: Drafts in progress
    if (userState.hasDraftCampaigns) {
      items.push({
        id: "drafts",
        title: `${userState.draftCount} draft${userState.draftCount !== 1 ? "s" : ""} in progress`,
        description: "Pick up where you left off and finish your ads.",
        icon: <RefreshCw className="h-5 w-5" />,
        action: () => navigate("/campaigns"),
        actionLabel: "Continue",
        severity: "info",
      });
    }

    // Info: Has offers but no campaigns
    if (userState.hasOffers && !userState.hasCampaigns) {
      items.push({
        id: "create-first-ad",
        title: "Create your first ad",
        description: "You have offers ready — let Lumi help you craft scroll-stopping creative.",
        icon: <Megaphone className="h-5 w-5" />,
        action: () => navigate("/create"),
        actionLabel: "Create Ad",
        severity: "info",
      });
    }

    return items;
  };

  const attentionItems = getAttentionItems();

  // Setup checklist — enhanced with descriptions and CTAs
  const setupSteps = [
    {
      label: "Complete your brand profile",
      description: "Add your website, industry, and positioning so Lumi can write copy that sounds like you.",
      done: !!(brand?.name && brand?.website_url && brand?.industry && brand?.value_proposition),
      action: () => navigate("/dashboard"),
      actionLabel: "Set Up Brand",
      icon: Building2,
      color: "text-lumi-orange-1",
    },
    {
      label: "Add your first offer",
      description: "Tell Lumi what you're promoting — just drop in a URL and we'll handle the rest.",
      done: userState.hasOffers,
      count: userState.offerCount,
      action: () => navigate("/dashboard"),
      actionLabel: "Add Offer",
      icon: Package,
      color: "text-lumi-pink-1",
    },
    {
      label: "Create your first ad",
      description: "Lumi generates scripts, copy, and creative direction based on your audience's psychology.",
      done: userState.hasCampaigns,
      count: userState.campaignCount,
      action: () => navigate("/create"),
      actionLabel: "Create Ad",
      icon: Sparkles,
      color: "text-lumi-purple-1",
    },
    {
      label: "Connect Meta",
      description: "Link your ad account to publish campaigns and track performance — all from one place.",
      done: userState.isMetaConnected,
      action: () => navigate("/settings"),
      actionLabel: "Connect",
      icon: Link2,
      color: "text-lumi-blue-1",
    },
  ];
  const completedSteps = setupSteps.filter((s) => s.done).length;
  const setupProgress = Math.round((completedSteps / setupSteps.length) * 100);

  // Find the next incomplete step for the contextual nudge
  const nextStep = setupSteps.find((s) => !s.done);

  const quickActions = [
    { label: "Create New Ad", icon: PlusCircle, path: "/create", color: "text-primary" },
    { label: "View Results", icon: BarChart3, path: "/data", color: "text-primary" },
    { label: "Manage Offers", icon: Package, path: "/dashboard", color: "text-primary" },
    { label: "Creative Studio", icon: Palette, path: "/creative-studio", color: "text-primary" },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <PageShimmer />
      </DashboardLayout>
    );
  }

  const severityStyles = {
    critical: "border-destructive/40 bg-destructive/5",
    warning: "border-yellow-500/40 bg-yellow-500/5",
    info: "border-primary/30 bg-primary/5",
  };
  const severityIconStyles = {
    critical: "text-destructive",
    warning: "text-yellow-600",
    info: "text-primary",
  };

  if (!brand) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
          <div className="h-14 w-14 mx-auto rounded-full bg-gradient-to-br from-lumi-orange-1/20 via-lumi-pink-1/20 to-lumi-purple-1/20 flex items-center justify-center">
            <Zap className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold">Welcome back!</h1>
          <p className="text-muted-foreground">Set up your brand to get started with your first campaign.</p>
          <Button onClick={() => navigate("/onboarding")} className="gap-2">
            <PlusCircle className="h-4 w-4" /> Set Up Your Brand <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-8">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-lumi-orange-1/20 via-lumi-pink-1/20 to-lumi-purple-1/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold">
                {getGreeting()}{brand?.name ? `, ${brand.name.split(" ")[0]}` : ""}
              </h1>
              <p className="text-muted-foreground text-sm">{getSubtitle()}</p>
            </div>
          </div>
        </motion.div>

        {/* Section A: Needs Attention */}
        {attentionItems.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-3"
          >
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Needs Attention
            </h2>
            <div className="space-y-2">
              {attentionItems.map((item) => (
                <Card
                  key={item.id}
                  className={cn(
                    "border transition-all hover:shadow-sm cursor-pointer",
                    severityStyles[item.severity]
                  )}
                  onClick={item.action}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={cn("flex-shrink-0", severityIconStyles[item.severity])}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <Button size="sm" variant="outline" className="flex-shrink-0 text-xs">
                      {item.actionLabel}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.section>
        )}

        {/* Section B: Quick Actions */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card
                  key={action.label}
                  className="cursor-pointer border hover:border-primary/50 hover:shadow-sm transition-all"
                  onClick={() => navigate(action.path)}
                >
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                      <Icon className={cn("h-5 w-5", action.color)} />
                    </div>
                    <span className="text-sm font-medium">{action.label}</span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.section>

        {/* Section C: Weekly Digest Info (if live campaigns) */}
        {userState.hasLiveCampaigns && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <Card className="border-primary/15 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">📬 Your weekly digest arrives every Monday morning</p>
                  <p className="text-xs text-muted-foreground">Performance recap + Lumi's recommendations for the week. Manage your schedule in Settings.</p>
                </div>
                <Button size="sm" variant="outline" className="text-xs flex-shrink-0" onClick={() => navigate('/data')}>
                  Manage Reports
                </Button>
              </CardContent>
            </Card>
          </motion.section>
        )}

        {/* Section E: What's Working Right Now (Trend Insights) */}
        {trendLoading && userState.hasOffers && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.28 }}
            className="space-y-3"
          >
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              What's Working Right Now
            </h2>
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          </motion.section>
        )}

        {trendInsights && trendInsights.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.28 }}
            className="space-y-3"
          >
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              What's Working Right Now
            </h2>
            <div className="space-y-2">
              {trendInsights.map((insight: any, i: number) => (
                <Card
                  key={i}
                  className="border hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => navigate("/creative-studio")}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-lumi-orange-1/20 to-lumi-pink-1/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{insight.title || insight.hook || "Trending angle"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{insight.description || insight.summary || ""}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="flex-shrink-0 text-xs text-primary">
                      Try This Angle →
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.section>
        )}

        {/* Section D: Your Setup */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Your Setup
          </h2>

          {/* Progress bar */}
          {completedSteps < setupSteps.length && (
            <Card className="border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium">{setupProgress}% complete</span>
                  <span className="text-muted-foreground text-xs">{completedSteps} of {setupSteps.length} steps</span>
                </div>
                <Progress value={setupProgress} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* Contextual next-step nudge */}
          {nextStep && (
            <Card
              className="border-primary/30 bg-primary/5 cursor-pointer hover:shadow-sm transition-all"
              onClick={nextStep.action}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <nextStep.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">👉 Next up: {nextStep.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{nextStep.description}</p>
                </div>
                <Button size="sm" className="flex-shrink-0 text-xs">
                  {nextStep.actionLabel}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* All steps */}
          <Card>
            <CardContent className="p-4 space-y-1">
              {setupSteps.map((step, i) => {
                const StepIcon = step.icon;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 rounded-lg p-2.5 transition-all",
                      !step.done && "hover:bg-muted/50 cursor-pointer"
                    )}
                    onClick={!step.done ? step.action : undefined}
                  >
                    <div
                      className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                        step.done
                          ? "bg-green-500/10 text-green-600"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          step.done ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                    {step.done && step.count !== undefined && (
                      <Badge variant="secondary" className="text-xs">
                        {step.count}
                      </Badge>
                    )}
                    {step.done && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
                        Done
                      </Badge>
                    )}
                    {!step.done && (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* All done celebration */}
          {completedSteps === setupSteps.length && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-4 text-center space-y-1">
                <p className="text-sm font-semibold text-green-700">🎉 You're all set!</p>
                <p className="text-xs text-muted-foreground">Your brand is fully configured. Time to create scroll-stopping ads.</p>
              </CardContent>
            </Card>
          )}
        </motion.section>
      </div>
    </DashboardLayout>
  );

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  function getSubtitle() {
    if (!userState.hasOffers) return "Let's get your first offer set up.";
    if (attentionItems.length > 0) return "Here's what needs your attention.";
    if (userState.hasLiveCampaigns) return "Your ads are running. Looking good!";
    return "What would you like to work on?";
  }
}
