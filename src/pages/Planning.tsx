import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Video, FileText, ShoppingCart, PhoneCall, TrendingUp, Play, Info, Plus, Target, Users } from "lucide-react";
import { toast } from "sonner";

import { SparkleIcon } from "@/components/SparkleIcon";
import { LumiRecommendedBadge } from "@/components/LumiRecommendedBadge";
import { useLumiAssistant } from "@/components/LumiAssistant";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LumiThinking } from "@/components/LumiThinking";
import { GridShimmer } from "@/components/GradientShimmer";
import { OfferDialog } from "@/components/OfferDialog";
import { MobilePlanningWizard } from "@/components/MobilePlanningWizard";
import { useIsMobile } from "@/hooks/use-mobile";

const iconMap: Record<string, any> = {
  Video,
  FileText,
  ShoppingCart,
  PhoneCall,
  TrendingUp,
  Play
};

export default function Planning() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { setRecommendation } = useLumiAssistant();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [brand, setBrand] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [offersWithRecommendations, setOffersWithRecommendations] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [campaignGoal, setCampaignGoal] = useState<"offer" | "business_problem" | null>(null);
  const [businessProblem, setBusinessProblem] = useState<"video_trust" | "social_growth" | null>(null);
  const [offerExists, setOfferExists] = useState<"yes" | "no" | null>(null);
  const [offerAction, setOfferAction] = useState<"purchase" | "free_resource" | "visit_page" | null>(null);
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  // Mapping from offer action to template slugs
  const offerActionToTemplates: Record<string, string[]> = {
    purchase: ["low-ticket-product-sales", "high-ticket-sales"],
    free_resource: ["free-resource-leads"],
    visit_page: ["traffic-page-visit", "traffic-instagram-facebook"]
  };
  
  useEffect(() => {
    fetchData();
  }, []);
  const fetchData = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      const {
        data: brandData
      } = await supabase.from("brands").select("*").eq("user_id", user.id).single();
      setBrand(brandData);
      const {
        data: templatesData
      } = await supabase.from("campaign_templates").select("*").eq("active", true).order("created_at");
      setTemplates(templatesData || []);

      // Fetch all offers (not archived)
      if (brandData) {
        const {
          data: offersData
        } = await supabase.from("offers").select(`
            *,
            campaign_templates:recommended_template_id (
              name,
              slug
            )
          `).eq("brand_id", brandData.id).or("archived.is.null,archived.eq.false").order("created_at", {
          ascending: false
        });
        setOffers(offersData || []);

        // Filter offers with recommendations
        const recommended = (offersData || []).filter(o => o.recommended_template_id);
        setOffersWithRecommendations(recommended);
        
        // Trigger Lumi recommendation popup if there are offers with recommendations
        if (recommended.length > 0) {
          setRecommendation({
            id: `planning-offers-${brandData.id}`,
            title: "Lumi recommends",
            message: `You have ${recommended.length} offer${recommended.length > 1 ? 's' : ''} with campaign recommendations ready! Start from your Brand Dashboard for the fastest setup.`,
            actionLabel: "View My Offers",
            onAction: () => navigate('/dashboard'),
          });
        }
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
    } finally {
      setInitialLoading(false);
    }
  };
  const handleTemplateClick = async (template: any) => {
    if (!brand) {
      toast.error("Please complete brand setup first");
      return;
    }
    setLoading(true);
    try {
      // Get selected offer data if one is selected
      const selectedOffer = offers.find(o => o.id === selectedOfferId);

      // Create strategy first
      const strategyData = {
        brand_id: brand.id,
        template_id: template.id,
        name: template.name,
        campaign_type: template.strategy_template.campaign_type,
        messaging_framework: template.strategy_template.messaging_framework,
        audience_psychology: template.strategy_template.audience_psychology,
        optimization_goals: template.strategy_template.optimization_goals,
        kpi_benchmarks: template.strategy_template.kpi_benchmarks,
        contextual_keywords: [],
        status: "active",
        // Include offer data in strategy
        offer_name: selectedOffer?.name || null,
        offer_url: selectedOffer?.url || null,
        offer_price: selectedOffer?.price_point || null,
        offer_description: selectedOffer?.description || null
      };
      const {
        data: newStrategy,
        error: strategyError
      } = await supabase.from("strategies").insert(strategyData).select().single();
      if (strategyError) throw strategyError;

      // Create campaign workspace with offer data pre-filled
      const workspaceData = {
        brand_id: brand.id,
        template_id: template.id,
        strategy_id: newStrategy.id,
        name: selectedOffer ? `${template.name} - ${selectedOffer.name}` : template.name,
        strategy_json: template.strategy_template,
        progress_status: "creative_in_progress",
        // Pre-fill offer data for campaign builder
        offer_name: selectedOffer?.name || null,
        offer_url: selectedOffer?.url || null,
        offer_price: selectedOffer?.price_point || null,
        offer_description: selectedOffer?.description || null
      };
      const {
        data: newWorkspace,
        error: workspaceError
      } = await supabase.from("campaign_workspaces").insert(workspaceData).select().single();
      if (workspaceError) throw workspaceError;
      toast.success(`${template.name} workspace created!`);
      navigate(`/creative?workspace=${newWorkspace.id}`);
    } catch (error: any) {
      console.error("Error creating workspace:", error);
      toast.error(error.message || "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };
  const openDetails = (template: any) => {
    setSelectedTemplate(template);
    setShowDetails(true);
  };
  // Show shimmer loading during initial load
  if (initialLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-8 py-[2px]">
          <div className="space-y-2">
            <h2 className="text-3xl font-display tracking-tight">
              Create a <span className="text-gradient-lumi">New Ad</span>
            </h2>
            <p className="text-muted-foreground">Loading your campaign templates...</p>
          </div>
          <GridShimmer count={6} />
        </div>
      </DashboardLayout>
    );
  }

  if (!brand) {
    return <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Setup Required</CardTitle>
            <CardDescription>Please complete your brand setup first.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>;
  }

  // Mobile Planning Wizard
  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="px-4 pb-24">
          <MobilePlanningWizard
            brand={brand}
            templates={templates}
            offers={offers}
            onCreateOffer={() => setShowOfferDialog(true)}
            onOfferCreated={() => {
              fetchData();
            }}
          />
        </div>
        
        {/* Offer Dialog */}
        <OfferDialog
          open={showOfferDialog}
          onOpenChange={setShowOfferDialog}
          brandId={brand?.id}
          onSuccess={() => {
            fetchData();
            setShowOfferDialog(false);
          }}
        />
        
        {/* Loading State */}
        <LumiThinking isOpen={loading} />
      </DashboardLayout>
    );
  }

  // Desktop Layout
  return <DashboardLayout>
      <div className="space-y-6 md:space-y-8 py-[2px]">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1 sm:space-y-2">
            <h2 className="text-2xl sm:text-3xl font-display tracking-tight">
              Create a <span className="text-gradient-lumi">New Ad</span>
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">Pick a campaign type and Lumi will guide you.</p>
          </div>
          <Button variant="lumi" size="sm" className="self-start min-h-[44px] px-4" onClick={() => setShowOfferDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Offer
          </Button>
        </div>

        {/* Campaign Goal Selection */}
        <Card variant="glow" className="border-primary/20">
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="space-y-3 sm:space-y-4">
              <Label className="text-sm sm:text-base font-semibold leading-tight">
                Ad going to an offer or solving a problem?
              </Label>
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <button
                  onClick={() => {
                    setCampaignGoal("offer");
                    setBusinessProblem(null);
                    setOfferExists(null);
                    setOfferAction(null);
                    setSelectedOfferId("");
                  }}
                  className={`p-3 sm:p-4 rounded-lg border-2 transition-all text-left min-h-[60px] active:scale-[0.98] ${
                    campaignGoal === "offer" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Target className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base">Going to an offer</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Drive traffic to a product or service</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setCampaignGoal("business_problem");
                    setSelectedOfferId("");
                    setOfferExists(null);
                    setOfferAction(null);
                  }}
                  className={`p-3 sm:p-4 rounded-lg border-2 transition-all text-left min-h-[60px] active:scale-[0.98] ${
                    campaignGoal === "business_problem" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base">Solving a business problem</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Build awareness, trust, or grow audience</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 1 for Offer Path: Does this offer already exist? */}
        {campaignGoal === "offer" && offerExists === null && (
          <Card variant="glow" className="border-primary/20">
            <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
              <div className="space-y-3 sm:space-y-4">
                <Label className="text-sm sm:text-base font-semibold">
                  Does this offer already exist?
                </Label>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => setOfferExists("yes")}
                    className="p-3 sm:p-4 rounded-lg border-2 transition-all text-left border-border hover:border-primary/50 min-h-[60px] active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm sm:text-base">Yes, it exists</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">Select from existing offers</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setOfferExists("no");
                      setShowOfferDialog(true);
                    }}
                    className="p-3 sm:p-4 rounded-lg border-2 transition-all text-left border-border hover:border-primary/50 min-h-[60px] active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Plus className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm sm:text-base">No, create new</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">Add a new offer</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2 for Offer Path: Select existing offer */}
        {campaignGoal === "offer" && offerExists === "yes" && !selectedOfferId && (
          <Card variant="glow" className="border-primary/20">
            <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm sm:text-base font-semibold">
                    Select your offer
                  </Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setOfferExists(null)}
                    className="text-muted-foreground min-h-[44px]"
                  >
                    ← Back
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {offers.map(offer => (
                    <button
                      key={offer.id}
                      onClick={() => setSelectedOfferId(offer.id)}
                      className="p-3 sm:p-4 rounded-lg border-2 transition-all text-left border-border hover:border-primary/50 min-h-[60px] active:scale-[0.98]"
                    >
                      <p className="font-medium text-sm sm:text-base">{offer.name}</p>
                      {offer.price_point && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">{offer.price_point}</p>
                      )}
                      {offer.url && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{offer.url}</p>
                      )}
                    </button>
                  ))}
                </div>
                {offers.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-4">No offers found. Create your first!</p>
                    <Button 
                      variant="lumi" 
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => {
                        setOfferExists("no");
                        setShowOfferDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Offer
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 for Offer Path: What do you want people to do? */}
        {campaignGoal === "offer" && selectedOfferId && !offerAction && (
          <Card variant="glow" className="border-primary/20">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">
                      What do you want people to do on this page?
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Selected: <span className="text-primary font-medium">{offers.find(o => o.id === selectedOfferId)?.name}</span>
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedOfferId("")}
                    className="text-muted-foreground"
                  >
                    ← Change offer
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setOfferAction("purchase")}
                    className="p-4 rounded-lg border-2 transition-all text-left border-border hover:border-primary/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Purchase</p>
                        <p className="text-sm text-muted-foreground mt-1">Buy a product or service</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setOfferAction("free_resource")}
                    className="p-4 rounded-lg border-2 transition-all text-left border-border hover:border-primary/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Sign up for a free thing</p>
                        <p className="text-sm text-muted-foreground mt-1">Lead magnet, webinar, etc.</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setOfferAction("visit_page")}
                    className="p-4 rounded-lg border-2 transition-all text-left border-border hover:border-primary/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Target className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Just go to the page</p>
                        <p className="text-sm text-muted-foreground mt-1">Drive traffic to learn more</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Business Problem Options - shows when "Solving a business problem" is selected */}
        {campaignGoal === "business_problem" && (
          <Card variant="glow" className="border-primary/20">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Label className="text-base font-semibold">
                  What business problem are you solving?
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setBusinessProblem("video_trust")}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      businessProblem === "video_trust" 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Video className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Build trust with your ideal audience via video</p>
                        <p className="text-sm text-muted-foreground mt-1">Perfect for future retargeting or if you will be launching in the future</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setBusinessProblem("social_growth")}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      businessProblem === "social_growth" 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Grow your social media presence</p>
                        <p className="text-sm text-muted-foreground mt-1">Increase followers and engagement on your profiles</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lumi recommendations now shown via popup */}

        {/* See All Templates Button */}
        {!showAllTemplates && (
          <div className="flex justify-center">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAllTemplates(true);
                setCampaignGoal(null);
                setBusinessProblem(null);
                setOfferExists(null);
                setOfferAction(null);
                setSelectedOfferId("");
              }}
              className="text-muted-foreground"
            >
              See all campaign templates
            </Button>
          </div>
        )}

        {/* Template Grid - show when a path is fully selected OR when showAllTemplates is true */}
        {(showAllTemplates || (campaignGoal === "offer" && offerAction) || (campaignGoal === "business_problem" && businessProblem)) && (
          <div className="space-y-4">
            {/* Show back button and selection summary for offer path */}
            {campaignGoal === "offer" && offerAction && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {offers.find(o => o.id === selectedOfferId)?.name}
                  </Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline" className="text-xs">
                    {offerAction === "purchase" ? "Purchase" : offerAction === "free_resource" ? "Sign up (free)" : "Visit page"}
                  </Badge>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setOfferAction(null)}
                  className="text-muted-foreground"
                >
                  ← Change goal
                </Button>
              </div>
            )}
            {/* Show back button for show all templates mode */}
            {showAllTemplates && (
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">All available campaign templates</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowAllTemplates(false)}
                  className="text-muted-foreground"
                >
                  ← Back to guided flow
                </Button>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates
              .filter(template => {
                // Show all templates if showAllTemplates is true
                if (showAllTemplates) {
                  return true;
                }
                // Filter templates based on business problem selection
                if (campaignGoal === "business_problem") {
                  if (businessProblem === "video_trust") {
                    return template.slug === "video-views";
                  }
                  if (businessProblem === "social_growth") {
                    return template.slug === "traffic-instagram-facebook";
                  }
                }
                // Filter templates based on offer action selection
                if (campaignGoal === "offer" && offerAction) {
                  const allowedSlugs = offerActionToTemplates[offerAction] || [];
                  return allowedSlugs.includes(template.slug);
                }
                return true;
              })
              .map(template => {
                const Icon = iconMap[template.icon] || Video;
                const isRecommendedForSelectedOffer = selectedOfferId && offers.find(o => o.id === selectedOfferId)?.recommended_template_id === template.id;
                const isRecommendedForBusinessProblem = campaignGoal === "business_problem" && businessProblem;
                return <Card
                      key={template.id} 
                      variant={isRecommendedForSelectedOffer || isRecommendedForBusinessProblem ? "gradient" : "glow"}
                      className={`cursor-pointer transition-all duration-300 relative hover:scale-[1.02] ${isRecommendedForSelectedOffer || isRecommendedForBusinessProblem ? "shadow-glow" : ""}`}
                    >
                      {isRecommendedForSelectedOffer && (
                          <LumiRecommendedBadge className="absolute -top-2 -right-2" />
                        )}
                      {isRecommendedForBusinessProblem && (
                          <LumiRecommendedBadge className="absolute -top-2 -right-2" />
                        )}
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <Icon className="h-6 w-6 text-primary" />
                          </div>
                          <Button variant="ghost" size="sm" onClick={e => {
                        e.stopPropagation();
                        openDetails(template);
                      }}>
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                        <CardTitle className="text-xl">{template.name}</CardTitle>
                        {offersWithRecommendations.some(o => o.recommended_template_id === template.id) && !isRecommendedForSelectedOffer && campaignGoal === "offer" && <Badge variant="secondary" className="text-xs mt-1">
                            Recommended for: {offersWithRecommendations.find(o => o.recommended_template_id === template.id)?.name}
                          </Badge>}
                        <CardDescription className="min-h-[48px]">{template.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Objective:</span>
                            <Badge variant="secondary">{template.objective}</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Traffic:</span>
                            <Badge variant="outline">{template.audience_type}</Badge>
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-3"><strong>Use this for:</strong> {template.use_case}</p>
                          <Button className="w-full" variant="lumi" onClick={() => handleTemplateClick(template)} disabled={loading}>
                            {loading ? <><SparkleIcon size="xs" state="loading" className="mr-2" />Setting up...</> : "Let's Go"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>;
              })}
            </div>
          </div>
        )}

        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-3">
                {selectedTemplate && (() => {
                const Icon = iconMap[selectedTemplate.icon] || Video;
                return <Icon className="h-6 w-6 text-primary" />;
              })()}
                <span>{selectedTemplate?.name}</span>
              </DialogTitle>
              <DialogDescription>{selectedTemplate?.long_description}</DialogDescription>
            </DialogHeader>
            {selectedTemplate && <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Campaign Structure</p>
                    <p className="text-sm text-muted-foreground">{selectedTemplate.campaign_structure}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Budget Suggestion</p>
                    <p className="text-sm text-muted-foreground">{selectedTemplate.budget_suggestion || "Flexible"}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">What You'll Get</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Pre-configured campaign strategy</li>
                    <li>• Psychology-driven messaging framework</li>
                    <li>• AI-generated ad scripts and copy</li>
                    <li>• Creative direction and shot lists</li>
                    <li>• KPI benchmarks and optimization goals</li>
                  </ul>
                </div>
                <div className="flex space-x-3 pt-4">
                  <Button className="flex-1" variant="lumi" onClick={() => {
                setShowDetails(false);
                handleTemplateClick(selectedTemplate);
              }} disabled={loading}>
                    {loading ? <><SparkleIcon size="xs" state="loading" className="mr-2" />Loading...</> : "Choose This Template"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowDetails(false)}>Cancel</Button>
                </div>
              </div>}
          </DialogContent>
        </Dialog>

        {/* Lumi thinking state for strategy creation */}
        <LumiThinking isOpen={loading} />
        
        {/* Offer Dialog */}
        {brand && (
          <OfferDialog 
            open={showOfferDialog} 
            onOpenChange={(open) => {
              setShowOfferDialog(open);
              // Reset to offer exists question when dialog closes
              if (!open && offerExists === "no") {
                setOfferExists(null);
              }
            }} 
            brandId={brand.id}
            onSuccess={() => {
              fetchData();
              setOfferExists(null); // Reset to show offers list again
            }}
          />
        )}
      </div>
    </DashboardLayout>;
}