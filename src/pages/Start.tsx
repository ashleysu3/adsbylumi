import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  TrendingUp
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface UserState {
  hasOffers: boolean;
  hasCampaigns: boolean;
  hasLiveCampaigns: boolean;
  hasDraftCampaigns: boolean;
  isMetaConnected: boolean;
  offerCount: number;
  campaignCount: number;
  draftCount: number;
}

interface NextStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  priority: "high" | "medium" | "low";
  completed?: boolean;
}

export default function Start() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);
  const [userState, setUserState] = useState<UserState>({
    hasOffers: false,
    hasCampaigns: false,
    hasLiveCampaigns: false,
    hasDraftCampaigns: false,
    isMetaConnected: false,
    offerCount: 0,
    campaignCount: 0,
    draftCount: 0,
  });
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  useEffect(() => {
    checkUserState();
  }, []);

  const checkUserState = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check for brand
      const { data: brandData } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!brandData) {
        navigate("/onboarding");
        return;
      }

      setBrand(brandData);

      // Fetch all state in parallel
      const [offersResult, campaignsResult] = await Promise.all([
        supabase
          .from("offers")
          .select("id")
          .eq("brand_id", brandData.id)
          .eq("archived", false),
        supabase
          .from("campaign_workspaces")
          .select("id, progress_status")
          .eq("brand_id", brandData.id)
          .eq("archived", false),
      ]);

      const offers = offersResult.data || [];
      const campaigns = campaignsResult.data || [];
      const liveCampaigns = campaigns.filter(c => 
        ['live', 'completed', 'ready_to_publish'].includes(c.progress_status)
      );
      const draftCampaigns = campaigns.filter(c => 
        ['draft', 'creative_in_progress', 'waiting_for_assets'].includes(c.progress_status)
      );

      setUserState({
        hasOffers: offers.length > 0,
        hasCampaigns: campaigns.length > 0,
        hasLiveCampaigns: liveCampaigns.length > 0,
        hasDraftCampaigns: draftCampaigns.length > 0,
        isMetaConnected: !!brandData.meta_account_id,
        offerCount: offers.length,
        campaignCount: campaigns.length,
        draftCount: draftCampaigns.length,
      });
    } catch (error) {
      console.error("Error checking user state:", error);
    } finally {
      setLoading(false);
    }
  };

  // Generate personalized next steps based on user state
  const getNextSteps = (): NextStep[] => {
    const steps: NextStep[] = [];

    // Priority 1: No offers yet - encourage adding first offer
    if (!userState.hasOffers) {
      steps.push({
        id: "add-offer",
        title: "Add your first offer",
        description: "Tell us what you're promoting so we can create targeted ads",
        icon: <Package className="h-6 w-6" />,
        action: () => navigate("/create"),
        priority: "high",
      });
    }

    // Priority 2: Has offers but no campaigns - create first ad
    if (userState.hasOffers && !userState.hasCampaigns) {
      steps.push({
        id: "create-ad",
        title: "Create your first ad",
        description: "Our AI will help you craft scroll-stopping creative",
        icon: <Megaphone className="h-6 w-6" />,
        action: () => navigate("/create"),
        priority: "high",
      });
    }

    // Priority 3: Has draft campaigns - continue working
    if (userState.hasDraftCampaigns) {
      steps.push({
        id: "continue-draft",
        title: `Continue your ad${userState.draftCount > 1 ? 's' : ''}`,
        description: `You have ${userState.draftCount} ad${userState.draftCount > 1 ? 's' : ''} in progress`,
        icon: <RefreshCw className="h-6 w-6" />,
        action: () => navigate("/campaigns"),
        priority: "high",
      });
    }

    // Priority 4: Meta not connected (but has content)
    if (!userState.isMetaConnected && userState.hasOffers) {
      steps.push({
        id: "connect-meta",
        title: "Connect your Meta account",
        description: "Link Meta to publish ads and see real performance data",
        icon: <Link2 className="h-6 w-6" />,
        action: () => navigate("/settings"),
        priority: "medium",
      });
    }

    // Priority 5: Has live campaigns - check results
    if (userState.hasLiveCampaigns && userState.isMetaConnected) {
      steps.push({
        id: "check-results",
        title: "Check your results",
        description: "See how your ads are performing with AI insights",
        icon: <TrendingUp className="h-6 w-6" />,
        action: () => navigate("/data"),
        priority: "medium",
      });
    }

    // Always offer to create a new ad (lower priority if they have drafts)
    if (userState.hasOffers && (!userState.hasDraftCampaigns || userState.campaignCount > 0)) {
      steps.push({
        id: "new-ad",
        title: "Create a new ad",
        description: "Start fresh with a new campaign",
        icon: <PlusCircle className="h-6 w-6" />,
        action: () => navigate("/create"),
        priority: userState.hasDraftCampaigns ? "low" : "medium",
      });
    }

    return steps.slice(0, 3); // Show max 3 steps
  };

  const nextSteps = getNextSteps();
  const primaryStep = nextSteps[0];
  const secondarySteps = nextSteps.slice(1);

  // Progress indicators
  const completedSteps = [
    userState.hasOffers,
    userState.hasCampaigns,
    userState.isMetaConnected,
  ].filter(Boolean).length;
  const totalSteps = 3;

  if (loading) {
    return (
      <DashboardLayout>
        <PageShimmer />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center px-4">
        {/* Greeting with progress */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center mb-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-lumi-orange-1/20 via-lumi-pink-1/20 to-lumi-purple-1/20 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-lumi-pink-1 animate-pulse" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
            {getGreeting()}
          </h1>
          <p className="text-muted-foreground text-lg mb-4">
            Hi{brand?.name ? `, ${brand.name.split(' ')[0]}` : ''}! {getSubtitle()}
          </p>
          
          {/* Progress indicator */}
          {completedSteps < totalSteps && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="flex gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-2 w-8 rounded-full transition-colors",
                      i < completedSteps ? "bg-primary" : "bg-muted"
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {completedSteps}/{totalSteps} setup complete
              </span>
            </div>
          )}
        </motion.div>

        {/* Primary action - larger card */}
        {primaryStep && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full max-w-xl mb-4"
          >
            <Card
              className={cn(
                "relative overflow-hidden cursor-pointer transition-all duration-300 border-2",
                "hover:border-primary hover:shadow-lg hover:shadow-primary/10",
                hoveredOption === primaryStep.id
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-border"
              )}
              onClick={primaryStep.action}
              onMouseEnter={() => setHoveredOption(primaryStep.id)}
              onMouseLeave={() => setHoveredOption(null)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-lumi-orange-1/5 via-lumi-pink-1/5 to-lumi-purple-1/5 pointer-events-none" />
              
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-lumi-orange-1/20 via-lumi-pink-1/20 to-lumi-purple-1/20 flex items-center justify-center text-lumi-pink-1 flex-shrink-0">
                  {primaryStep.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{primaryStep.title}</h3>
                    <Badge className="bg-lumi-pink-1/10 text-lumi-pink-1 border-0">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Recommended
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{primaryStep.description}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Secondary actions */}
        {secondarySteps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-xl"
          >
            {secondarySteps.map((step, index) => (
              <Card
                key={step.id}
                className={cn(
                  "cursor-pointer transition-all duration-300 border",
                  "hover:border-primary/50 hover:shadow-md",
                  hoveredOption === step.id
                    ? "border-primary/50 bg-muted/50"
                    : "border-border"
                )}
                onClick={step.action}
                onMouseEnter={() => setHoveredOption(step.id)}
                onMouseLeave={() => setHoveredOption(null)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{step.title}</h4>
                    <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}

        {/* Status badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-wrap justify-center gap-2 mt-8"
        >
          {userState.isMetaConnected && (
            <Badge variant="outline" className="text-green-600 border-green-500/30 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Meta Connected
            </Badge>
          )}
          {userState.offerCount > 0 && (
            <Badge variant="outline" className="gap-1">
              <Package className="h-3 w-3" />
              {userState.offerCount} offer{userState.offerCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {userState.campaignCount > 0 && (
            <Badge variant="outline" className="gap-1">
              <Megaphone className="h-3 w-3" />
              {userState.campaignCount} ad{userState.campaignCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </motion.div>

        {/* Quick access footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-6 text-center"
        >
          <p className="text-sm text-muted-foreground mb-2">Quick access:</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/campaigns")}
            >
              My Ads
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/data")}
            >
              Results
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/settings")}
            >
              Settings
            </Button>
          </div>
        </motion.div>
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
    if (!userState.hasOffers) {
      return "Let's get your first offer set up.";
    }
    if (userState.hasDraftCampaigns) {
      return "Ready to pick up where you left off?";
    }
    if (!userState.isMetaConnected) {
      return "Connect Meta to start running ads.";
    }
    if (userState.hasLiveCampaigns) {
      return "Your ads are running. Here's what's next.";
    }
    return "What would you like to work on?";
  }
}
