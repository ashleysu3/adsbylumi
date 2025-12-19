import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MobileStepWizard, StepOption } from "@/components/MobileStepWizard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Target, 
  TrendingUp, 
  FileText, 
  Plus,
  ShoppingCart,
  Gift,
  MousePointer,
  Video,
  Users,
  Zap,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

interface MobilePlanningWizardProps {
  brand: any;
  templates: any[];
  offers: any[];
  onCreateOffer: () => void;
  onOfferCreated: () => void;
}

const GOAL_OPTIONS = [
  { 
    id: "offer", 
    title: "Going to an offer", 
    description: "Drive traffic to a product or service", 
    icon: <Target className="h-5 w-5" /> 
  },
  { 
    id: "business_problem", 
    title: "Solving a business problem", 
    description: "Build awareness, trust, or grow audience", 
    icon: <TrendingUp className="h-5 w-5" /> 
  },
];

const ACTION_OPTIONS = [
  { 
    id: "purchase", 
    title: "Make a purchase", 
    description: "Buy your product or service",
    icon: <ShoppingCart className="h-5 w-5" />,
    templateSlugs: ["low-ticket-product-sales", "high-ticket-sales"]
  },
  { 
    id: "free_resource", 
    title: "Get a free resource", 
    description: "Download, sign up, or opt-in",
    icon: <Gift className="h-5 w-5" />,
    templateSlugs: ["free-resource-leads"]
  },
  { 
    id: "visit_page", 
    title: "Visit a page", 
    description: "Learn more or browse content",
    icon: <MousePointer className="h-5 w-5" />,
    templateSlugs: ["traffic-page-visit", "traffic-instagram-facebook"]
  },
];

const PROBLEM_OPTIONS = [
  { 
    id: "video_trust", 
    title: "Build trust with video", 
    description: "Get people to watch and engage",
    icon: <Video className="h-5 w-5" />,
    templateSlugs: ["video-trust-builder"]
  },
  { 
    id: "social_growth", 
    title: "Grow social following", 
    description: "Build your audience on social",
    icon: <Users className="h-5 w-5" />,
    templateSlugs: ["traffic-instagram-facebook"]
  },
];

