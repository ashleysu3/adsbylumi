import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import DashboardLayout from "@/components/DashboardLayout";
import { MobileStepWizard, StepOption } from "@/components/MobileStepWizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageShimmer } from "@/components/GradientShimmer";
import { OfferDialog } from "@/components/OfferDialog";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Sparkles,
  Target,
  Zap,
  ChevronRight,
  Lightbulb,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Video,
  Image,
  Layers,
  Wand2,
  Rocket,
  Instagram,
  Users,
  Upload,
  MessageCircle,
  Play,
  Globe,
  MapPin } from
"lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import lumiLogo from "@/assets/lumi-logo.png";
import { SocialGrowthFlow } from "@/components/SocialGrowthFlow";
import { LumiEducationCard } from "@/components/LumiEducationCard";

// System offer IDs
const SOCIAL_GROWTH_OFFER_ID = "system-social-growth";
const COMMENT_DM_OFFER_ID = "system-comment-dm";
const TRAFFIC_IG_OFFER_ID = "system-traffic-ig";
const VIDEO_VIEWS_OFFER_ID = "system-video-views";
const DM_LEADS_OFFER_ID = "system-dm-leads";
const LOCAL_NEARBY_OFFER_ID = "system-local-nearby";
const LOCAL_REGIONAL_OFFER_ID = "system-local-regional";
const EVENT_LOCATION_OFFER_ID = "system-event-location";

const SYSTEM_OFFER_IDS = [
SOCIAL_GROWTH_OFFER_ID, COMMENT_DM_OFFER_ID, TRAFFIC_IG_OFFER_ID, VIDEO_VIEWS_OFFER_ID,
DM_LEADS_OFFER_ID, LOCAL_NEARBY_OFFER_ID, LOCAL_REGIONAL_OFFER_ID, EVENT_LOCATION_OFFER_ID];


const LOCAL_STRATEGY_SLUG_MAP: Record<string, string> = {
  [LOCAL_NEARBY_OFFER_ID]: "local-nearby",
  [LOCAL_REGIONAL_OFFER_ID]: "local-regional",
  [EVENT_LOCATION_OFFER_ID]: "event-location"
};

const SOCIAL_GROWTH_IDS = [SOCIAL_GROWTH_OFFER_ID, COMMENT_DM_OFFER_ID, TRAFFIC_IG_OFFER_ID, VIDEO_VIEWS_OFFER_ID];
const DM_LEADS_IDS = [DM_LEADS_OFFER_ID];
const LOCAL_STRATEGY_IDS = [LOCAL_NEARBY_OFFER_ID, LOCAL_REGIONAL_OFFER_ID, EVENT_LOCATION_OFFER_ID];

// Types
interface Offer {
  id: string;
  name: string;
  description: string | null;
  price_point: string | null;
  url: string | null;
  recommended_template_id: string | null;
  product_psychology: any;
}

interface CampaignTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  long_description: string;
  objective: string;
  use_case: string;
  campaign_structure: string;
  strategy_template: any;
}

interface CreativeAngle {
  id: string;
  name: string;
  hook: string;
  description: string;
  psychologyTrigger: string;
}

interface CreativeTemplate {
  id: string;
  type: "video" | "graphic" | "hybrid";
  name: string;
  description: string;
  canvaUrl: string;
  thumbnail?: string;
}

// Creative templates with real Canva template URLs
const CREATIVE_TEMPLATES: CreativeTemplate[] = [
{
  id: "talking-head-1",
  type: "video",
  name: "Talking Head Script",
  description: "Direct-to-camera script with proven hook structure",
  canvaUrl: "https://www.canva.com/design/DAGd9R4X_Ck/edit",
  thumbnail: "https://marketplace.canva.com/EAFaQMYuZbo/1/0/1600w/canva-white-elegant-simple-quote-instagram-story-u_dMvlfrVxU.jpg"
},
{
  id: "carousel-1",
  type: "graphic",
  name: "Story Carousel",
  description: "5-slide carousel that tells your transformation story",
  canvaUrl: "https://www.canva.com/design/DAGKpB0mSYQ/edit",
  thumbnail: "https://marketplace.canva.com/EAFXKFIDad4/1/0/1600w/canva-beige-minimalistic-modern-feminine-carousel-instagram-post-jJrNv-0gLJA.jpg"
},
{
  id: "broll-1",
  type: "hybrid",
  name: "B-Roll + Voiceover",
  description: "Visual montage with compelling voiceover script",
  canvaUrl: "https://www.canva.com/design/DAGd6JZF3OA/edit",
  thumbnail: "https://marketplace.canva.com/EAFqNrAJGSQ/1/0/1600w/canva-grey-black-white-animated-new-product-launch-countdown-video-7CqGPNaQNsM.jpg"
}];


const STORAGE_KEY = "create_wizard_progress";

interface WizardProgress {
  currentStep: number;
  selectedOfferId: string;
  selectedTemplateId: string;
  selectedAngle: CreativeAngle | null;
  generatedAngles: CreativeAngle[];
  selectedCreativeTemplates: string[];
  savedAt: number;
}

