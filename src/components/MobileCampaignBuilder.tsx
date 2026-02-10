import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MobileStepWizard, StepOption, StepSlider } from "@/components/MobileStepWizard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Target, 
  Users, 
  DollarSign, 
  Calendar,
  Zap,
  Video,
  Image as ImageIcon,
  Layers,
  Play,
  Pause,
  Instagram
} from "lucide-react";
import { toast } from "sonner";

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
  // Detect social growth campaign (posts already selected, no creative step needed)
  const isSocialGrowth = !!(workspace?.creative_json as any)?.socialGrowth;
  const selectedPosts = isSocialGrowth ? ((workspace?.creative_json as any)?.selectedPosts || []) : [];

  // Steps: for social growth, skip creative type (step 3 in normal flow)
  // Normal: 1-Objective, 2-Budget, 3-Creative, 4-Audience, 5-Schedule, 6-Review
  // Social: 1-Objective, 2-Budget, 3-Audience, 4-Schedule, 5-Review
  const totalSteps = isSocialGrowth ? 5 : 6;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Local state for step values
  const socialObjective = (workspace?.creative_json as any)?.objective;
  const [objective, setObjective] = useState(
    answers.objective || (isSocialGrowth ? (socialObjective === "video_views" ? "awareness" : "traffic") : "leads")
  );
  const [budget, setBudget] = useState(answers.budget || 30);
  const [creativeType, setCreativeType] = useState(answers.creativeType || (isSocialGrowth ? "existing_posts" : "video"));
  const [audience, setAudience] = useState(answers.audience || "broad");
  const [startDate, setStartDate] = useState(answers.startDate || getTomorrowDate());
  const [launchActive, setLaunchActive] = useState(answers.launchActive ?? false);

  function getTomorrowDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  // Update parent on local changes
  useEffect(() => {
    const newAnswers = {
      ...answers,
      objective,
      budget,
      creativeType,
      audience,
      startDate,
      launchActive,
      budgetType: "daily",
      metaAdvantage: true,
      placements: "Advantage+",
      warmRetargeting: audience === "retargeting",
      ...(isSocialGrowth && { socialGrowth: true, selectedPosts }),
    };
    onAnswerUpdate(newAnswers);
  }, [objective, budget, creativeType, audience, startDate, launchActive]);

  // Map logical step to content for social growth (skip creative type)
  const getContentStep = (logicalStep: number): number => {
    if (!isSocialGrowth) return logicalStep;
    // Social: 1→1, 2→2, 3→4(audience), 4→5(schedule), 5→6(review)
    if (logicalStep <= 2) return logicalStep;
    return logicalStep + 1; // skip 3 (creative)
  };

  const contentStep = getContentStep(step);

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = () => {
    onComplete();
  };

  const canProceed = () => {
    switch (contentStep) {
      case 1: return !!objective;
      case 2: return budget >= 5;
      case 3: return !!creativeType;
      case 4: return !!audience;
      case 5: return !!startDate;
      case 6: return true;
      default: return true;
    }
  };

  const getStepTitle = () => {
    switch (contentStep) {
      case 1: return "What's your goal?";
      case 2: return "Set your budget";
      case 3: return "Choose creative type";
      case 4: return "Select audience";
      case 5: return "When should it start?";
      case 6: return "Ready to launch?";
      default: return "";
    }
  };

  const getStepSubtitle = () => {
    switch (contentStep) {
      case 1: return "Pick the main objective for this campaign";
      case 2: return "How much do you want to spend per day?";
      case 3: return "What type of content will you use?";
      case 4: return "Who should see your ads?";
      case 5: return "Pick your launch date";
      case 6: return "Review and confirm your choices";
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
      onComplete={handleComplete}
      canProceed={canProceed()}
      isLoading={loading}
      nextLabel="Continue"
      completeLabel="Review Campaign"
    >
      {/* Step 1: Objective */}
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

      {/* Step 3: Creative Type (skipped for social growth) */}
      {contentStep === 3 && (
        <div className="space-y-3">
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

      {/* Step 4: Audience */}
      {contentStep === 4 && (
        <div className="space-y-3">
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
      )}

      {/* Step 5: Schedule */}
      {contentStep === 5 && (
        <div className="space-y-6 pt-4">
          <div className="space-y-3">
            <Label htmlFor="start-date" className="text-base font-medium">
              Start Date
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={getTomorrowDate()}
              className="h-14 text-lg text-center"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                setStartDate(d.toISOString().split('T')[0]);
              }}
              className="py-3 px-4 rounded-lg bg-muted text-sm font-medium touch-target"
            >
              Tomorrow
            </button>
            <button
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 3);
                setStartDate(d.toISOString().split('T')[0]);
              }}
              className="py-3 px-4 rounded-lg bg-muted text-sm font-medium touch-target"
            >
              In 3 days
            </button>
            <button
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 7);
                setStartDate(d.toISOString().split('T')[0]);
              }}
              className="py-3 px-4 rounded-lg bg-muted text-sm font-medium touch-target"
            >
              Next week
            </button>
          </div>
        </div>
      )}

      {/* Step 6 (or 5 for social growth): Review Summary */}
      {contentStep === 6 && (
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
            <SummaryCard
              icon={<Users className="h-4 w-4" />}
              label="Audience"
              value={AUDIENCES.find(a => a.id === audience)?.title.replace(" (Recommended)", "") || audience}
            />
            <SummaryCard
              icon={<Calendar className="h-4 w-4" />}
              label="Start Date"
              value={new Date(startDate).toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            />
          </div>

          {/* Launch Status Toggle */}
          <div className="p-4 rounded-xl border bg-card mt-4">
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

// Summary Card Component
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
