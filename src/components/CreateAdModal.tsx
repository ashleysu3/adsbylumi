import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Video, FileText, ShoppingCart, TrendingUp, Plus, Target, Users, Layers, PlusCircle, Sparkles, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { SparkleIcon } from "@/components/SparkleIcon";
import { LumiThinking } from "@/components/LumiThinking";
import { OfferDialog } from "@/components/OfferDialog";
import confetti from "canvas-confetti";

const iconMap: Record<string, any> = {
  Video,
  FileText,
  ShoppingCart,
  TrendingUp,
};

// Single recommendation mapping - returns ONE template slug per path
const recommendationMapping: Record<string, string> = {
  // Offer action paths
  purchase: "sell-offer",
  free_resource: "lead-magnet", 
  visit_page: "social-traffic",
  // Business problem paths
  video_trust: "video-views",
  social_growth: "social-traffic"
};

// Contextual recommendation messages
const recommendationMessages: Record<string, string> = {
  purchase: "This template is optimized for direct sales, guiding viewers straight to checkout with proven conversion strategies.",
  free_resource: "Perfect for growing your email list with a valuable lead magnet that attracts your ideal audience.",
  visit_page: "Drives quality traffic to your page and builds a warm audience for future campaigns.",
  video_trust: "Build trust with your ideal audience through engaging video content—perfect for warming people up before launching.",
  social_growth: "Grow your social presence and build engaged audiences for future campaigns and offers."
};

