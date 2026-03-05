import { useState, useEffect } from "react";
import { MobileStepWizard, StepSlider } from "@/components/MobileStepWizard";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Target,
  Users,
  DollarSign,
  Layers,
  Play,
  Pause,
  Instagram,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  ImagePlus,
} from "lucide-react";
import { useBrand } from "@/contexts/BrandContext";
import { ExistingPostPicker, type SelectedPost } from "@/components/ExistingPostPicker";

interface MobileCampaignBuilderProps {
  workspace: any;
  answers: any;
  onAnswerUpdate: (answers: any) => void;
  onComplete: () => void;
}

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_SALES: "Sales",
  OUTCOME_LEADS: "Leads",
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_AWARENESS: "Awareness",
  sales: "Sales",
  leads: "Leads",
  traffic: "Traffic",
  awareness: "Awareness",
};

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
  const template = workspace.campaign_templates;
  const strategyJson = workspace.strategy_json as any;

  const defaultObjective = template?.objective || strategyJson?.objective || "leads";
  const defaultAudience = template?.audience_type || "broad";
  const defaultCreativeType = isSocialGrowth ? "existing_posts" : (strategyJson?.creativeType || "video");

  // Only 2 steps: Budget → Review
  const [step, setStep] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [budget, setBudget] = useState(answers.budget || 30);
  const [launchActive, setLaunchActive] = useState(answers.launchActive ?? false);
  const [includeExistingPosts, setIncludeExistingPosts] = useState(
    (answers.additionalPosts?.length || 0) > 0
  );
  const [additionalPosts, setAdditionalPosts] = useState<SelectedPost[]>(
    answers.additionalPosts || []
  );
  const { activeBrand } = useBrand();
  const hasInstagram = !!activeBrand?.meta_account_id && !!(workspace?.brands?.instagram_account_id);

  const objectiveLabel = OBJECTIVE_LABELS[defaultObjective] || defaultObjective;

  useEffect(() => {
    const newAnswers = {
      ...answers,
      objective: defaultObjective,
      budget,
      creativeType: defaultCreativeType,
      audience: defaultAudience,
      startDate: answers.startDate || new Date(Date.now() + 86400000).toISOString().split("T")[0],
      launchActive,
      budgetType: "daily",
      metaAdvantage: true,
      placements: "Advantage+",
      warmRetargeting: false,
      ...(isSocialGrowth && { socialGrowth: true, selectedPosts }),
      additionalPosts: includeExistingPosts ? additionalPosts : [],
    };
    onAnswerUpdate(newAnswers);
  }, [budget, launchActive, additionalPosts, includeExistingPosts]);

  const handleNext = () => { if (step < 2) setStep(step + 1); };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const getStepTitle = () => step === 1 ? "Set your budget" : "Ready to launch?";
  const getStepSubtitle = () =>
    step === 1
      ? "Lumi configured everything else from your strategy"
      : "Review what Lumi set up for you";

  return (
    <MobileStepWizard
      currentStep={step}
      totalSteps={2}
      title={getStepTitle()}
      subtitle={getStepSubtitle()}
      onBack={handleBack}
      onNext={handleNext}
      onComplete={onComplete}
      canProceed={budget >= 5}
      isLoading={false}
      nextLabel="Continue"
      completeLabel="Review Campaign"
    >
      {/* Step 1: Budget */}
      {step === 1 && (
        <div className="space-y-5 pt-4">
          {/* Lumi budget recommendation */}
          {template?.budget_suggestion && (
            <div className="p-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm">Lumi's recommendation: {template.budget_suggestion}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {template.objective === "OUTCOME_SALES" || template.objective === "sales"
                      ? "Sales campaigns need enough budget for Meta to find buyers. Too low and you'll stay stuck in the learning phase."
                      : template.objective === "OUTCOME_LEADS" || template.objective === "leads"
                      ? "Lead campaigns need enough daily spend to exit Meta's learning phase — usually 1–2x your target cost per lead."
                      : template.objective === "OUTCOME_TRAFFIC" || template.objective === "traffic"
                      ? "Traffic campaigns are cost-efficient, but still need enough budget for Meta to optimize delivery."
                      : "This budget range gives Meta enough data to optimize your results without overspending while you learn what works."}
                  </p>
                </div>
              </div>
            </div>
          )}

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
            <p>Estimated monthly spend: <span className="font-semibold">${(budget * 30).toLocaleString()}</span></p>
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="space-y-3">
            <SummaryCard icon={<Target className="h-4 w-4" />} label="Objective" value={objectiveLabel} />
            <SummaryCard icon={<DollarSign className="h-4 w-4" />} label="Daily Budget" value={`$${budget}/day`} />
            {isSocialGrowth ? (
              <SummaryCard icon={<Instagram className="h-4 w-4" />} label="Creative" value={`${selectedPosts.length} Instagram post${selectedPosts.length !== 1 ? "s" : ""}`} />
            ) : (
              <SummaryCard icon={<Layers className="h-4 w-4" />} label="Creative Type" value={defaultCreativeType === "video" ? "Video" : defaultCreativeType} />
            )}
          </div>

          {/* Include Existing Posts */}
          {hasInstagram && !isSocialGrowth && (
            <div className="p-4 rounded-xl border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-pink-500/10">
                    <ImagePlus className="h-5 w-5 text-pink-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Include existing posts?</p>
                    <p className="text-xs text-muted-foreground">Add Instagram posts as extra ads</p>
                  </div>
                </div>
                <Switch
                  checked={includeExistingPosts}
                  onCheckedChange={(checked) => {
                    setIncludeExistingPosts(checked);
                    if (!checked) setAdditionalPosts([]);
                  }}
                />
              </div>
              {includeExistingPosts && workspace?.brands?.instagram_account_id && (
                <ExistingPostPicker
                  brandId={workspace.brands.id || workspace.brand_id}
                  instagramAccountId={workspace.brands.instagram_account_id}
                  selectedPosts={additionalPosts}
                  onSelectionChange={setAdditionalPosts}
                />
              )}
            </div>
          )}

          {/* Best Practices */}
          <div className="p-4 rounded-xl border bg-green-50/50 border-green-200 dark:bg-green-950/10 dark:border-green-900/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-sm text-green-800 dark:text-green-300">Best practices applied</p>
                <p className="text-xs text-green-700 dark:text-green-400/80">Meta's recommended settings</p>
              </div>
            </div>
            <div className="space-y-1.5 text-xs text-green-700 dark:text-green-400/80">
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Broad audience targeting</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Advantage+ creative optimization</div>
              <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Advantage+ placements</div>
            </div>
          </div>

          {/* See what Lumi chose */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 w-full p-3 rounded-xl border bg-card text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>See what Lumi chose</span>
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2">
              <LumiRow label="Objective" value={objectiveLabel} />
              <LumiRow label="Audience" value="Broad (recommended)" />
              <LumiRow label="Placements" value="Advantage+" />
              <LumiRow label="Creative Optimization" value="Advantage+ ON" />
            </CollapsibleContent>
          </Collapsible>

          {/* Launch Toggle */}
          <div className="p-4 rounded-xl border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {launchActive ? (
                  <div className="p-2 rounded-lg bg-green-500/10"><Play className="h-5 w-5 text-green-500" /></div>
                ) : (
                  <div className="p-2 rounded-lg bg-amber-500/10"><Pause className="h-5 w-5 text-amber-500" /></div>
                )}
                <div>
                  <p className="font-semibold text-sm">{launchActive ? "Launch Active" : "Launch Paused"}</p>
                  <p className="text-xs text-muted-foreground">
                    {launchActive ? "Ads go live after Meta approval" : "Activate later from dashboard"}
                  </p>
                </div>
              </div>
              <Switch checked={launchActive} onCheckedChange={setLaunchActive} />
            </div>
          </div>
        </div>
      )}
    </MobileStepWizard>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="font-semibold text-sm">{value}</span>
    </div>
  );
}

function LumiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium">{value}</span>
        <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5 border-primary/30 text-primary">
          <Sparkles className="h-2 w-2" /> Lumi
        </Badge>
      </div>
    </div>
  );
}
