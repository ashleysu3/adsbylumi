import { useState, useEffect } from "react";
import { MobileStepWizard, StepOption, StepSlider } from "@/components/MobileStepWizard";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Target, 
  Users, 
  DollarSign, 
  Zap,
  Video,
  Image as ImageIcon,
  Layers,
  Play,
  Pause,
  Instagram,
  ShieldCheck,
  ChevronDown,
  Settings2
} from "lucide-react";

interface MobileCampaignBuilderProps {
  workspace: any;
  answers: any;
  onAnswerUpdate: (answers: any) => void;
  onComplete: () => void;
}

const OBJECTIVES = [
  { id: "sales", title: "Sales", description: "Get people to buy your product or service", icon: <DollarSign className="h-5 w-5" /> },
  { id: "leads", title: "Leads", description: "Collect contact info from interested people", icon: <Users className="h-5 w-5" />, recommended: true },
  { id: "traffic", title: "Traffic", description: "Drive visitors to your website", icon: <Target className="h-5 w-5" /> },
  { id: "awareness", title: "Awareness", description: "Get your brand in front of new people", icon: <Zap className="h-5 w-5" /> },
];

const CREATIVE_TYPES = [
  { id: "video", title: "Video", description: "Best for storytelling and engagement", icon: <Video className="h-5 w-5" />, recommended: true },
  { id: "image", title: "Static Image", description: "Quick to create, great for promotions", icon: <ImageIcon className="h-5 w-5" /> },
  { id: "carousel", title: "Carousel", description: "Show multiple images or products", icon: <Layers className="h-5 w-5" /> },
];

const AUDIENCES = [
  { id: "broad", title: "Broad (Recommended)", description: "Let Meta find your best customers", recommended: true },
  { id: "lookalike", title: "Lookalike", description: "People similar to your existing customers" },
  { id: "retargeting", title: "Retargeting", description: "People who already know your brand" },
];

const BUDGET_PRESETS = [
  { value: 20, label: "$20/day" },
  { value: 50, label: "$50/day" },
  { value: 100, label: "$100/day" },
];