export default function Create() {
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0); // 0 = entry choice
  const totalSteps = 2;

  // Data
  const [brand, setBrand] = useState<any>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);

  // Wizard state
  const [selectedGoal, setSelectedGoal] = useState<string>("");
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [recommendedTemplate, setRecommendedTemplate] = useState<CampaignTemplate | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<CreativeAngle | null>(null);
  const [generatedAngles, setGeneratedAngles] = useState<CreativeAngle[]>([]);
  const [selectedCreativeTemplates, setSelectedCreativeTemplates] = useState<string[]>([]);
  const [isGeneratingAngles, setIsGeneratingAngles] = useState(false);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

  // New offer form
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [newOfferName, setNewOfferName] = useState("");
  const [newOfferUrl, setNewOfferUrl] = useState("");

  // Social growth flow state
  const [showSocialGrowthFlow, setShowSocialGrowthFlow] = useState(false);
  
  // DM Leads state
  const [dmConversionLocation, setDmConversionLocation] = useState<"instagram" | "facebook">("instagram");
  const [dmContentChoice, setDmContentChoice] = useState<"existing_posts" | "creative_studio" | "">("");

  // Resume state
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedProgress, setSavedProgress] = useState<WizardProgress | null>(null);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Save progress to localStorage whenever wizard state changes
  useEffect(() => {
    if (!loading && brand && currentStep > 0) {
      setSaveStatus("saving");

      const progress: WizardProgress = {
        currentStep,
        selectedOfferId,
        selectedTemplateId,
        selectedAngle,
        generatedAngles,
        selectedCreativeTemplates,
        savedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));

      // Show saved status
      setSaveStatus("saved");
      const timer = setTimeout(() => setSaveStatus("idle"), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentStep, selectedOfferId, selectedTemplateId, selectedAngle, generatedAngles, selectedCreativeTemplates, loading, brand]);

  // Clear saved progress
  const clearSavedProgress = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedProgress(null);
    setShowResumePrompt(false);
  };

  // Restore progress from saved state
  const restoreProgress = () => {
    if (savedProgress) {
      setCurrentStep(savedProgress.currentStep);
      setSelectedOfferId(savedProgress.selectedOfferId);
      setSelectedTemplateId(savedProgress.selectedTemplateId);
      setSelectedAngle(savedProgress.selectedAngle);
      setGeneratedAngles(savedProgress.generatedAngles);
      setSelectedCreativeTemplates(savedProgress.selectedCreativeTemplates);
      setShowResumePrompt(false);
    }
  };

  // Re-fetch when active brand changes
  useEffect(() => {
    fetchData();
  }, [activeBrand?.id]);

  // Reset state when brand changes
  useEffect(() => {
    setSelectedGoal("");
    setSelectedOfferId("");
    setSelectedTemplateId("");
    setSelectedAngle(null);
    setGeneratedAngles([]);
    setSelectedCreativeTemplates([]);
    setShowSocialGrowthFlow(false);
    setCurrentStep(0);
  }, [activeBrand?.id]);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Use active brand from context, or fall back to most recent
      let brandQuery = supabase.from("brands").select("*");

      if (activeBrand?.id) {
        brandQuery = brandQuery.eq("id", activeBrand.id);
      } else {
        brandQuery = brandQuery.eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
      }

      const { data: brandData } = await brandQuery.maybeSingle();

      if (!brandData) {
        navigate("/onboarding");
        return;
      }
      setBrand(brandData);

      // Fetch offers for the correct brand
      const { data: offersData } = await supabase.
      from("offers").
      select("*").
      eq("brand_id", brandData.id).
      eq("archived", false).
      order("created_at", { ascending: false });

      setOffers(offersData || []);

      // Fetch templates
      const { data: templatesData } = await supabase.
      from("campaign_templates").
      select("*").
      eq("active", true).
      order("sort_order");

      setTemplates(templatesData || []);

      // Check for saved progress after data is loaded
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const progress: WizardProgress = JSON.parse(saved);
          const isRecent = Date.now() - progress.savedAt < 24 * 60 * 60 * 1000;
          const hasMeaningfulProgress = progress.currentStep > 1 || progress.selectedOfferId;

          if (isRecent && hasMeaningfulProgress) {
            const offerStillExists = !progress.selectedOfferId ||
            (offersData || []).some((o) => o.id === progress.selectedOfferId);

            if (offerStillExists) {
              setSavedProgress(progress);
              setShowResumePrompt(true);
            } else {
              localStorage.removeItem(STORAGE_KEY);
            }
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // When offer is selected, find recommended template
  useEffect(() => {
    if (selectedOfferId) {
      const offer = offers.find((o) => o.id === selectedOfferId);
      if (offer?.recommended_template_id) {
        const template = templates.find((t) => t.id === offer.recommended_template_id);
        if (template) {
          setRecommendedTemplate(template);
          setSelectedTemplateId(template.id);
        }
      } else {
        // Default to first template if no recommendation
        const defaultTemplate = templates.find((t) => t.objective === "Sales") || templates[0];
        if (defaultTemplate) {
          setRecommendedTemplate(defaultTemplate);
          setSelectedTemplateId(defaultTemplate.id);
        }
      }
    }
  }, [selectedOfferId, offers, templates]);

  const handleNext = async () => {
    if (currentStep === 2) {
      // After strategy, generate angles and go directly to Creative Studio
      await handleGenerateAndNavigate();
      return; // Don't increment step, we're navigating away
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  // New function: Generate angles, create workspace, and navigate to Creative Studio
  const handleGenerateAndNavigate = async () => {
    if (!selectedTemplateId) {
      toast.error("Please select a strategy");
      return;
    }

    const isLocalStrategy = LOCAL_STRATEGY_IDS.includes(selectedOfferId);

    if (!isLocalStrategy && !selectedOfferId) {
      toast.error("Please select an offer and strategy");
      return;
    }

    setIsGeneratingAngles(true);
    try {
      const selectedOffer = isLocalStrategy ? null : offers.find((o) => o.id === selectedOfferId);
      const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

      if (!selectedTemplate) {
        throw new Error("Missing template selection");
      }
      if (!isLocalStrategy && !selectedOffer) {
        throw new Error("Missing offer selection");
      }

      const campaignName = isLocalStrategy ?
      selectedTemplate.name :
      `${selectedTemplate.name} - ${selectedOffer!.name}`;

      // Generate creative angles
      const { data: anglesData, error: anglesError } = await supabase.functions.invoke('generate-creative-angles', {
        body: {
          brandName: brand.name,
          strategyData: selectedTemplate?.strategy_template,
          audiencePsychology: brand.audience_psychology,
          offerData: isLocalStrategy ? {
            name: selectedTemplate.name,
            description: selectedTemplate.description
          } : {
            name: selectedOffer!.name,
            description: selectedOffer!.description,
            price: selectedOffer!.price_point,
            product_psychology: selectedOffer!.product_psychology
          }
        }
      });

      if (anglesError) throw anglesError;

      const angles = anglesData.angles || [];

      // Fallback angles if API returns empty
      const finalAngles = angles.length > 0 ? angles : [
      {
        id: "angle-1",
        name: "Problem-Solution",
        hook: "Struggling with [pain point]? Here's the fix.",
        description: "Lead with the pain your audience feels, then present your offer as the solution.",
        psychologyTrigger: "Pain avoidance"
      },
      {
        id: "angle-2",
        name: "Social Proof",
        hook: "See why [X] people chose this...",
        description: "Leverage testimonials and results to build trust quickly.",
        psychologyTrigger: "Social validation"
      },
      {
        id: "angle-3",
        name: "Curiosity Gap",
        hook: "The one thing most people don't know about...",
        description: "Create intrigue that compels the viewer to learn more.",
        psychologyTrigger: "Curiosity"
      }];


      // Create strategy
      const strategyInsert = {
        brand_id: brand.id,
        template_id: selectedTemplate.id,
        name: campaignName,
        campaign_type: selectedTemplate.strategy_template?.campaign_type || "cold",
        messaging_framework: selectedTemplate.strategy_template?.messaging_framework,
        audience_psychology: selectedTemplate.strategy_template?.audience_psychology,
        optimization_goals: selectedTemplate.strategy_template?.optimization_goals,
        kpi_benchmarks: selectedTemplate.strategy_template?.kpi_benchmarks,
        status: "active",
        offer_name: selectedOffer?.name || null,
        offer_url: selectedOffer?.url || null,
        offer_price: selectedOffer?.price_point || null,
        offer_description: selectedOffer?.description || null
      };

      const { data: strategy, error: strategyError } = await supabase.
      from("strategies").
      insert(strategyInsert).
      select().
      single();

      if (strategyError) throw strategyError;

      // Create workspace with all angles (user will select in Creative Studio)
      const workspaceInsert = {
        brand_id: brand.id as string,
        strategy_id: strategy.id,
        template_id: selectedTemplate.id,
        name: campaignName,
        strategy_json: selectedTemplate.strategy_template as any,
        progress_status: "creative_in_progress",
        offer_id: selectedOffer?.id || null,
        offer_name: selectedOffer?.name || null,
        offer_url: selectedOffer?.url || null,
        offer_price: selectedOffer?.price_point || null,
        offer_description: selectedOffer?.description || null,
        creative_json: {
          angles: finalAngles.map((a: any) => ({ ...a })),
          selectedAngleIds: [], // Let user select in Creative Studio
          selectedCreativeTemplates: [],
          phase1Flow: true,
          ...(isLocalStrategy ? { localStrategy: true, locationSlug: LOCAL_STRATEGY_SLUG_MAP[selectedOfferId] } : {})
        } as any
      };

      const { data: workspace, error: workspaceError } = await supabase.
      from("campaign_workspaces").
      insert([workspaceInsert]).
      select().
      single();

      if (workspaceError) throw workspaceError;

      // Clear saved progress on successful completion
      clearSavedProgress();

      toast.success("Angles generated! Let's build your creative.");
      navigate(`/creative-studio?workspace=${workspace.id}`);
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      toast.error(error.message || "Failed to create campaign");
    } finally {
      setIsGeneratingAngles(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else if (currentStep === 1 && selectedGoal) {
      setSelectedGoal("");
      setSelectedOfferId("");
      setShowSocialGrowthFlow(false);
    } else if (currentStep === 1) {
      setCurrentStep(0); // Go back to entry choice
    } else {
      navigate("/start");
    }
  };

  const handleComplete = async () => {
    // Streamlined flow: generate angles and navigate to Creative Studio
    await handleGenerateAndNavigate();
  };

  const generateCreativeAngles = async () => {
    if (!selectedOfferId || !selectedTemplateId) return;

    setIsGeneratingAngles(true);
    try {
      const selectedOffer = offers.find((o) => o.id === selectedOfferId);
      const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

      const { data, error } = await supabase.functions.invoke('generate-creative-angles', {
        body: {
          brandName: brand.name,
          strategyData: selectedTemplate?.strategy_template,
          audiencePsychology: brand.audience_psychology,
          offerData: {
            name: selectedOffer?.name,
            description: selectedOffer?.description,
            price: selectedOffer?.price_point,
            product_psychology: selectedOffer?.product_psychology
          }
        }
      });

      if (error) throw error;

      const angles = data.angles || [];
      setGeneratedAngles(angles);

      // Auto-select the first (recommended) angle
      if (angles.length > 0) {
        setSelectedAngle(angles[0]);
      }
    } catch (error: any) {
      console.error("Error generating angles:", error);
      // Generate fallback angles if API fails
      const fallbackAngles: CreativeAngle[] = [
      {
        id: "angle-1",
        name: "Problem-Solution",
        hook: "Struggling with [pain point]? Here's the fix.",
        description: "Lead with the pain your audience feels, then present your offer as the solution.",
        psychologyTrigger: "Pain avoidance"
      },
      {
        id: "angle-2",
        name: "Social Proof",
        hook: "See why [X] people chose this...",
        description: "Leverage testimonials and results to build trust quickly.",
        psychologyTrigger: "Social validation"
      },
      {
        id: "angle-3",
        name: "Curiosity Gap",
        hook: "The one thing most people don't know about...",
        description: "Create intrigue that compels the viewer to learn more.",
        psychologyTrigger: "Curiosity"
      }];

      setGeneratedAngles(fallbackAngles);
      setSelectedAngle(fallbackAngles[0]);
      toast.error("Used fallback angles. Try regenerating later.");
    } finally {
      setIsGeneratingAngles(false);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:return !!selectedOfferId;
      case 2:return !!selectedTemplateId;
      default:return false;
    }
  };

  const isSystemOffer = SYSTEM_OFFER_IDS.includes(selectedOfferId);
  const isSocialGrowth = SOCIAL_GROWTH_IDS.includes(selectedOfferId);
  const isLocalStrategy = LOCAL_STRATEGY_IDS.includes(selectedOfferId);

  const getStepTitle = (): string => {
    switch (currentStep) {
      case 1:
        if (!selectedGoal) return "What's your goal?";
        if (selectedGoal === "grow_social") return "Choose your creative";
        if (selectedGoal === "local") return "Choose your location strategy";
        return "Choose your offer";
      case 2:return "Recommended strategy";
      default:return "";
    }
  };

  const getStepSubtitle = (): string => {
    switch (currentStep) {
      case 1:
        if (!selectedGoal) return "Tell LUMI what you're trying to accomplish";
        if (selectedGoal === "grow_social") return "Select the posts you'd like to promote";
        if (selectedGoal === "local") return "LUMI will match the right approach";
        return "What are we promoting?";
      case 2:return isLocalStrategy ?
        "Lumi matched this location-based strategy for you" :
        isSocialGrowth ?
        "Lumi's recommendation for your strategy" :
        "Lumi picked the best approach for your offer";
      default:return "";
    }
  };

  const handleOfferCreated = async () => {
    await fetchData();
    setShowOfferDialog(false);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageShimmer />
      </DashboardLayout>);

  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        {/* Resume Progress Prompt - Enhanced with preview */}
        <AnimatePresence>
          {showResumePrompt && savedProgress &&
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4">
            
              <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10 overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <img
                        src={lumiLogo}
                        alt="Lumi"
                        className="h-8 w-8" />
                      
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">Resume where you left off? 👋</p>
                      
                      {/* Progress Preview */}
                      <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex -space-x-1">
                            {Array.from({ length: totalSteps }).map((_, i) =>
                          <div
                            key={i}
                            className={cn(
                              "h-2 w-2 rounded-full border border-background",
                              i < savedProgress.currentStep ?
                              "bg-primary" :
                              "bg-muted-foreground/30"
                            )} />

                          )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Step {savedProgress.currentStep} of {totalSteps}
                          </span>
                        </div>
                        
                        {/* Show what was selected */}
                        <div className="space-y-1.5 text-xs">
                          {savedProgress.selectedOfferId &&
                        <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              <span className="text-muted-foreground">Offer:</span>
                              <span className="font-medium truncate">
                                {offers.find((o) => o.id === savedProgress.selectedOfferId)?.name || "Selected"}
                              </span>
                            </div>
                        }
                          {savedProgress.selectedTemplateId &&
                        <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              <span className="text-muted-foreground">Strategy:</span>
                              <span className="font-medium truncate">
                                {templates.find((t) => t.id === savedProgress.selectedTemplateId)?.name || "Selected"}
                              </span>
                            </div>
                        }
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3">
                        <Button
                        size="sm"
                        onClick={restoreProgress}
                        className="gap-1.5">
                        
                          <ArrowRight className="h-3.5 w-3.5" />
                          Continue
                        </Button>
                        <Button
                        size="sm"
                        variant="ghost"
                        onClick={clearSavedProgress}>
                        
                          Start fresh
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          }
        </AnimatePresence>

        {/* Entry Step: Choose flow */}
        {currentStep === 0 &&
        <motion.div
          key="step-entry"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 py-8">
          
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-2xl font-heading font-bold text-foreground">What would you like to do?</h1>
              <p className="text-muted-foreground">Choose how you'd like to get started</p>
            </div>

            <div className="grid gap-4">
              {/* New Campaign */}
              <button
              onClick={() => setCurrentStep(1)}
              className="group text-left w-full">
              
                <Card variant="glow" className="p-6 hover:shadow-glow transition-all cursor-pointer group-hover:border-primary/50">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-lumi-orange-1 to-lumi-pink-1 flex items-center justify-center flex-shrink-0">
                      <Rocket className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-lg">Create a New Ad Campaign</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Start from scratch — pick your offer, strategy, and generate creative
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-1 flex-shrink-0" />
                  </div>
                </Card>
              </button>

              {/* Existing Campaign */}
              <button
              onClick={() => navigate("/advanced-build")}
              className="group text-left w-full">
              
                <Card variant="glow" className="p-6 hover:shadow-glow transition-all cursor-pointer group-hover:border-primary/50">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-lumi-purple-1 to-lumi-pink-1 flex items-center justify-center flex-shrink-0">
                      <Upload className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-lg">Create New Ads for an Existing Campaign</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add fresh creative to a campaign that's already running
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-1 flex-shrink-0" />
                  </div>
                </Card>
              </button>
            </div>
          </motion.div>
        }

        {currentStep >= 1 &&
        <MobileStepWizard
          currentStep={currentStep}
          totalSteps={totalSteps}
          title={getStepTitle()}
          subtitle={getStepSubtitle()}
          onBack={handleBack}
          onNext={handleNext}
          onComplete={handleComplete}
          canProceed={canProceed()}
          isLoading={isGeneratingAngles || isCreatingCampaign}
          nextLabel={currentStep === 2 ? "Generate Angles" : "Continue"}
          saveStatus={saveStatus}
          completeLabel="Create My Ad"
          showBackOnFirstStep={true}
          hideFooter={showSocialGrowthFlow && currentStep === 1}>
          
          <AnimatePresence mode="wait">
            {/* Step 1: Goal-first Selection */}
            {currentStep === 1 &&
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4">
              
                {/* Stage A: Goal Selection */}
                {!selectedGoal &&
              <div className="space-y-3">
                    <StepOption
                  selected={false}
                  onSelect={() => setSelectedGoal("promote_offer")}
                  icon={<Package className="h-5 w-5" />}
                  title="Promote an offer or landing page"
                  description="A webinar, course, coaching program, lead magnet, or any page you want traffic to" />
                
                    




                
                
                    <StepOption
                  selected={false}
                  onSelect={() => setSelectedGoal("book_calls")}
                  icon={<MessageCircle className="h-5 w-5" />}
                  title="Get people to book a call with me"
                  description="Fill your calendar with discovery calls or consultations" />
                
                    <StepOption
                  selected={false}
                  onSelect={() => setSelectedGoal("dm_leads")}
                  icon={<Users className="h-5 w-5" />}
                  title="Get people to DM me"
                  description="Drive Instagram or Facebook DMs from people ready to have a conversation"
                  badge="New" />
                
                    <StepOption
                  selected={false}
                  onSelect={() => setSelectedGoal("grow_social")}
                  icon={<Instagram className="h-5 w-5" />}
                  title="Grow my social presence"
                  description="Get more followers, video views, comments, or traffic to my profile" />
                
                    <StepOption
                  selected={false}
                  onSelect={() => setSelectedGoal("local")}
                  icon={<MapPin className="h-5 w-5" />}
                  title="Reach people near my location"
                  description="Local business, event targeting, or regional campaigns" />
                
                  </div>
              }

                {/* Stage B: Contextual Selection based on goal */}

                {/* Offer-based goals: promote_offer, get_leads, book_calls */}
                {(selectedGoal === "promote_offer" || selectedGoal === "get_leads" || selectedGoal === "book_calls") && !showSocialGrowthFlow &&
              <div className="space-y-3">
                    {offers.length > 0 ?
                <>
                        <p className="text-sm text-muted-foreground italic">
                          {selectedGoal === "promote_offer" && "Which offer are you promoting?"}
                          {selectedGoal === "get_leads" && "Which lead magnet or freebie?"}
                          {selectedGoal === "book_calls" && "Which offer are discovery calls for?"}
                        </p>
                        {offers.map((offer) =>
                  <StepOption
                    key={offer.id}
                    selected={selectedOfferId === offer.id}
                    onSelect={() => setSelectedOfferId(offer.id)}
                    icon={<Package className="h-5 w-5" />}
                    title={offer.name}
                    description={offer.price_point || offer.url || "No details added"} />

                  )}
                        <div className="pt-2">
                          <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowOfferDialog(true)}>
                      
                            <Plus className="h-4 w-4 mr-2" />
                            Add a new offer
                          </Button>
                        </div>
                      </> :

                <Card className="border-dashed">
                        <CardContent className="p-6 text-center space-y-4">
                          <Package className="h-12 w-12 mx-auto text-muted-foreground" />
                          <div>
                            <p className="font-semibold text-lg">First, let's set up your offer</p>
                            <p className="text-sm text-muted-foreground mt-2">
                              An "offer" in LUMI is anything you want to promote — your webinar, your freebie, your coaching program, your course. LUMI uses your offer details to build a campaign that actually sells it.
                            </p>
                          </div>
                          <Button
                      variant="lumi"
                      onClick={() => setShowOfferDialog(true)}>
                      
                            <Plus className="h-4 w-4 mr-2" />
                            Set Up My First Offer
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Takes about 2 minutes. You only need to do this once per offer.
                          </p>
                        </CardContent>
                      </Card>
                }
                  </div>
              }

                {/* Social growth goal */}
                {selectedGoal === "grow_social" &&
              <>
                    {showSocialGrowthFlow ?
                <SocialGrowthFlow
                  brandId={brand.id}
                  brandName={brand.name}
                  instagramAccountId={brand.instagram_account_id}
                  instagramAccountName={brand.instagram_account_name}
                  audiencePsychology={brand.audience_psychology}
                  fixedObjective={
                  selectedOfferId === COMMENT_DM_OFFER_ID ? "engagement" :
                  selectedOfferId === TRAFFIC_IG_OFFER_ID ? "traffic" :
                  selectedOfferId === VIDEO_VIEWS_OFFER_ID ? "video_views" :
                  undefined
                  }
                  headerText={
                  selectedOfferId === COMMENT_DM_OFFER_ID ? "Pick the posts that drive comments & DMs 💬" :
                  selectedOfferId === TRAFFIC_IG_OFFER_ID ? "Pick posts to drive traffic to your profile 🔗" :
                  selectedOfferId === VIDEO_VIEWS_OFFER_ID ? "Pick your best videos to promote 🎬" :
                  undefined
                  }
                  headerSubtext={
                  selectedOfferId === COMMENT_DM_OFFER_ID ? "Select up to 6 posts with autoresponder triggers. We'll put them in front of a broad audience to maximize conversations." :
                  selectedOfferId === TRAFFIC_IG_OFFER_ID ? "Select up to 6 posts to promote. We'll drive cold traffic to your Instagram profile." :
                  selectedOfferId === VIDEO_VIEWS_OFFER_ID ? "Select up to 6 videos to get more views. We'll optimize for maximum video engagement." :
                  undefined
                  }
                  onComplete={async (data) => {
                    try {
                      setIsCreatingCampaign(true);

                      const isCommentDm = selectedOfferId === COMMENT_DM_OFFER_ID;
                      const isTrafficIg = selectedOfferId === TRAFFIC_IG_OFFER_ID;
                      const isVideoViews = selectedOfferId === VIDEO_VIEWS_OFFER_ID;

                      const templateSlug = isCommentDm ?
                      "comment-dm-engagement" :
                      isVideoViews || data.objective === "video_views" ? "video-views" :
                      "social-traffic";
                      const matchedTemplate = templates.find((t) => t.slug === templateSlug) || templates[0];

                      const campaignName = isCommentDm ?
                      "Increase Comments/DMs" :
                      isTrafficIg ?
                      "Traffic to Instagram" :
                      isVideoViews ?
                      "Video Views Campaign" :
                      `Grow Following - ${data.objective === "video_views" ? "Video Views" : "Traffic to Instagram"}`;

                      const campaignType = isCommentDm ? "comment_dm" : "social_growth";

                      const { data: strategy, error: strategyError } = await supabase.
                      from("strategies").
                      insert({
                        brand_id: brand.id,
                        template_id: matchedTemplate?.id,
                        name: campaignName,
                        campaign_type: campaignType,
                        status: "active"
                      }).
                      select().
                      single();

                      if (strategyError) throw strategyError;

                      const { data: workspace, error: workspaceError } = await supabase.
                      from("campaign_workspaces").
                      insert({
                        brand_id: brand.id,
                        strategy_id: strategy.id,
                        template_id: matchedTemplate?.id,
                        name: campaignName,
                        strategy_json: matchedTemplate?.strategy_template as any,
                        progress_status: "ready_to_build",
                        creative_json: {
                          ...(isCommentDm ? { commentDmCampaign: true } : { socialGrowth: true }),
                          objective: data.objective,
                          selectedPosts: data.selectedPosts.map((p) => ({
                            id: p.id,
                            media_url: p.media_url,
                            thumbnail_url: p.thumbnail_url,
                            media_type: p.media_type,
                            permalink: p.permalink,
                            caption: p.caption
                          }))
                        } as any
                      }).
                      select().
                      single();

                      if (workspaceError) throw workspaceError;

                      clearSavedProgress();
                      toast.success(isCommentDm ?
                      "Posts selected! Let's build your engagement campaign." :
                      "Posts selected! Let's build your campaign.");
                      navigate(`/campaigns/build?workspace=${workspace.id}`);
                    } catch (error: any) {
                      console.error("Error creating workspace:", error);
                      toast.error(error.message || "Failed to create campaign");
                    } finally {
                      setIsCreatingCampaign(false);
                    }
                  }}
                  onConnectInstagram={() => navigate("/settings/meta?returnTo=/create&socialGrowth=true")}
                  onBack={() => {
                    setShowSocialGrowthFlow(false);
                    setSelectedOfferId("");
                  }} /> :


                <div className="space-y-3">
                        <StepOption
                    selected={selectedOfferId === SOCIAL_GROWTH_OFFER_ID}
                    onSelect={() => {
                      setSelectedOfferId(SOCIAL_GROWTH_OFFER_ID);
                      setShowSocialGrowthFlow(true);
                    }}
                    icon={<Instagram className="h-5 w-5" />}
                    title="Grow my Instagram following"
                    description="Get more followers with strategic content promotion"
                    badge="Popular" />
                  
                        <StepOption
                    selected={selectedOfferId === COMMENT_DM_OFFER_ID}
                    onSelect={() => {
                      setSelectedOfferId(COMMENT_DM_OFFER_ID);
                      setShowSocialGrowthFlow(true);
                    }}
                    icon={<MessageCircle className="h-5 w-5" />}
                    title="Increase Comments/DMs"
                    description="Drive comments and DMs using your existing posts + autoresponder"
                    badge="ManyChat" />
                  
                        








                  
                        







                  
                  
                      </div>
                }
                  </>
              }

                {/* DM Leads goal */}
                {selectedGoal === "dm_leads" &&
              <div className="space-y-4">
                    <p className="text-sm text-muted-foreground italic">Where do you want people to message you?</p>
                    <StepOption
                  selected={dmConversionLocation === "instagram"}
                  onSelect={() => setDmConversionLocation("instagram")}
                  icon={<Instagram className="h-5 w-5" />}
                  title="Instagram DMs"
                  description="People will message you on Instagram" />
                
                    <StepOption
                  selected={dmConversionLocation === "facebook"}
                  onSelect={() => setDmConversionLocation("facebook")}
                  icon={<MessageCircle className="h-5 w-5" />}
                  title="Facebook Messenger"
                  description="People will message you on Facebook" />
                
                    {dmConversionLocation && <>
                      <div className="border-t pt-4 mt-2">
                        <p className="text-sm text-muted-foreground italic mb-3">How do you want to create your ads?</p>
                        <div className="space-y-3">
                          <StepOption
                            selected={dmContentChoice === "existing_posts"}
                            onSelect={() => {
                              setDmContentChoice("existing_posts");
                              setSelectedOfferId(DM_LEADS_OFFER_ID);
                              setShowSocialGrowthFlow(true);
                            }}
                            icon={<Image className="h-5 w-5" />}
                            title="Use my existing posts"
                            description="Pick Instagram posts to promote as DM ads" />
                          
                          <StepOption
                            selected={dmContentChoice === "creative_studio"}
                            onSelect={async () => {
                              setDmContentChoice("creative_studio");
                              setSelectedOfferId(DM_LEADS_OFFER_ID);
                              // Go to creative studio flow — match template + generate angles
                              const matched = templates.find((t) => t.slug === "dm-leads");
                              if (matched) {
                                setSelectedTemplateId(matched.id);
                                setRecommendedTemplate(matched);
                                setCurrentStep(2);
                              }
                            }}
                            icon={<Wand2 className="h-5 w-5" />}
                            title="Create new ads with Creative Studio"
                            description="Generate DM-focused scripts, copy, and creative direction" />
                        </div>
                      </div>
                    </>}

                    {/* Show SocialGrowthFlow when existing posts chosen */}
                    {showSocialGrowthFlow && dmContentChoice === "existing_posts" &&
                      <SocialGrowthFlow
                        brandId={brand.id}
                        brandName={brand.name}
                        instagramAccountId={brand.instagram_account_id}
                        instagramAccountName={brand.instagram_account_name}
                        audiencePsychology={brand.audience_psychology}
                        fixedObjective="engagement"
                        headerText="Pick the posts you want to drive DMs from 💬"
                        headerSubtext="Select up to 6 posts. We'll put them in front of people most likely to message you."
                        onComplete={async (data) => {
                          try {
                            setIsCreatingCampaign(true);
                            const matchedTemplate = templates.find((t) => t.slug === "dm-leads") || templates[0];
                            const campaignName = `DM Leads - ${dmConversionLocation === "instagram" ? "Instagram" : "Facebook Messenger"}`;

                            const { data: strategy, error: strategyError } = await supabase
                              .from("strategies")
                              .insert({
                                brand_id: brand.id,
                                template_id: matchedTemplate?.id,
                                name: campaignName,
                                campaign_type: "dm_leads",
                                status: "active"
                              })
                              .select()
                              .single();
                            if (strategyError) throw strategyError;

                            const { data: workspace, error: workspaceError } = await supabase
                              .from("campaign_workspaces")
                              .insert({
                                brand_id: brand.id,
                                strategy_id: strategy.id,
                                template_id: matchedTemplate?.id,
                                name: campaignName,
                                strategy_json: { ...matchedTemplate?.strategy_template, conversionLocation: dmConversionLocation } as any,
                                progress_status: "ready_to_build",
                                creative_json: {
                                  dmLeadsCampaign: true,
                                  conversionLocation: dmConversionLocation,
                                  objective: "leads",
                                  selectedPosts: data.selectedPosts.map((p) => ({
                                    id: p.id,
                                    media_url: p.media_url,
                                    thumbnail_url: p.thumbnail_url,
                                    media_type: p.media_type,
                                    permalink: p.permalink,
                                    caption: p.caption
                                  }))
                                } as any
                              })
                              .select()
                              .single();
                            if (workspaceError) throw workspaceError;

                            clearSavedProgress();
                            toast.success("Posts selected! Let's build your DM campaign.");
                            navigate(`/campaigns/build?workspace=${workspace.id}`);
                          } catch (error: any) {
                            console.error("Error creating workspace:", error);
                            toast.error(error.message || "Failed to create campaign");
                          } finally {
                            setIsCreatingCampaign(false);
                          }
                        }}
                        onConnectInstagram={() => navigate("/settings/meta?returnTo=/create")}
                        onBack={() => {
                          setShowSocialGrowthFlow(false);
                          setDmContentChoice("");
                        }}
                      />
                    }
                  </div>
              }

                {/* Local goal */}
                {selectedGoal === "local" &&
              <div className="space-y-3">
                    <StepOption
                  selected={selectedOfferId === EVENT_LOCATION_OFFER_ID}
                  onSelect={() => {
                    setSelectedOfferId(EVENT_LOCATION_OFFER_ID);
                    setShowSocialGrowthFlow(false);
                    const matched = templates.find((t) => t.slug === "event-location");
                    if (matched) {
                      setSelectedTemplateId(matched.id);
                      setRecommendedTemplate(matched);
                    }
                    setCurrentStep(2);
                  }}
                  icon={<MapPin className="h-5 w-5" />}
                  title="Event & Location Targeting"
                  description="Get in front of people at conferences, trade shows, or high-traffic locations" />
                
                    <StepOption
                  selected={selectedOfferId === LOCAL_NEARBY_OFFER_ID}
                  onSelect={() => {
                    setSelectedOfferId(LOCAL_NEARBY_OFFER_ID);
                    setShowSocialGrowthFlow(false);
                    const matched = templates.find((t) => t.slug === "local-nearby");
                    if (matched) {
                      setSelectedTemplateId(matched.id);
                      setRecommendedTemplate(matched);
                    }
                    setCurrentStep(2);
                  }}
                  icon={<MapPin className="h-5 w-5" />}
                  title="Local Business — Nearby"
                  description="Attract nearby customers to your storefront or location" />
                
                    <StepOption
                  selected={selectedOfferId === LOCAL_REGIONAL_OFFER_ID}
                  onSelect={() => {
                    setSelectedOfferId(LOCAL_REGIONAL_OFFER_ID);
                    setShowSocialGrowthFlow(false);
                    const matched = templates.find((t) => t.slug === "local-regional");
                    if (matched) {
                      setSelectedTemplateId(matched.id);
                      setRecommendedTemplate(matched);
                    }
                    setCurrentStep(2);
                  }}
                  icon={<MapPin className="h-5 w-5" />}
                  title="Local Business — Regional"
                  description="Reach customers across your service area" />
                
                  </div>
              }
              </motion.div>
            }

            {/* Step 2: Strategy Recommendation */}
            {currentStep === 2 &&
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4">
              
                {/* Lumi recommendation card */}
                <Card className="border-2 border-primary bg-primary/5 overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <img
                        src={lumiLogo}
                        alt="Lumi"
                        className="h-10 w-10 rounded-full" />
                      
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">Lumi recommends:</span>
                          <Badge variant="secondary" className="bg-lumi-pink-1/20 text-lumi-pink-1">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Best fit
                          </Badge>
                        </div>
                        {recommendedTemplate &&
                      <>
                            <h3 className="text-lg font-bold mb-1">
                              {recommendedTemplate.name}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-3">
                              {recommendedTemplate.description}
                            </p>
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline">{recommendedTemplate.objective}</Badge>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground">{recommendedTemplate.use_case}</span>
                            </div>
                          </>
                      }
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Event strategy education card */}
                {selectedOfferId === EVENT_LOCATION_OFFER_ID &&
              <LumiEducationCard
                cardId="event-location-strategy"
                headline="How Event Targeting Works (2 Phases)"
                body="Phase 1: Run awareness ads at the event location to get people interacting with your content. Phase 2: Later, retarget those people with your offer ads (lead magnet or purchase). Make sure you also have an offer campaign set up so you can retarget these warm leads!" />

              }

                {/* Campaign structure collapsible */}
                {(() => {
                const template = templates.find((t) => t.id === selectedTemplateId);
                return template ?
                <div className="pt-1">
                      <details className="group">
                        <summary className="flex items-center justify-between cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                          <span>See campaign structure</span>
                          <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                        </summary>
                        <div className="mt-3 p-4 rounded-lg bg-muted/50 border border-border space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                              Structure
                            </Label>
                            <p className="text-sm mt-1">{template.campaign_structure}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                              Best For
                            </Label>
                            <p className="text-sm mt-1">{template.use_case}</p>
                          </div>
                        </div>
                      </details>
                    </div> :
                null;
              })()}

                {/* Override option */}
                <div className="pt-2">
                  <details className="group">
                    <summary className="flex items-center justify-between cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <span>See all strategies (advanced)</span>
                      <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="mt-4 space-y-2">
                      {templates.filter((t) => t.id !== recommendedTemplate?.id).map((template) =>
                    <StepOption
                      key={template.id}
                      selected={selectedTemplateId === template.id}
                      onSelect={() => setSelectedTemplateId(template.id)}
                      icon={<Target className="h-5 w-5" />}
                      title={template.name}
                      description={template.description}
                      badge={template.objective} />

                    )}
                    </div>
                  </details>
                </div>

                {/* What happens next */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-lumi-orange-1 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">What happens next?</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Lumi will generate psychology-driven creative angles tailored to your offer, 
                        then help you pick the perfect template to bring it to life.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Advanced Build Option */}
                <div className="pt-2">
                  <details className="group">
                    <summary className="flex items-center justify-between cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <span>Already have finished creative?</span>
                      <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="mt-3">
                      <Button
                      variant="outline"
                      className="w-full"
                      disabled={isGeneratingAngles || isCreatingCampaign}
                      onClick={async () => {
                        if (!selectedOfferId || !selectedTemplateId) {
                          toast.error("Please select an offer and strategy first");
                          return;
                        }
                        setIsCreatingCampaign(true);
                        try {
                          const selectedOffer = offers.find((o) => o.id === selectedOfferId);
                          const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
                          if (!selectedOffer || !selectedTemplate) throw new Error("Missing selection");

                          const { data: strategy, error: sErr } = await supabase.
                          from("strategies").
                          insert({
                            brand_id: brand.id,
                            template_id: selectedTemplate.id,
                            name: `Advanced Build - ${selectedOffer.name}`,
                            campaign_type: selectedTemplate.strategy_template?.campaign_type || "cold",
                            status: "active",
                            offer_name: selectedOffer.name,
                            offer_url: selectedOffer.url,
                            offer_price: selectedOffer.price_point,
                            offer_description: selectedOffer.description
                          }).
                          select().
                          single();
                          if (sErr) throw sErr;

                          const { data: ws, error: wErr } = await supabase.
                          from("campaign_workspaces").
                          insert([{
                            brand_id: brand.id,
                            strategy_id: strategy.id,
                            template_id: selectedTemplate.id,
                            name: `Advanced Build - ${selectedOffer.name}`,
                            strategy_json: selectedTemplate.strategy_template as any,
                            progress_status: "draft",
                            offer_id: selectedOffer.id,
                            offer_name: selectedOffer.name,
                            offer_url: selectedOffer.url,
                            offer_price: selectedOffer.price_point,
                            offer_description: selectedOffer.description,
                            campaign_builder_answers: { advancedBuild: true } as any
                          }]).
                          select().
                          single();
                          if (wErr) throw wErr;

                          clearSavedProgress();
                          navigate(`/advanced-build?workspace=${ws.id}`);
                        } catch (err: any) {
                          console.error(err);
                          toast.error(err.message || "Failed to create workspace");
                        } finally {
                          setIsCreatingCampaign(false);
                        }
                      }}>
                      
                        <Upload className="h-4 w-4 mr-2" />
                        Advanced Build — Upload & Go
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        Upload your own videos/images and Lumi will write the copy.
                      </p>
                    </div>
                  </details>
                </div>
              </motion.div>
            }

            {/* Step 4: Creative Angle */}
            {currentStep === 4 &&
            <motion.div
              key="step-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4">
              
                {isGeneratingAngles ?
              <div className="text-center py-12">
                    <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                      <Wand2 className="h-6 w-6 text-primary animate-pulse" />
                    </div>
                    <p className="font-medium">Generating creative angles...</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Lumi is analyzing your offer and audience psychology
                    </p>
                  </div> :
              generatedAngles.length > 0 ?
              <>
                    {/* Recommended angle */}
                    <Card className="border-2 border-primary bg-primary/5 overflow-hidden">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <img
                          src={lumiLogo}
                          alt="Lumi"
                          className="h-10 w-10 rounded-full" />
                        
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold">Start with this angle:</span>
                              <Badge variant="secondary" className="bg-lumi-pink-1/20 text-lumi-pink-1">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Highest potential
                              </Badge>
                            </div>
                            <h3 className="text-lg font-bold mb-1">
                              {generatedAngles[0]?.name}
                            </h3>
                            <p className="text-sm font-medium text-primary mb-2">
                              "{generatedAngles[0]?.hook}"
                            </p>
                            <p className="text-sm text-muted-foreground mb-3">
                              {generatedAngles[0]?.description}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              🧠 {generatedAngles[0]?.psychologyTrigger}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Why this angle */}
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm">
                        <span className="font-medium">Why this angle? </span>
                        <span className="text-muted-foreground">
                          Based on your audience's psychology profile and offer type, 
                          this angle has the highest probability of capturing attention 
                          and driving action.
                        </span>
                      </p>
                    </div>

                    {/* Override options */}
                    {generatedAngles.length > 1 &&
                <details className="group">
                        <summary className="flex items-center justify-between cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                          <span>Try a different angle</span>
                          <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                        </summary>
                        <div className="mt-4 space-y-2">
                          {generatedAngles.slice(1).map((angle) =>
                    <StepOption
                      key={angle.id}
                      selected={selectedAngle?.id === angle.id}
                      onSelect={() => setSelectedAngle(angle)}
                      icon={<Lightbulb className="h-5 w-5" />}
                      title={angle.name}
                      description={angle.hook}
                      badge={angle.psychologyTrigger} />

                    )}
                        </div>
                      </details>
                }
                  </> :

              <div className="text-center py-8">
                    <p className="text-muted-foreground">No angles generated yet</p>
                  </div>
              }
              </motion.div>
            }

            {/* Step 5: Creative Templates */}
            {currentStep === 5 &&
            <motion.div
              key="step-5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4">
              
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Each template links to a Canva design you can customize
                </p>

                {CREATIVE_TEMPLATES.map((template) =>
              <div
                key={template.id}
                onClick={() => {
                  setSelectedCreativeTemplates((prev) =>
                  prev.includes(template.id) ?
                  prev.filter((id) => id !== template.id) :
                  [...prev, template.id]
                  );
                }}
                className={cn(
                  "p-4 rounded-xl border-2 cursor-pointer transition-all",
                  selectedCreativeTemplates.includes(template.id) ?
                  "border-primary bg-primary/5" :
                  "border-border hover:border-primary/50"
                )}>
                
                    <div className="flex items-start gap-4">
                      <div className={cn(
                    "flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center",
                    template.type === "video" ? "bg-blue-500/10 text-blue-500" :
                    template.type === "graphic" ? "bg-green-500/10 text-green-500" :
                    "bg-purple-500/10 text-purple-500"
                  )}>
                        {template.type === "video" ? <Video className="h-6 w-6" /> :
                    template.type === "graphic" ? <Image className="h-6 w-6" /> :
                    <Layers className="h-6 w-6" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{template.name}</h4>
                          <Badge variant="outline" className="text-xs capitalize">
                            {template.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.description}
                        </p>
                        <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-8 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(template.canvaUrl, "_blank");
                      }}>
                      
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open in Canva
                        </Button>
                      </div>
                      <div className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center",
                    selectedCreativeTemplates.includes(template.id) ?
                    "border-primary bg-primary" :
                    "border-muted-foreground/30"
                  )}>
                        {selectedCreativeTemplates.includes(template.id) &&
                    <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                    }
                      </div>
                    </div>
                  </div>
              )}

                <div className="p-4 rounded-lg bg-muted/50 border border-border mt-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-lumi-pink-1 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      Select 1-3 templates to get started. You can always add more later!
                    </p>
                  </div>
                </div>
              </motion.div>
            }
          </AnimatePresence>
        </MobileStepWizard>
        }
      </div>

      {/* Offer Dialog */}
      <OfferDialog
        open={showOfferDialog}
        onOpenChange={setShowOfferDialog}
        brandId={brand?.id || ""}
        onSuccess={handleOfferCreated} />
      
    </DashboardLayout>);

}