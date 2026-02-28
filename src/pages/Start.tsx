import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { useBrand } from "@/contexts/BrandContext";
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
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);
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
        if (user) navigate("/onboarding");
        else navigate("/auth");
      });
      return;
    }
    setBrand(activeBrand);
    checkUserState(activeBrand);
  }, [brandLoading, activeBrand?.id]);

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

      setUserState({
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
      });
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
        action: () => navigate("/create"),
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

  // Setup checklist
  const setupSteps = [
    { label: "Offers added", done: userState.hasOffers, count: userState.offerCount },
    { label: "Ads created", done: userState.hasCampaigns, count: userState.campaignCount },
    { label: "Meta connected", done: userState.isMetaConnected },
  ];
  const completedSteps = setupSteps.filter((s) => s.done).length;

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

        {/* Section C: Your Setup */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Your Setup
            {completedSteps < setupSteps.length && (
              <span className="ml-2 text-xs font-normal">
                {completedSteps}/{setupSteps.length} complete
              </span>
            )}
          </h2>
          <Card>
            <CardContent className="p-4 space-y-3">
              {setupSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
                      step.done
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm flex-1",
                      step.done ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                  {step.done && step.count !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      {step.count}
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
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
