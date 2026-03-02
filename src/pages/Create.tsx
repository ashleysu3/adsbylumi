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
  Upload
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import lumiLogo from "@/assets/lumi-logo.png";
import { SocialGrowthFlow } from "@/components/SocialGrowthFlow";

// System offer IDs
const SOCIAL_GROWTH_OFFER_ID = "system-social-growth";
const COMMENT_DM_OFFER_ID = "system-comment-dm";

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
    thumbnail: "https://marketplace.canva.com/EAFaQMYuZbo/1/0/1600w/canva-white-elegant-simple-quote-instagram-story-u_dMvlfrVxU.jpg",
  },
  {
    id: "carousel-1",
    type: "graphic",
    name: "Story Carousel",
    description: "5-slide carousel that tells your transformation story",
    canvaUrl: "https://www.canva.com/design/DAGKpB0mSYQ/edit",
    thumbnail: "https://marketplace.canva.com/EAFXKFIDad4/1/0/1600w/canva-beige-minimalistic-modern-feminine-carousel-instagram-post-jJrNv-0gLJA.jpg",
  },
  {
    id: "broll-1",
    type: "hybrid",
    name: "B-Roll + Voiceover",
    description: "Visual montage with compelling voiceover script",
    canvaUrl: "https://www.canva.com/design/DAGd6JZF3OA/edit",
    thumbnail: "https://marketplace.canva.com/EAFqNrAJGSQ/1/0/1600w/canva-grey-black-white-animated-new-product-launch-countdown-video-7CqGPNaQNsM.jpg",
  },
];

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
  const totalSteps = 3;

  // Data
  const [brand, setBrand] = useState<any>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);

  // Wizard state
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
        savedAt: Date.now(),
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
      const { data: offersData } = await supabase
        .from("offers")
        .select("*")
        .eq("brand_id", brandData.id)
        .eq("archived", false)
        .order("created_at", { ascending: false });

      setOffers(offersData || []);

      // Fetch templates
      const { data: templatesData } = await supabase
        .from("campaign_templates")
        .select("*")
        .eq("active", true)
        .order("sort_order");

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
              (offersData || []).some(o => o.id === progress.selectedOfferId);
            
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
      const offer = offers.find(o => o.id === selectedOfferId);
      if (offer?.recommended_template_id) {
        const template = templates.find(t => t.id === offer.recommended_template_id);
        if (template) {
          setRecommendedTemplate(template);
          setSelectedTemplateId(template.id);
        }
      } else {
        // Default to first template if no recommendation
        const defaultTemplate = templates.find(t => t.objective === "Sales") || templates[0];
        if (defaultTemplate) {
          setRecommendedTemplate(defaultTemplate);
          setSelectedTemplateId(defaultTemplate.id);
        }
      }
    }
  }, [selectedOfferId, offers, templates]);

  const handleNext = async () => {
    if (currentStep === 3) {
      // After campaign structure, generate angles and go directly to Creative Studio
      await handleGenerateAndNavigate();
      return; // Don't increment step, we're navigating away
    }
    
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  // New function: Generate angles, create workspace, and navigate to Creative Studio
  const handleGenerateAndNavigate = async () => {
    if (!selectedOfferId || !selectedTemplateId) {
      toast.error("Please select an offer and strategy");
      return;
    }

    setIsGeneratingAngles(true);
    try {
      const selectedOffer = offers.find(o => o.id === selectedOfferId);
      const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

      if (!selectedOffer || !selectedTemplate) {
        throw new Error("Missing offer or template selection");
      }

      // Generate creative angles
      const { data: anglesData, error: anglesError } = await supabase.functions.invoke('generate-creative-angles', {
        body: {
          brandName: brand.name,
          strategyData: selectedTemplate?.strategy_template,
          audiencePsychology: brand.audience_psychology,
          offerData: {
            name: selectedOffer?.name,
            description: selectedOffer?.description,
            price: selectedOffer?.price_point,
            product_psychology: selectedOffer?.product_psychology,
          },
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
          psychologyTrigger: "Pain avoidance",
        },
        {
          id: "angle-2", 
          name: "Social Proof",
          hook: "See why [X] people chose this...",
          description: "Leverage testimonials and results to build trust quickly.",
          psychologyTrigger: "Social validation",
        },
        {
          id: "angle-3",
          name: "Curiosity Gap",
          hook: "The one thing most people don't know about...",
          description: "Create intrigue that compels the viewer to learn more.",
          psychologyTrigger: "Curiosity",
        },
      ];

      // Create strategy
      const strategyInsert = {
        brand_id: brand.id,
        template_id: selectedTemplate.id,
        name: `${selectedTemplate.name} - ${selectedOffer.name}`,
        campaign_type: selectedTemplate.strategy_template?.campaign_type || "cold",
        messaging_framework: selectedTemplate.strategy_template?.messaging_framework,
        audience_psychology: selectedTemplate.strategy_template?.audience_psychology,
        optimization_goals: selectedTemplate.strategy_template?.optimization_goals,
        kpi_benchmarks: selectedTemplate.strategy_template?.kpi_benchmarks,
        status: "active",
        offer_name: selectedOffer.name,
        offer_url: selectedOffer.url,
        offer_price: selectedOffer.price_point,
        offer_description: selectedOffer.description,
      };

      const { data: strategy, error: strategyError } = await supabase
        .from("strategies")
        .insert(strategyInsert)
        .select()
        .single();

      if (strategyError) throw strategyError;

      // Create workspace with all angles (user will select in Creative Studio)
      const workspaceInsert = {
        brand_id: brand.id as string,
        strategy_id: strategy.id,
        template_id: selectedTemplate.id,
        name: `${selectedTemplate.name} - ${selectedOffer.name}`,
        strategy_json: selectedTemplate.strategy_template as any,
        progress_status: "creative_in_progress",
        offer_id: selectedOffer.id,
        offer_name: selectedOffer.name,
        offer_url: selectedOffer.url,
        offer_price: selectedOffer.price_point,
        offer_description: selectedOffer.description,
        creative_json: {
          angles: finalAngles.map((a: any) => ({ ...a })),
          selectedAngleIds: [], // Let user select in Creative Studio
          selectedCreativeTemplates: [],
          phase1Flow: true,
        } as any,
      };

      const { data: workspace, error: workspaceError } = await supabase
        .from("campaign_workspaces")
        .insert([workspaceInsert])
        .select()
        .single();

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
      const selectedOffer = offers.find(o => o.id === selectedOfferId);
      const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

      const { data, error } = await supabase.functions.invoke('generate-creative-angles', {
        body: {
          brandName: brand.name,
          strategyData: selectedTemplate?.strategy_template,
          audiencePsychology: brand.audience_psychology,
          offerData: {
            name: selectedOffer?.name,
            description: selectedOffer?.description,
            price: selectedOffer?.price_point,
            product_psychology: selectedOffer?.product_psychology,
          },
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
          psychologyTrigger: "Pain avoidance",
        },
        {
          id: "angle-2", 
          name: "Social Proof",
          hook: "See why [X] people chose this...",
          description: "Leverage testimonials and results to build trust quickly.",
          psychologyTrigger: "Social validation",
        },
        {
          id: "angle-3",
          name: "Curiosity Gap",
          hook: "The one thing most people don't know about...",
          description: "Create intrigue that compels the viewer to learn more.",
          psychologyTrigger: "Curiosity",
        },
      ];
      setGeneratedAngles(fallbackAngles);
      setSelectedAngle(fallbackAngles[0]);
      toast.error("Used fallback angles. Try regenerating later.");
    } finally {
      setIsGeneratingAngles(false);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1: return !!selectedOfferId;
      case 2: return !!selectedTemplateId;
      case 3: return !!selectedTemplateId;
      default: return false;
    }
  };

  const getStepTitle = (): string => {
    switch (currentStep) {
      case 1: return "Choose your offer";
      case 2: return "Recommended strategy";
      case 3: return "Campaign structure";
      default: return "";
    }
  };

  const getStepSubtitle = (): string => {
    switch (currentStep) {
      case 1: return "What are we promoting?";
      case 2: return "Lumi's recommendation based on your offer";
      case 3: return "How we'll structure your campaign";
      default: return "";
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
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        {/* Resume Progress Prompt - Enhanced with preview */}
        <AnimatePresence>
          {showResumePrompt && savedProgress && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4"
            >
              <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10 overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <img 
                          src={lumiLogo} 
                          alt="Lumi" 
                          className="h-8 w-8"
                        />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">Resume where you left off? 👋</p>
                      
                      {/* Progress Preview */}
                      <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex -space-x-1">
                            {Array.from({ length: totalSteps }).map((_, i) => (
                              <div 
                                key={i}
                                className={cn(
                                  "h-2 w-2 rounded-full border border-background",
                                  i < savedProgress.currentStep 
                                    ? "bg-primary" 
                                    : "bg-muted-foreground/30"
                                )}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Step {savedProgress.currentStep} of {totalSteps}
                          </span>
                        </div>
                        
                        {/* Show what was selected */}
                        <div className="space-y-1.5 text-xs">
                          {savedProgress.selectedOfferId && (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              <span className="text-muted-foreground">Offer:</span>
                              <span className="font-medium truncate">
                                {offers.find(o => o.id === savedProgress.selectedOfferId)?.name || "Selected"}
                              </span>
                            </div>
                          )}
                          {savedProgress.selectedTemplateId && (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              <span className="text-muted-foreground">Strategy:</span>
                              <span className="font-medium truncate">
                                {templates.find(t => t.id === savedProgress.selectedTemplateId)?.name || "Selected"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3">
                        <Button 
                          size="sm" 
                          onClick={restoreProgress}
                          className="gap-1.5"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                          Continue
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={clearSavedProgress}
                        >
                          Start fresh
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Entry Step: Choose flow */}
        {currentStep === 0 && (
          <motion.div
            key="step-entry"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 py-8"
          >
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-2xl font-heading font-bold text-foreground">What would you like to do?</h1>
              <p className="text-muted-foreground">Choose how you'd like to get started</p>
            </div>

            <div className="grid gap-4">
              {/* New Campaign */}
              <button
                onClick={() => setCurrentStep(1)}
                className="group text-left w-full"
              >
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
                className="group text-left w-full"
              >
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
        )}

        {currentStep >= 1 && (
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
          nextLabel={currentStep === 3 ? "Generate Angles" : "Continue"}
          saveStatus={saveStatus}
          completeLabel="Create My Ad"
          showBackOnFirstStep={true}
          hideFooter={showSocialGrowthFlow && currentStep === 1}
        >
          <AnimatePresence mode="wait">
            {/* Step 1: Offer Selection */}
            {currentStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Social Growth Flow */}
                {showSocialGrowthFlow ? (
                  (() => { console.log('[SocialGrowthFlow] brand:', brand?.name, 'instagram_account_id:', brand?.instagram_account_id); return null; })() ||
                  <SocialGrowthFlow
                    brandId={brand.id}
                    brandName={brand.name}
                    instagramAccountId={brand.instagram_account_id}
                    instagramAccountName={brand.instagram_account_name}
                    audiencePsychology={brand.audience_psychology}
                    fixedObjective={selectedOfferId === COMMENT_DM_OFFER_ID ? "engagement" : undefined}
                    headerText={selectedOfferId === COMMENT_DM_OFFER_ID ? "Pick the posts that drive comments & DMs 💬" : undefined}
                    headerSubtext={selectedOfferId === COMMENT_DM_OFFER_ID ? "Select up to 6 posts with autoresponder triggers. We'll put them in front of a broad audience to maximize conversations." : undefined}
                    onComplete={async (data) => {
                      try {
                        setIsCreatingCampaign(true);
                        
                        const isCommentDm = selectedOfferId === COMMENT_DM_OFFER_ID;
                        
                        // Find the matching template
                        const templateSlug = isCommentDm 
                          ? "comment-dm-engagement"
                          : data.objective === "video_views" ? "video-views" : "social-traffic";
                        const matchedTemplate = templates.find(t => t.slug === templateSlug) || templates[0];
                        
                        // Create strategy
                        const { data: strategy, error: strategyError } = await supabase
                          .from("strategies")
                          .insert({
                            brand_id: brand.id,
                            template_id: matchedTemplate?.id,
                            name: isCommentDm 
                              ? "Increase Comments/DMs"
                              : `Grow Following - ${data.objective === "video_views" ? "Video Views" : "Traffic to Instagram"}`,
                            campaign_type: isCommentDm ? "comment_dm" : "social_growth",
                            status: "active",
                          })
                          .select()
                          .single();

                        if (strategyError) throw strategyError;

                        // Create workspace with selected posts directly
                        const { data: workspace, error: workspaceError } = await supabase
                          .from("campaign_workspaces")
                          .insert({
                            brand_id: brand.id,
                            strategy_id: strategy.id,
                            template_id: matchedTemplate?.id,
                            name: isCommentDm 
                              ? "Increase Comments/DMs"
                              : `Grow Following - ${data.objective === "video_views" ? "Video Views" : "Traffic"}`,
                            strategy_json: matchedTemplate?.strategy_template as any,
                            progress_status: "ready_to_build",
                            creative_json: {
                              ...(isCommentDm ? { commentDmCampaign: true } : { socialGrowth: true }),
                              objective: data.objective,
                              selectedPosts: data.selectedPosts.map(p => ({
                                id: p.id,
                                media_url: p.media_url,
                                thumbnail_url: p.thumbnail_url,
                                media_type: p.media_type,
                                permalink: p.permalink,
                                caption: p.caption,
                              })),
                            } as any,
                          })
                          .select()
                          .single();

                        if (workspaceError) throw workspaceError;

                        clearSavedProgress();
                        toast.success(isCommentDm 
                          ? "Posts selected! Let's build your engagement campaign." 
                          : "Posts selected! Let's build your campaign.");
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
                    }}
                  />
                ) : offers.length > 0 || true ? (
                  <>
                    {/* System offer: Grow Social Following */}
                    <StepOption
                      selected={selectedOfferId === SOCIAL_GROWTH_OFFER_ID}
                      onSelect={() => {
                        setSelectedOfferId(SOCIAL_GROWTH_OFFER_ID);
                        setShowSocialGrowthFlow(true);
                      }}
                      icon={<Instagram className="h-5 w-5" />}
                      title="Grow my Instagram following"
                      description="Get more followers with strategic content promotion"
                      badge="Popular"
                    />

                    {/* System offer: Increase Comments/DMs */}
                    <StepOption
                      selected={selectedOfferId === COMMENT_DM_OFFER_ID}
                      onSelect={() => {
                        setSelectedOfferId(COMMENT_DM_OFFER_ID);
                        setShowSocialGrowthFlow(true);
                      }}
                      icon={<Users className="h-5 w-5" />}
                      title="Increase Comments/DMs"
                      description="Drive comments and DMs using your existing posts + autoresponder"
                      badge="ManyChat"
                    />
                    
                    {/* Divider */}
                    {offers.length > 0 && (
                      <div className="flex items-center gap-3 py-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground">or promote an offer</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    
                    {/* User's offers */}
                    {offers.map((offer) => (
                      <StepOption
                        key={offer.id}
                        selected={selectedOfferId === offer.id}
                        onSelect={() => setSelectedOfferId(offer.id)}
                        icon={<Package className="h-5 w-5" />}
                        title={offer.name}
                        description={offer.price_point || offer.url || "No details added"}
                      />
                    ))}
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowOfferDialog(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add a new offer
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 space-y-4">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground" />
                    <div>
                      <p className="font-medium">No offers yet</p>
                      <p className="text-sm text-muted-foreground">
                        Create your first offer to start building ads
                      </p>
                    </div>
                    <Button
                      variant="lumi"
                      onClick={() => setShowOfferDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create your first offer
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Strategy Recommendation */}
            {currentStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Lumi recommendation card */}
                <Card className="border-2 border-primary bg-primary/5 overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <img 
                          src={lumiLogo} 
                          alt="Lumi" 
                          className="h-10 w-10 rounded-full"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">Lumi recommends:</span>
                          <Badge variant="secondary" className="bg-lumi-pink-1/20 text-lumi-pink-1">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Best fit
                          </Badge>
                        </div>
                        {recommendedTemplate && (
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
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Override option */}
                <div className="pt-4">
                  <details className="group">
                    <summary className="flex items-center justify-between cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <span>Want to try a different strategy?</span>
                      <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="mt-4 space-y-2">
                      {templates.filter(t => t.id !== recommendedTemplate?.id).map((template) => (
                        <StepOption
                          key={template.id}
                          selected={selectedTemplateId === template.id}
                          onSelect={() => setSelectedTemplateId(template.id)}
                          icon={<Target className="h-5 w-5" />}
                          title={template.name}
                          description={template.description}
                          badge={template.objective}
                        />
                      ))}
                    </div>
                  </details>
                </div>
              </motion.div>
            )}

            {/* Step 3: Campaign Structure Preview */}
            {currentStep === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {(() => {
                  const template = templates.find(t => t.id === selectedTemplateId);
                  return template ? (
                    <>
                      <Card className="border-2 border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Rocket className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{template.name}</CardTitle>
                              <p className="text-sm text-muted-foreground">{template.objective}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                              Campaign Structure
                            </Label>
                            <p className="text-sm mt-1">{template.campaign_structure}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                              Best For
                            </Label>
                            <p className="text-sm mt-1">{template.use_case}</p>
                          </div>
                        </CardContent>
                      </Card>

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
                                  const selectedOffer = offers.find(o => o.id === selectedOfferId);
                                  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
                                  if (!selectedOffer || !selectedTemplate) throw new Error("Missing selection");

                                  const { data: strategy, error: sErr } = await supabase
                                    .from("strategies")
                                    .insert({
                                      brand_id: brand.id,
                                      template_id: selectedTemplate.id,
                                      name: `Advanced Build - ${selectedOffer.name}`,
                                      campaign_type: selectedTemplate.strategy_template?.campaign_type || "cold",
                                      status: "active",
                                      offer_name: selectedOffer.name,
                                      offer_url: selectedOffer.url,
                                      offer_price: selectedOffer.price_point,
                                      offer_description: selectedOffer.description,
                                    })
                                    .select()
                                    .single();
                                  if (sErr) throw sErr;

                                  const { data: ws, error: wErr } = await supabase
                                    .from("campaign_workspaces")
                                    .insert([{
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
                                      campaign_builder_answers: { advancedBuild: true } as any,
                                    }])
                                    .select()
                                    .single();
                                  if (wErr) throw wErr;

                                  clearSavedProgress();
                                  navigate(`/advanced-build?workspace=${ws.id}`);
                                } catch (err: any) {
                                  console.error(err);
                                  toast.error(err.message || "Failed to create workspace");
                                } finally {
                                  setIsCreatingCampaign(false);
                                }
                              }}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Advanced Build — Upload & Go
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2">
                              Upload your own videos/images and Lumi will write the copy.
                            </p>
                          </div>
                        </details>
                      </div>
                    </>
                  ) : null;
                })()}
              </motion.div>
            )}

            {/* Step 4: Creative Angle */}
            {currentStep === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {isGeneratingAngles ? (
                  <div className="text-center py-12">
                    <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                      <Wand2 className="h-6 w-6 text-primary animate-pulse" />
                    </div>
                    <p className="font-medium">Generating creative angles...</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Lumi is analyzing your offer and audience psychology
                    </p>
                  </div>
                ) : generatedAngles.length > 0 ? (
                  <>
                    {/* Recommended angle */}
                    <Card className="border-2 border-primary bg-primary/5 overflow-hidden">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <img 
                              src={lumiLogo} 
                              alt="Lumi" 
                              className="h-10 w-10 rounded-full"
                            />
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
                    {generatedAngles.length > 1 && (
                      <details className="group">
                        <summary className="flex items-center justify-between cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                          <span>Try a different angle</span>
                          <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                        </summary>
                        <div className="mt-4 space-y-2">
                          {generatedAngles.slice(1).map((angle) => (
                            <StepOption
                              key={angle.id}
                              selected={selectedAngle?.id === angle.id}
                              onSelect={() => setSelectedAngle(angle)}
                              icon={<Lightbulb className="h-5 w-5" />}
                              title={angle.name}
                              description={angle.hook}
                              badge={angle.psychologyTrigger}
                            />
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No angles generated yet</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 5: Creative Templates */}
            {currentStep === 5 && (
              <motion.div
                key="step-5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Each template links to a Canva design you can customize
                </p>

                {CREATIVE_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => {
                      setSelectedCreativeTemplates(prev => 
                        prev.includes(template.id) 
                          ? prev.filter(id => id !== template.id)
                          : [...prev, template.id]
                      );
                    }}
                    className={cn(
                      "p-4 rounded-xl border-2 cursor-pointer transition-all",
                      selectedCreativeTemplates.includes(template.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
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
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open in Canva
                        </Button>
                      </div>
                      <div className={cn(
                        "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center",
                        selectedCreativeTemplates.includes(template.id)
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30"
                      )}>
                        {selectedCreativeTemplates.includes(template.id) && (
                          <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="p-4 rounded-lg bg-muted/50 border border-border mt-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-lumi-pink-1 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      Select 1-3 templates to get started. You can always add more later!
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </MobileStepWizard>
        )}
      </div>

      {/* Offer Dialog */}
      <OfferDialog
        open={showOfferDialog}
        onOpenChange={setShowOfferDialog}
        brandId={brand?.id || ""}
        onSuccess={handleOfferCreated}
      />
    </DashboardLayout>
  );
}