export function MobileCampaignBuilder({
  workspace,
  answers,
  onAnswerUpdate,
  onComplete,
}: MobileCampaignBuilderProps) {
  const isSocialGrowth = !!(workspace?.creative_json as any)?.socialGrowth;
  const selectedPosts = isSocialGrowth ? ((workspace?.creative_json as any)?.selectedPosts || []) : [];

  // Simplified: 3 steps (Objective, Budget, Review) — or 2 for social growth (Budget, Review)
  const totalSteps = isSocialGrowth ? 2 : 3;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const socialObjective = (workspace?.creative_json as any)?.objective;
  const [objective, setObjective] = useState(
    answers.objective || (isSocialGrowth ? (socialObjective === "video_views" ? "awareness" : "traffic") : "leads")
  );
  const [budget, setBudget] = useState(answers.budget || 30);
  // Auto-applied defaults
  const [creativeType, setCreativeType] = useState(answers.creativeType || (isSocialGrowth ? "existing_posts" : "video"));
  const [audience, setAudience] = useState(answers.audience || "broad");
  const [launchActive, setLaunchActive] = useState(answers.launchActive ?? false);

  useEffect(() => {
    const newAnswers = {
      ...answers,
      objective,
      budget,
      creativeType,
      audience,
      startDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      launchActive,
      budgetType: "daily",
      metaAdvantage: true,
      placements: "Advantage+",
      warmRetargeting: audience === "retargeting",
      ...(isSocialGrowth && { socialGrowth: true, selectedPosts }),
    };
    onAnswerUpdate(newAnswers);
  }, [objective, budget, creativeType, audience, launchActive]);

  // Map logical step to content
  const getContentStep = (logicalStep: number): number => {
    if (isSocialGrowth) {
      // Social: 1→Budget(2), 2→Review(3)
      return logicalStep + 1;
    }
    return logicalStep; // Normal: 1→Objective, 2→Budget, 3→Review
  };

  const contentStep = getContentStep(step);

  const handleNext = () => { if (step < totalSteps) setStep(step + 1); };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const canProceed = () => {
    switch (contentStep) {
      case 1: return !!objective;
      case 2: return budget >= 5;
      case 3: return true;
      default: return true;
    }
  };

  const getStepTitle = () => {
    switch (contentStep) {
      case 1: return "What's your goal?";
      case 2: return "Set your budget";
      case 3: return "Ready to launch?";
      default: return "";
    }
  };

  const getStepSubtitle = () => {
    switch (contentStep) {
      case 1: return "Pick the main objective for this campaign";
      case 2: return "How much do you want to spend per day?";
      case 3: return "We've set everything up using best practices";
      default: return "";
    }
  };

  return (
    <MobileStepWizard
      currentStep={step}
      totalSteps={totalSteps}
      title={getStepTitle()}
      subtitle={getStepSubtitle()}
      onBack={handleBack}
      onNext={handleNext}
      onComplete={onComplete}
      canProceed={canProceed()}
      isLoading={loading}
      nextLabel="Continue"
      completeLabel="Review Campaign"
    >
      {/* Step 1: Objective (skipped for social growth) */}
      {contentStep === 1 && (
        <div className="space-y-3">
          {OBJECTIVES.map((obj) => (
            <StepOption
              key={obj.id}
              selected={objective === obj.id}
              onSelect={() => setObjective(obj.id)}
              icon={obj.icon}
              title={obj.title}
              description={obj.description}
              recommended={obj.recommended}
            />
          ))}
        </div>
      )}

      {/* Step 2: Budget */}
      {contentStep === 2 && (
        <div className="space-y-6 pt-4">
          <StepSlider
            value={budget}
            onChange={setBudget}
            min={5}
            max={500}
            step={5}
            formatValue={(v) => `$${v}/day`}
            presets={BUDGET_PRESETS}
          />
          <div className="text-center text-sm text-muted-foreground">
            <p>Estimated monthly spend: <span className="font-semibold">${budget * 30}</span></p>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {contentStep === 3 && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="space-y-3">
            <SummaryCard
              icon={<Target className="h-4 w-4" />}
              label="Objective"
              value={OBJECTIVES.find(o => o.id === objective)?.title || objective}
            />
            <SummaryCard
              icon={<DollarSign className="h-4 w-4" />}
              label="Daily Budget"
              value={`$${budget}/day`}
            />
            {isSocialGrowth ? (
              <SummaryCard
                icon={<Instagram className="h-4 w-4" />}
                label="Creative"
                value={`${selectedPosts.length} Instagram post${selectedPosts.length !== 1 ? 's' : ''}`}
              />
            ) : (
              <SummaryCard
                icon={<ImageIcon className="h-4 w-4" />}
                label="Creative Type"
                value={CREATIVE_TYPES.find(t => t.id === creativeType)?.title || creativeType}
              />
            )}
          </div>

          {/* Best Practices Card */}
          <div className="p-4 rounded-xl border bg-green-50/50 border-green-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-green-100">
                <ShieldCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-green-800">Best practices applied</p>
                <p className="text-xs text-green-700">Meta's recommended settings for best results</p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-green-700">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Broad audience targeting
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Advantage+ creative optimization
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Advantage+ placements
              </div>
            </div>
          </div>

          {/* Advanced Options Collapsible */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 w-full p-3 rounded-xl border bg-card text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
                <Settings2 className="h-4 w-4" />
                <span>Advanced Options</span>
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              {/* Audience Override */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Audience</p>
                {AUDIENCES.map((aud) => (
                  <StepOption
                    key={aud.id}
                    selected={audience === aud.id}
                    onSelect={() => setAudience(aud.id)}
                    title={aud.title}
                    description={aud.description}
                    recommended={aud.recommended}
                  />
                ))}
              </div>
              {/* Creative Type Override (non-social only) */}
              {!isSocialGrowth && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Creative Type</p>
                  {CREATIVE_TYPES.map((type) => (
                    <StepOption
                      key={type.id}
                      selected={creativeType === type.id}
                      onSelect={() => setCreativeType(type.id)}
                      icon={type.icon}
                      title={type.title}
                      description={type.description}
                      recommended={type.recommended}
                    />
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Launch Status Toggle */}
          <div className="p-4 rounded-xl border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {launchActive ? (
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Play className="h-5 w-5 text-green-500" />
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Pause className="h-5 w-5 text-amber-500" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">
                    {launchActive ? "Launch Active" : "Launch Paused"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {launchActive 
                      ? "Ads go live after Meta approval" 
                      : "Activate later from dashboard"}
                  </p>
                </div>
              </div>
              <Switch
                checked={launchActive}
                onCheckedChange={setLaunchActive}
              />
            </div>
          </div>
        </div>
      )}
    </MobileStepWizard>
  );
}

function SummaryCard({ 
  icon, 
  label, 
  value 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="font-semibold text-sm">{value}</span>
    </div>
  );
}