export function MobilePlanningWizard({
  brand,
  templates,
  offers,
  onCreateOffer,
  onOfferCreated,
}: MobilePlanningWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [totalSteps, setTotalSteps] = useState(4);

  // Wizard state
  const [campaignGoal, setCampaignGoal] = useState<string>("");
  const [offerExists, setOfferExists] = useState<string>("");
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");
  const [offerAction, setOfferAction] = useState<string>("");
  const [businessProblem, setBusinessProblem] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Update total steps based on path
  useEffect(() => {
    if (campaignGoal === "offer") {
      setTotalSteps(5); // Goal → Offer exists? → Select offer → Action → Template
    } else if (campaignGoal === "business_problem") {
      setTotalSteps(3); // Goal → Problem → Template
    } else {
      setTotalSteps(4);
    }
  }, [campaignGoal]);

  // Get matching templates based on selection
  const getMatchingTemplates = (): any[] => {
    let slugs: string[] = [];
    
    if (campaignGoal === "offer" && offerAction) {
      const action = ACTION_OPTIONS.find(a => a.id === offerAction);
      slugs = action?.templateSlugs || [];
    } else if (campaignGoal === "business_problem" && businessProblem) {
      const problem = PROBLEM_OPTIONS.find(p => p.id === businessProblem);
      slugs = problem?.templateSlugs || [];
    }
    
    return templates.filter(t => slugs.includes(t.slug));
  };

  const handleNext = () => {
    if (step < totalSteps) {
      // Handle path-specific navigation
      if (campaignGoal === "offer") {
        if (step === 2 && offerExists === "no") {
          onCreateOffer();
          return;
        }
      }
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    if (!selectedTemplate) {
      toast.error("Please select a template");
      return;
    }

    setLoading(true);
    try {
      const selectedOffer = offers.find(o => o.id === selectedOfferId);

      // Create strategy
      const strategyData = {
        brand_id: brand.id,
        template_id: selectedTemplate.id,
        name: selectedTemplate.name,
        campaign_type: selectedTemplate.strategy_template.campaign_type,
        messaging_framework: selectedTemplate.strategy_template.messaging_framework,
        audience_psychology: selectedTemplate.strategy_template.audience_psychology,
        optimization_goals: selectedTemplate.strategy_template.optimization_goals,
        kpi_benchmarks: selectedTemplate.strategy_template.kpi_benchmarks,
        contextual_keywords: [],
        status: "active",
        offer_name: selectedOffer?.name || null,
        offer_url: selectedOffer?.url || null,
        offer_price: selectedOffer?.price_point || null,
        offer_description: selectedOffer?.description || null,
      };

      const { data: newStrategy, error: strategyError } = await supabase
        .from("strategies")
        .insert(strategyData)
        .select()
        .single();

      if (strategyError) throw strategyError;

      // Create workspace
      const workspaceData = {
        brand_id: brand.id,
        template_id: selectedTemplate.id,
        strategy_id: newStrategy.id,
        name: selectedOffer 
          ? `${selectedTemplate.name} - ${selectedOffer.name}` 
          : selectedTemplate.name,
        strategy_json: selectedTemplate.strategy_template,
        progress_status: "creative_in_progress",
        offer_name: selectedOffer?.name || null,
        offer_url: selectedOffer?.url || null,
        offer_price: selectedOffer?.price_point || null,
        offer_description: selectedOffer?.description || null,
      };

      const { data: newWorkspace, error: workspaceError } = await supabase
        .from("campaign_workspaces")
        .insert(workspaceData)
        .select()
        .single();

      if (workspaceError) throw workspaceError;

      toast.success("Campaign created!");
      navigate(`/creative?workspace=${newWorkspace.id}`);
    } catch (error: any) {
      console.error("Error creating workspace:", error);
      toast.error(error.message || "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = (): boolean => {
    if (campaignGoal === "offer") {
      switch (step) {
        case 1: return !!campaignGoal;
        case 2: return !!offerExists;
        case 3: return !!selectedOfferId;
        case 4: return !!offerAction;
        case 5: return !!selectedTemplateId;
        default: return true;
      }
    } else if (campaignGoal === "business_problem") {
      switch (step) {
        case 1: return !!campaignGoal;
        case 2: return !!businessProblem;
        case 3: return !!selectedTemplateId;
        default: return true;
      }
    }
    return !!campaignGoal;
  };

  const getStepTitle = (): string => {
    if (campaignGoal === "offer") {
      switch (step) {
        case 1: return "What's your goal?";
        case 2: return "Does this offer exist?";
        case 3: return "Select your offer";
        case 4: return "What should people do?";
        case 5: return "Choose your template";
        default: return "";
      }
    } else if (campaignGoal === "business_problem") {
      switch (step) {
        case 1: return "What's your goal?";
        case 2: return "What problem are you solving?";
        case 3: return "Choose your template";
        default: return "";
      }
    }
    return "What's your goal?";
  };

  const getStepSubtitle = (): string => {
    if (campaignGoal === "offer") {
      switch (step) {
        case 1: return "Pick the main objective for this campaign";
        case 2: return "We'll link it to your ad";
        case 3: return "Choose which offer to promote";
        case 4: return "What action do you want?";
        case 5: return "Lumi recommends the best fit";
        default: return "";
      }
    } else if (campaignGoal === "business_problem") {
      switch (step) {
        case 1: return "Pick the main objective for this campaign";
        case 2: return "What are you trying to achieve?";
        case 3: return "Lumi recommends the best fit";
        default: return "";
      }
    }
    return "Pick the main objective for this campaign";
  };

  const matchingTemplates = getMatchingTemplates();

  return (
    <MobileStepWizard
      currentStep={step}
      totalSteps={totalSteps}
      title={getStepTitle()}
      subtitle={getStepSubtitle()}
      onBack={handleBack}
      onNext={handleNext}
      onComplete={handleComplete}
      canProceed={canProceed()}
      isLoading={loading}
      nextLabel="Continue"
      completeLabel="Create Campaign"
    >
      {/* Step 1: Campaign Goal */}
      {step === 1 && (
        <div className="space-y-3">
          {GOAL_OPTIONS.map((goal) => (
            <StepOption
              key={goal.id}
              selected={campaignGoal === goal.id}
              onSelect={() => {
                setCampaignGoal(goal.id);
                // Reset downstream selections
                setOfferExists("");
                setSelectedOfferId("");
                setOfferAction("");
                setBusinessProblem("");
                setSelectedTemplateId("");
              }}
              icon={goal.icon}
              title={goal.title}
              description={goal.description}
            />
          ))}
        </div>
      )}

      {/* Offer Path - Step 2: Does offer exist? */}
      {campaignGoal === "offer" && step === 2 && (
        <div className="space-y-3">
          <StepOption
            selected={offerExists === "yes"}
            onSelect={() => setOfferExists("yes")}
            icon={<FileText className="h-5 w-5" />}
            title="Yes, it exists"
            description="Select from your offers"
          />
          <StepOption
            selected={offerExists === "no"}
            onSelect={() => setOfferExists("no")}
            icon={<Plus className="h-5 w-5" />}
            title="No, create new"
            description="Add a new offer first"
          />
        </div>
      )}

      {/* Offer Path - Step 3: Select offer */}
      {campaignGoal === "offer" && step === 3 && (
        <div className="space-y-3">
          {offers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No offers found</p>
              <Button variant="lumi" onClick={onCreateOffer}>
                <Plus className="h-4 w-4 mr-2" />
                Create Offer
              </Button>
            </div>
          ) : (
            offers.map((offer) => (
              <StepOption
                key={offer.id}
                selected={selectedOfferId === offer.id}
                onSelect={() => setSelectedOfferId(offer.id)}
                title={offer.name}
                description={offer.price_point || offer.url || "No details"}
              />
            ))
          )}
        </div>
      )}

      {/* Offer Path - Step 4: What action? */}
      {campaignGoal === "offer" && step === 4 && (
        <div className="space-y-3">
          {ACTION_OPTIONS.map((action) => (
            <StepOption
              key={action.id}
              selected={offerAction === action.id}
              onSelect={() => {
                setOfferAction(action.id);
                setSelectedTemplateId("");
              }}
              icon={action.icon}
              title={action.title}
              description={action.description}
            />
          ))}
        </div>
      )}

      {/* Business Problem Path - Step 2: What problem? */}
      {campaignGoal === "business_problem" && step === 2 && (
        <div className="space-y-3">
          {PROBLEM_OPTIONS.map((problem) => (
            <StepOption
              key={problem.id}
              selected={businessProblem === problem.id}
              onSelect={() => {
                setBusinessProblem(problem.id);
                setSelectedTemplateId("");
              }}
              icon={problem.icon}
              title={problem.title}
              description={problem.description}
            />
          ))}
        </div>
      )}

      {/* Template Selection (final step for both paths) */}
      {((campaignGoal === "offer" && step === 5) || 
        (campaignGoal === "business_problem" && step === 3)) && (
        <div className="space-y-3">
          {matchingTemplates.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No templates match your selection</p>
            </div>
          ) : (
            matchingTemplates.map((template, index) => (
              <StepOption
                key={template.id}
                selected={selectedTemplateId === template.id}
                onSelect={() => setSelectedTemplateId(template.id)}
                title={template.name}
                description={template.description}
                recommended={index === 0}
              />
            ))
          )}
        </div>
      )}
    </MobileStepWizard>
  );
}