interface CreateAdModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAdModal({ open, onOpenChange }: CreateAdModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [brand, setBrand] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  
  // Flow state
  const [adCreationType, setAdCreationType] = useState<"existing" | "new" | null>(null);
  const [campaignGoal, setCampaignGoal] = useState<"offer" | "business_problem" | null>(null);
  const [businessProblem, setBusinessProblem] = useState<"video_trust" | "social_growth" | null>(null);
  const [offerExists, setOfferExists] = useState<"yes" | "no" | null>(null);
  const [offerAction, setOfferAction] = useState<"purchase" | "free_resource" | "visit_page" | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setFetchingData(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: brandData } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setBrand(brandData);
      
      const { data: templatesData } = await supabase
        .from("campaign_templates")
        .select("*")
        .eq("active", true)
        .order("created_at");
      setTemplates(templatesData || []);

      if (brandData) {
        const { data: offersData } = await supabase
          .from("offers")
          .select(`*, campaign_templates:recommended_template_id (name, slug)`)
          .eq("brand_id", brandData.id)
          .or("archived.is.null,archived.eq.false")
          .order("created_at", { ascending: false });
        setOffers(offersData || []);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
    } finally {
      setFetchingData(false);
    }
  };

  const fireConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#F4C960', '#EEA047', '#E8772F', '#9b87f5']
    });
  };

  const resetFlow = () => {
    setAdCreationType(null);
    setCampaignGoal(null);
    setBusinessProblem(null);
    setOfferExists(null);
    setOfferAction(null);
    setSelectedOfferId("");
    setShowAllTemplates(false);
  };

  const handleClose = () => {
    resetFlow();
    onOpenChange(false);
  };

  const handleAddToExisting = () => {
    handleClose();
    navigate("/campaigns?addCreative=true");
  };

  const handleTemplateClick = async (template: any) => {
    if (!brand) {
      toast.error("Please complete brand setup first");
      return;
    }
    setLoading(true);
    try {
      const selectedOffer = offers.find(o => o.id === selectedOfferId);

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
        offer_name: selectedOffer?.name || null,
        offer_url: selectedOffer?.url || null,
        offer_price: selectedOffer?.price_point || null,
        offer_description: selectedOffer?.description || null
      };
      
      const { data: newStrategy, error: strategyError } = await supabase
        .from("strategies")
        .insert(strategyData)
        .select()
        .single();
      if (strategyError) throw strategyError;

      const workspaceData = {
        brand_id: brand.id,
        template_id: template.id,
        strategy_id: newStrategy.id,
        name: selectedOffer ? `${template.name} - ${selectedOffer.name}` : template.name,
        strategy_json: template.strategy_template,
        progress_status: "creative_in_progress",
        offer_name: selectedOffer?.name || null,
        offer_url: selectedOffer?.url || null,
        offer_price: selectedOffer?.price_point || null,
        offer_description: selectedOffer?.description || null
      };
      
      const { data: newWorkspace, error: workspaceError } = await supabase
        .from("campaign_workspaces")
        .insert(workspaceData)
        .select()
        .single();
      if (workspaceError) throw workspaceError;
      
      fireConfetti();
      toast.success(`${template.name} workspace created!`);
      handleClose();
      navigate(`/creative-studio?workspace=${newWorkspace.id}`);
    } catch (error: any) {
      console.error("Error creating workspace:", error);
      toast.error(error.message || "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  // Determine what to show based on flow state
  const showFirstQuestion = adCreationType === null;
  const showNewCampaignFlow = adCreationType === "new";

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display">
              Create a <span className="text-gradient-lumi">New Ad</span>
            </DialogTitle>
            <DialogDescription>
              {showFirstQuestion 
                ? "Choose how you'd like to proceed"
                : "Let's set up your campaign"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* First Question: Add to existing or build new? */}
            {showFirstQuestion && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={handleAddToExisting}
                  className="p-6 rounded-xl border-2 transition-all text-left border-border hover:border-primary/50 hover:bg-primary/5"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Layers className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">Add new creative to an existing campaign</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add a new ad creative to one of your active campaigns
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setAdCreationType("new")}
                  className="p-6 rounded-xl border-2 transition-all text-left border-border hover:border-primary/50 hover:bg-primary/5"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <PlusCircle className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">Build a completely new Ad Campaign</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Start fresh with a new campaign strategy and creative
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* New Campaign Flow */}
            {showNewCampaignFlow && (
              <>
                {/* Campaign Goal Selection */}
                {!showAllTemplates && (
                  <Card variant="glow" className="border-primary/20">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">
                            Do you want an ad that goes to an offer or solving a business problem?
                          </Label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={resetFlow}
                            className="text-muted-foreground"
                          >
                            ← Back
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button
                            onClick={() => {
                              setCampaignGoal("offer");
                              setBusinessProblem(null);
                              setOfferExists(null);
                              setOfferAction(null);
                              setSelectedOfferId("");
                            }}
                            className={`p-4 rounded-lg border-2 transition-all text-left ${
                              campaignGoal === "offer" 
                                ? "border-primary bg-primary/5" 
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Target className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">Going to an offer</p>
                                <p className="text-sm text-muted-foreground">Drive traffic to a specific product or service</p>
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
                            className={`p-4 rounded-lg border-2 transition-all text-left ${
                              campaignGoal === "business_problem" 
                                ? "border-primary bg-primary/5" 
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <TrendingUp className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">Solving a business problem</p>
                                <p className="text-sm text-muted-foreground">Build awareness, trust, or grow your audience</p>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Offer Path: Does offer exist? */}
                {campaignGoal === "offer" && offerExists === null && !showAllTemplates && (
                  <Card variant="glow" className="border-primary/20">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <Label className="text-base font-semibold">
                          Does this offer already exist in your brand?
                        </Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button
                            onClick={() => setOfferExists("yes")}
                            className="p-4 rounded-lg border-2 transition-all text-left border-border hover:border-primary/50"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <FileText className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">Yes, it exists</p>
                                <p className="text-sm text-muted-foreground">Select from your existing offers</p>
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => {
                              setOfferExists("no");
                              setShowOfferDialog(true);
                            }}
                            className="p-4 rounded-lg border-2 transition-all text-left border-border hover:border-primary/50"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Plus className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">No, create new</p>
                                <p className="text-sm text-muted-foreground">Add a new offer to your brand</p>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Offer Path: Select existing offer */}
                {campaignGoal === "offer" && offerExists === "yes" && !selectedOfferId && !showAllTemplates && (
                  <Card variant="glow" className="border-primary/20">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Select your offer</Label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setOfferExists(null)}
                            className="text-muted-foreground"
                          >
                            ← Back
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {offers.map(offer => (
                            <button
                              key={offer.id}
                              onClick={() => setSelectedOfferId(offer.id)}
                              className="p-4 rounded-lg border-2 transition-all text-left border-border hover:border-primary/50"
                            >
                              <p className="font-medium">{offer.name}</p>
                              {offer.price_point && (
                                <p className="text-sm text-muted-foreground mt-1">{offer.price_point}</p>
                              )}
                            </button>
                          ))}
                        </div>
                        {offers.length === 0 && (
                          <div className="text-center py-6">
                            <p className="text-muted-foreground mb-4">No offers found. Create your first offer!</p>
                            <Button 
                              variant="lumi" 
                              onClick={() => {
                                setOfferExists("no");
                                setShowOfferDialog(true);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Create New Offer
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Offer Path: What action? */}
                {campaignGoal === "offer" && selectedOfferId && !offerAction && !showAllTemplates && (
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

                {/* Business Problem Options */}
                {campaignGoal === "business_problem" && !showAllTemplates && (
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
                                <p className="text-sm text-muted-foreground mt-1">Perfect for warming people up before launching</p>
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
                                <p className="text-sm text-muted-foreground mt-1">Increase followers and engagement</p>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* See All Templates Link - only show when in guided flow, not yet at recommendation */}
                {!showAllTemplates && !((campaignGoal === "offer" && offerAction) || (campaignGoal === "business_problem" && businessProblem)) && (
                  <div className="flex justify-center">
                    <button 
                      onClick={() => {
                        setShowAllTemplates(true);
                        setCampaignGoal(null);
                        setBusinessProblem(null);
                        setOfferExists(null);
                        setOfferAction(null);
                        setSelectedOfferId("");
                      }}
                      className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
                    >
                      See all campaign templates (Advanced)
                    </button>
                  </div>
                )}

                {/* Single Recommendation Card */}
                {!showAllTemplates && ((campaignGoal === "offer" && offerAction) || (campaignGoal === "business_problem" && businessProblem)) && (() => {
                  // Determine the recommendation key
                  const recommendationKey = offerAction || businessProblem;
                  if (!recommendationKey) return null;
                  
                  const recommendedSlug = recommendationMapping[recommendationKey];
                  const recommendedTemplate = templates.find(t => t.slug === recommendedSlug);
                  const contextMessage = recommendationMessages[recommendationKey];
                  
                  // Show shimmer loading state while fetching templates
                  if (fetchingData || templates.length === 0) {
                    return (
                      <div className="space-y-4 animate-fade-in">
                        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10 relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer -translate-x-full" />
                          <CardContent className="pt-6 relative">
                            <div className="flex gap-4">
                              <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
                              <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-2">
                                  <Skeleton className="h-4 w-4" />
                                  <Skeleton className="h-4 w-32" />
                                </div>
                                <div className="space-y-3">
                                  <div className="flex items-start gap-3">
                                    <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
                                    <div className="flex-1 space-y-2">
                                      <Skeleton className="h-5 w-48" />
                                      <Skeleton className="h-4 w-full" />
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                    <Skeleton className="h-5 w-24 rounded-full" />
                                  </div>
                                  <Skeleton className="h-12 w-full rounded-lg" />
                                </div>
                                <Skeleton className="h-12 w-full rounded-lg" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  }
                  
                  if (!recommendedTemplate) return null;
                  
                  const Icon = iconMap[recommendedTemplate.icon] || Video;
                  const selectedOffer = offers.find(o => o.id === selectedOfferId);
                  
                  return (
                    <div className="space-y-4">
                      {/* Context badges */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          {selectedOffer && (
                            <>
                              <Badge variant="secondary" className="text-xs">
                                {selectedOffer.name}
                              </Badge>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {offerAction === "purchase" ? "Purchase" : 
                             offerAction === "free_resource" ? "Sign up (free)" : 
                             offerAction === "visit_page" ? "Visit page" :
                             businessProblem === "video_trust" ? "Build trust via video" :
                             "Grow social presence"}
                          </Badge>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            if (offerAction) setOfferAction(null);
                            if (businessProblem) setBusinessProblem(null);
                          }}
                          className="text-muted-foreground"
                        >
                          ← Change goal
                        </Button>
                      </div>

                      {/* Lumi Recommendation Card */}
                      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10 shadow-lg shadow-primary/10 relative overflow-hidden">
                        {/* Decorative gradient */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-3xl" />
                        
                        <CardContent className="pt-6 relative">
                          <div className="flex gap-4">
                            {/* Lumi Character */}
                            <div className="flex-shrink-0">
                              <SparkleIcon size="lg" glow />
                            </div>
                            
                            {/* Recommendation Content */}
                            <div className="flex-1 space-y-4">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium text-primary">Lumi's Recommendation</span>
                              </div>
                              
                              <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                                    <Icon className="h-5 w-5 text-primary" />
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-semibold">{recommendedTemplate.name}</h3>
                                    <p className="text-sm text-muted-foreground">{recommendedTemplate.description}</p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">{recommendedTemplate.objective}</Badge>
                                  <Badge variant="outline">{recommendedTemplate.audience_type}</Badge>
                                </div>
                                
                                {/* Contextual message */}
                                <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                                  "{contextMessage}"
                                </p>
                              </div>
                              
                              {/* Get Started Button */}
                              <Button 
                                variant="lumi" 
                                size="lg" 
                                className="w-full group"
                                onClick={() => handleTemplateClick(recommendedTemplate)}
                              >
                                <Sparkles className="h-4 w-4 mr-2" />
                                Get Started with This Campaign
                                <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      {/* Advanced option */}
                      <div className="flex justify-center pt-2">
                        <button 
                          onClick={() => setShowAllTemplates(true)}
                          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
                        >
                          Want to see all campaign templates? (Advanced)
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* All Templates Grid (Advanced View) */}
                {showAllTemplates && (
                  <div className="space-y-4">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {templates.map(template => {
                        const Icon = iconMap[template.icon] || Video;
                        
                        return (
                          <Card
                            key={template.id}
                            variant="glow"
                            className="cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                            onClick={() => handleTemplateClick(template)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between">
                                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                  <Icon className="h-5 w-5 text-primary" />
                                </div>
                              </div>
                              <CardTitle className="text-lg">{template.name}</CardTitle>
                              <CardDescription className="text-sm">{template.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center gap-2 text-sm">
                                <Badge variant="secondary">{template.objective}</Badge>
                                <Badge variant="outline">{template.audience_type}</Badge>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lumi thinking state */}
      <LumiThinking isOpen={loading} />
      
      {/* Offer Dialog */}
      {brand && (
        <OfferDialog 
          open={showOfferDialog} 
          onOpenChange={(open) => {
            setShowOfferDialog(open);
            if (!open && offerExists === "no") {
              setOfferExists(null);
            }
          }} 
          brandId={brand.id}
          onSuccess={() => {
            fetchData();
            setOfferExists(null);
          }}
        />
      )}
    </>
  );
}
