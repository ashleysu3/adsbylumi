import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Target,
  Eye,
  ShieldAlert,
  Hourglass,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  KPI_OPTIONS,
  suggestGoals,
  getThresholdPrefix,
  getThresholdSuffix,
  type GoalSuggestion,
} from "@/lib/goal-suggestions";
import {
  getLumiKPIConfig,
  formatBenchmarkRange,
  type LumiKPIConfig,
} from "@/lib/lumi-kpi-config";

interface PostLaunchWalkthroughProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  brandId: string;
  campaignName: string;
  objective: string | null;
  templateName?: string | null;
  offerPrice: string | null;
  templateSlug: string | null;
  onComplete?: () => void;
}

const TOTAL_STEPS = 5;

export function PostLaunchWalkthrough({
  open,
  onOpenChange,
  workspaceId,
  brandId,
  campaignName,
  objective,
  templateName,
  offerPrice,
  templateSlug,
  onComplete,
}: PostLaunchWalkthroughProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [goalSaved, setGoalSaved] = useState(false);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);

  const suggestion: GoalSuggestion = useMemo(
    () => suggestGoals(offerPrice, templateSlug),
    [offerPrice, templateSlug],
  );

  const kpiConfig: LumiKPIConfig = useMemo(
    () => getLumiKPIConfig(objective, templateName, campaignName),
    [objective, templateName, campaignName],
  );

  const [kpi, setKpi] = useState<string>(suggestion.primary.kpi);
  const [threshold, setThreshold] = useState<string>(String(suggestion.primary.threshold));

  // Reset state whenever modal reopens
  useEffect(() => {
    if (open) {
      setStep(1);
      setKpi(suggestion.primary.kpi);
      setThreshold(String(suggestion.primary.threshold));
      setGoalSaved(false);
      setSavedSummary(null);
    }
  }, [open, suggestion.primary.kpi, suggestion.primary.threshold]);

  const handleNext = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleSaveGoal = async () => {
    if (!kpi || !threshold) {
      toast.error("Please pick a KPI and target value");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const kpiOption = KPI_OPTIONS.find((o) => o.value === kpi);
      const { error } = await supabase
        .from("campaign_goals")
        .upsert(
          {
            workspace_id: workspaceId,
            brand_id: brandId,
            created_by: user.id,
            primary_kpi: kpi,
            primary_kpi_label: kpiOption?.label || kpi,
            primary_kpi_goal_type: kpiOption?.goalType || "less_than",
            primary_kpi_threshold: parseFloat(threshold),
            check_frequency_at: "campaign",
            frequency_threshold: 4,
          },
          { onConflict: "workspace_id" },
        );
      if (error) throw error;
      const direction = kpiOption?.goalType === "greater_than" ? "above" : "under";
      const summary = `${kpiOption?.label || kpi} ${direction} ${getThresholdPrefix(kpi)}${threshold}${getThresholdSuffix(kpi)}`;
      setSavedSummary(summary);
      setGoalSaved(true);
      toast.success("Goal locked in. Lumi is on it.");
    } catch (err: any) {
      console.error("Error saving goal in walkthrough:", err);
      toast.error(err.message || "Couldn't save your goal");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = () => {
    onOpenChange(false);
    onComplete?.();
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl p-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Header with progress dots */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-br from-primary/5 via-accent/5 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                Lumi Onboarding · Step {step} of {TOTAL_STEPS}
              </span>
            </div>
            <button
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground story-link"
            >
              Skip for now
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i + 1 < step
                    ? "bg-primary"
                    : i + 1 === step
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="px-6 py-6 min-h-[340px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {step === 1 && (
                <StepIntro kpiConfig={kpiConfig} />
              )}
              {step === 2 && (
                <StepBenchmark kpiConfig={kpiConfig} />
              )}
              {step === 3 && (
                <StepGoal
                  suggestion={suggestion}
                  kpi={kpi}
                  setKpi={setKpi}
                  threshold={threshold}
                  setThreshold={setThreshold}
                />
              )}
              {step === 4 && <StepMonitoring />}
              {step === 5 && <StepThreeDayRule />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={step === 1}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          {step < 3 && (
            <Button onClick={handleNext} className="gap-1.5 rounded-xl">
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {step === 3 && (
            <Button
              onClick={handleSaveGoal}
              disabled={saving || !kpi || !threshold}
              className="gap-1.5 rounded-xl"
            >
              <Target className="h-4 w-4" />
              {saving ? "Saving…" : "Save my goal"}
            </Button>
          )}
          {step === 4 && (
            <Button onClick={handleNext} className="gap-1.5 rounded-xl">
              Got it
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {step === 5 && (
            <Button onClick={handleFinish} className="gap-1.5 rounded-xl">
              Take me to my dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────
// Step 1 — Meet your KPIs
// ──────────────────────────────────────────────────────────
function StepIntro({ kpiConfig }: { kpiConfig: LumiKPIConfig }) {
  const kpiPrimer: { name: string; key: string; meaning: string }[] = [
    { name: "CTR", key: "Click-Through Rate", meaning: "% of people who saw your ad and tapped." },
    { name: "CPC", key: "Cost per Click", meaning: "What you pay each time someone clicks." },
    { name: "CPL", key: "Cost per Lead", meaning: "What it costs to capture one new lead." },
    { name: "ROAS", key: "Return on Ad Spend", meaning: "Revenue earned per $1 spent." },
    { name: "CPM", key: "Cost per 1,000 Impressions", meaning: "What it costs to be seen 1,000 times." },
  ];

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <Eye className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-semibold leading-tight">Meet your KPIs ✨</h2>
          <p className="text-xs text-muted-foreground">A quick translation of the metrics that actually matter.</p>
        </div>
      </div>

      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="p-3 space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">For this campaign, your North Star is</p>
          <p className="font-semibold text-base">{kpiConfig.primaryLabel}</p>
          <p className="text-xs text-muted-foreground">
            Lumi will weigh this metric most heavily when judging performance.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {kpiPrimer.map((item) => (
          <div key={item.name} className="flex items-start gap-3 text-sm">
            <Badge variant="outline" className="shrink-0 mt-0.5 font-mono text-[10px]">
              {item.name}
            </Badge>
            <div>
              <span className="font-medium">{item.key}</span>
              <span className="text-muted-foreground"> — {item.meaning}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Step 2 — Benchmark for this campaign
// ──────────────────────────────────────────────────────────

interface BenchmarkCopy {
  introLead: string;
  rangeCaption: string;
  healthyLabel: string;
  healthyDetail: string;
  watchLabel: string;
  watchDetail: string;
  criticalLabel: string;
  criticalDetail: string;
  footer: string;
}

function getBenchmarkCopy(kpiConfig: LumiKPIConfig): BenchmarkCopy {
  const friendly = kpiConfig.friendlyName.toLowerCase();
  const range = formatBenchmarkRange(kpiConfig.benchmark);

  switch (kpiConfig.primary) {
    case "roas":
      return {
        introLead: `For ${friendly} campaigns, Lumi tracks Return on Ad Spend — every $1 in, multiplied.`,
        rangeCaption: `Healthy ${friendly} campaigns earn back ${range} for every dollar spent.`,
        healthyLabel: "Profitable",
        healthyDetail: `${kpiConfig.benchmark.min.toFixed(1)}x or higher — keep scaling.`,
        watchLabel: "Breakeven zone",
        watchDetail: "Returns softening — refresh creative or offer.",
        criticalLabel: "Losing money",
        criticalDetail: "Spend is outpacing revenue.",
        footer: "Lumi watches every dollar in vs every dollar out — no spreadsheets required.",
      };
    case "cpl":
      return {
        introLead: `For ${friendly}, Lumi watches Cost Per Lead — what you pay for each new contact.`,
        rangeCaption: `A healthy lead for this kind of offer lands between ${range}.`,
        healthyLabel: "Efficient",
        healthyDetail: `Leads at or under ${kpiConfig.benchmark.unit}${kpiConfig.benchmark.max.toFixed(0)}.`,
        watchLabel: "Pricier than ideal",
        watchDetail: "Costs creeping up — try fresh hooks.",
        criticalLabel: "Too expensive",
        criticalDetail: "Lead cost is well above benchmark.",
        footer: "Lumi calculates your CPL daily and alerts you the moment it drifts.",
      };
    case "cpp":
      return {
        introLead: `For ${friendly}, Lumi tracks Cost Per Purchase — what you pay for each sale.`,
        rangeCaption: `Healthy purchases at this price point come in between ${range}.`,
        healthyLabel: "Profitable sales",
        healthyDetail: `Purchases under ${kpiConfig.benchmark.unit}${kpiConfig.benchmark.max.toFixed(0)}.`,
        watchLabel: "Margin shrinking",
        watchDetail: "CPP climbing — check fatigue & landing page.",
        criticalLabel: "Underwater",
        criticalDetail: "Sales costing more than they're worth.",
        footer: "Lumi grades every purchase against your price point automatically.",
      };
    case "cpc":
      return {
        introLead: `For ${friendly}, Lumi watches Cost Per Click — what you pay for each tap.`,
        rangeCaption: `Healthy clicks for traffic campaigns land between ${range}.`,
        healthyLabel: "Strong creative",
        healthyDetail: `Clicks under ${kpiConfig.benchmark.unit}${kpiConfig.benchmark.max.toFixed(2)}.`,
        watchLabel: "Hooks softening",
        watchDetail: "Your scroll-stopper may be losing steam.",
        criticalLabel: "Not landing",
        criticalDetail: "Time to refresh hooks or visuals.",
        footer: "Lumi tracks click costs daily so you know the moment a creative tires out.",
      };
    case "costPerThruPlay":
      return {
        introLead: `For ${friendly}, Lumi tracks Cost Per ThruPlay — what you pay for someone to actually watch.`,
        rangeCaption: `Healthy view costs land between ${range} per ThruPlay.`,
        healthyLabel: "Eyes engaged",
        healthyDetail: `ThruPlays under ${kpiConfig.benchmark.unit}${kpiConfig.benchmark.max.toFixed(2)}.`,
        watchLabel: "Hook weakening",
        watchDetail: "Tighten the first 3 seconds.",
        criticalLabel: "Scroll-by",
        criticalDetail: "Video isn't holding attention.",
        footer: "Lumi monitors view costs every day so your hook stays sharp.",
      };
    case "cpm":
      return {
        introLead: `For ${friendly}, Lumi tracks CPM — what you pay to be seen 1,000 times.`,
        rangeCaption: `Healthy CPMs for this objective land between ${range}.`,
        healthyLabel: "Efficient reach",
        healthyDetail: `CPM under ${kpiConfig.benchmark.unit}${kpiConfig.benchmark.max.toFixed(2)}.`,
        watchLabel: "Reach narrowing",
        watchDetail: "Audience may be saturating.",
        criticalLabel: "Pricey impressions",
        criticalDetail: "Paying a premium to be seen.",
        footer: "Lumi tracks reach efficiency so your message stays in front of the right eyes.",
      };
    default:
      return {
        introLead: `Industry-tested ranges for ${friendly} campaigns.`,
        rangeCaption: "Stay inside the healthy range and Lumi keeps quiet.",
        healthyLabel: "Healthy",
        healthyDetail: "In range",
        watchLabel: "Watch",
        watchDetail: "Slightly off",
        criticalLabel: "Critical",
        criticalDetail: "Action needed",
        footer: "Lumi grades you against this range automatically. No spreadsheets. No guessing.",
      };
  }
}

function StepBenchmark({ kpiConfig }: { kpiConfig: LumiKPIConfig }) {
  const range = formatBenchmarkRange(kpiConfig.benchmark);
  const isUpward = kpiConfig.primary === "roas";
  const copy = getBenchmarkCopy(kpiConfig);

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <Target className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-semibold leading-tight">
            Your benchmark for {kpiConfig.primaryLabel}
          </h2>
          <p className="text-xs text-muted-foreground">{copy.introLead}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Healthy {kpiConfig.primaryLabel} range
            </p>
            <p className="text-2xl font-semibold font-display">{range}</p>
            <p className="text-xs text-muted-foreground">
              {copy.rangeCaption}{" "}
              <span className="italic">
                ({isUpward ? "higher is better" : "lower is better"})
              </span>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="rounded-lg border bg-green-500/5 border-green-500/20 p-2 text-center">
              <div className="w-2 h-2 rounded-full bg-green-500 mx-auto mb-1" />
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {copy.healthyLabel}
              </p>
              <p className="text-xs font-medium leading-tight">{copy.healthyDetail}</p>
            </div>
            <div className="rounded-lg border bg-amber-500/5 border-amber-500/20 p-2 text-center">
              <div className="w-2 h-2 rounded-full bg-amber-500 mx-auto mb-1" />
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {copy.watchLabel}
              </p>
              <p className="text-xs font-medium leading-tight">{copy.watchDetail}</p>
            </div>
            <div className="rounded-lg border bg-red-500/5 border-red-500/20 p-2 text-center">
              <div className="w-2 h-2 rounded-full bg-red-500 mx-auto mb-1" />
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {copy.criticalLabel}
              </p>
              <p className="text-xs font-medium leading-tight">{copy.criticalDetail}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{copy.footer}</p>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Step 3 — Set your success goal
// ──────────────────────────────────────────────────────────
function StepGoal({
  suggestion,
  kpi,
  setKpi,
  threshold,
  setThreshold,
}: {
  suggestion: GoalSuggestion;
  kpi: string;
  setKpi: (v: string) => void;
  threshold: string;
  setThreshold: (v: string) => void;
}) {
  const kpiOpt = KPI_OPTIONS.find((o) => o.value === kpi);
  const prefix = getThresholdPrefix(kpi);
  const suffix = getThresholdSuffix(kpi);

  const applySuggestion = () => {
    setKpi(suggestion.primary.kpi);
    setThreshold(String(suggestion.primary.threshold));
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-semibold leading-tight">Set your success goal</h2>
          <p className="text-xs text-muted-foreground">This is the number Lumi watches for you, every day.</p>
        </div>
      </div>

      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Lumi's suggestion</span>
          </div>
          <p className="text-xs text-muted-foreground">{suggestion.note}</p>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">{suggestion.primary.label}</span>
              <span className="text-muted-foreground">
                {" "}
                — {suggestion.primary.goalType === "less_than" ? "under" : "over"}{" "}
              </span>
              <span className="font-semibold">
                {getThresholdPrefix(suggestion.primary.kpi)}
                {suggestion.primary.threshold}
                {getThresholdSuffix(suggestion.primary.kpi)}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-xl gap-1"
              onClick={applySuggestion}
            >
              <Check className="h-3 w-3" />
              Use this
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Primary KPI</Label>
          <Select value={kpi} onValueChange={setKpi}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Choose a KPI…" />
            </SelectTrigger>
            <SelectContent>
              {KPI_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">
            Target ({kpiOpt?.goalType === "greater_than" ? "greater than" : "less than"})
          </Label>
          <div className="relative mt-1">
            {prefix && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                {prefix}
              </span>
            )}
            <Input
              type="number"
              step="any"
              className={prefix ? "pl-7" : ""}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="Enter your target"
            />
            {suffix && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                {suffix}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Step 4 — How Lumi watches this for you
// ──────────────────────────────────────────────────────────
function StepMonitoring() {
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldAlert className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-semibold leading-tight">How Lumi watches this for you</h2>
          <p className="text-xs text-muted-foreground">You can close the tab. Lumi stays on the case.</p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-3 p-3 rounded-lg border bg-green-500/5 border-green-500/20">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
          <div>
            <p className="font-medium">🟢 Healthy</p>
            <p className="text-xs text-muted-foreground">You're hitting your goal. Lumi keeps quiet.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg border bg-amber-500/5 border-amber-500/20">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
          <div>
            <p className="font-medium">🟡 Watch</p>
            <p className="text-xs text-muted-foreground">Slightly off-track. Lumi nudges you with a suggestion.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg border bg-red-500/5 border-red-500/20">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
          <div>
            <p className="font-medium">🔴 Critical</p>
            <p className="text-xs text-muted-foreground">Performance dropped. Lumi alerts you with what to do next.</p>
          </div>
        </div>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
          <p>
            <span className="font-medium text-foreground">Fatigue alerts:</span> Lumi flags you when frequency climbs above 4 — a sign your audience needs fresh creative.
          </p>
          <p>
            <span className="font-medium text-foreground">Weekly report:</span> A clean recap lands in your inbox every week with what worked, what didn't, and what to do next.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Step 5 — Give it at least 3 days
// ──────────────────────────────────────────────────────────
function StepThreeDayRule() {
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center">
          <Hourglass className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-display font-semibold leading-tight">⏳ Give it at least 3 days</h2>
          <p className="text-xs text-muted-foreground">The hardest — and most important — part of paid ads.</p>
        </div>
      </div>

      <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-amber-500/5">
        <CardContent className="p-4 space-y-2">
          <p className="font-display font-semibold text-base">Don't touch it.</p>
          <p className="text-sm text-muted-foreground">
            Meta needs time to learn who responds. Judging performance too early is the #1 reason ads fail.
          </p>
          <p className="text-xs text-muted-foreground italic">
            Lumi's rule: <span className="font-medium text-foreground">avoid decisions before 3 days or 1,000 impressions.</span>
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">For the next 72 hours, do not:</p>
        <div className="space-y-1.5">
          {[
            "Pause your ads — even if early numbers look scary",
            "Change your budget — it resets the learning phase",
            "Swap creative or copy — let the winners surface",
            "Edit your audience or placements",
          ].map((rule) => (
            <div key={rule} className="flex items-start gap-2 text-sm">
              <div className="w-4 h-4 rounded-full border-2 border-amber-500/60 mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{rule}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-center text-muted-foreground italic">
        Take a breath. Lumi will tell you when it's time to make a move. ✨
      </p>
    </>
  );
}
