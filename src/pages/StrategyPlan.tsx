import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  PlayCircle,
  Sparkles,
  RotateCcw,
  PartyPopper,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CampaignSpine } from "@/components/CampaignSpine";
import { useCampaignDraft } from "@/contexts/CampaignDraftContext";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";

type CampaignPlan = {
  name?: string;
  objective?: string;
  goal?: string;
  audience?: string;
  budget_pct?: number;
  creative_brief?: string;
  description?: string;
};

type StoredPlan = {
  slug: string;
  name: string;
  why_it_works?: string;
  intro?: string;
  offer_id?: string | null;
  campaigns: CampaignPlan[];
  statuses: Array<"todo" | "in_progress" | "done">;
  activeIndex: number | null;
  workspaceIds?: Array<string | null>;
};

type CampaignTemplate = {
  id: string;
  name: string;
  slug: string;
  description: string;
  objective: string;
  use_case?: string | null;
  strategy_template: Record<string, any> | null;
};

const fallbackAngles = [
  {
    id: "angle-1",
    name: "Teach the Hidden Mistake",
    hook: "The tiny mistake that keeps this feeling harder than it needs to.",
    description: "Open with the common pain, teach one simple correction, then point viewers toward the full training topic.",
    psychologyTrigger: "Clarity",
  },
  {
    id: "angle-2",
    name: "One Shift to Try Today",
    hook: "Try this before you change your whole strategy.",
    description: "Give one practical educational takeaway that helps the viewer feel progress immediately.",
    psychologyTrigger: "Quick win",
  },
  {
    id: "angle-3",
    name: "What I Wish You Knew",
    hook: "What I wish more people knew before they tried to fix this.",
    description: "Reframe the problem with an expert insight and invite viewers to keep learning from the training content.",
    psychologyTrigger: "Authority",
  },
];

function pickStrategyTemplate(
  list: CampaignTemplate[],
  objective = "",
  campaignName = "",
): CampaignTemplate | null {
  if (!list.length) return null;
  const combined = `${objective} ${campaignName}`.toLowerCase();
  const intent = /awareness|education|educat|training|train|nurture|video[_\s-]?views?|view_content/.test(combined)
    ? "awareness"
    : /lead|webinar|freebie|opt.?in|registration|complete_registration/.test(combined)
    ? "lead"
    : /traffic|visit|click|instagram|profile/.test(combined)
    ? "traffic"
    : /engagement|comment|message|dm|conversation/.test(combined)
    ? "engagement"
    : /sales|sale|purchase|conversion|convert|checkout/.test(combined)
    ? "sales"
    : "";

  if (intent) {
    const byIntent = list.find((t) => {
      const haystack = `${t.objective || ""} ${t.name || ""} ${t.slug || ""} ${t.use_case || ""}`.toLowerCase();
      return (
        haystack.includes(intent) ||
        (intent === "awareness" && /video|view|training|education/.test(haystack)) ||
        (intent === "lead" && haystack.includes("leads"))
      );
    });
    if (byIntent) return byIntent;
  }

  const obj = objective.trim().toLowerCase();
  if (obj) {
    const exact = list.find((t) => (t.objective || "").toLowerCase() === obj);
    if (exact) return exact;
  }

  return null;
}

export const STRATEGY_PLAN_KEY = "lumi_strategy_plan";

export function loadStrategyPlan(): StoredPlan | null {
  try {
    const raw = sessionStorage.getItem(STRATEGY_PLAN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPlan;
  } catch {
    return null;
  }
}

export function saveStrategyPlan(plan: StoredPlan) {
  sessionStorage.setItem(STRATEGY_PLAN_KEY, JSON.stringify(plan));
}

export function clearStrategyPlan() {
  sessionStorage.removeItem(STRATEGY_PLAN_KEY);
}

export default function StrategyPlan() {
  const navigate = useNavigate();
  const { setStrategy, clearDraft } = useCampaignDraft();
  const { activeBrand } = useBrand();
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [buildingIndex, setBuildingIndex] = useState<number | null>(null);

  useEffect(() => {
    const p = loadStrategyPlan();
    if (!p) {
      toast.error("No active strategy plan. Let's get you one.");
      navigate("/recommended-strategy");
      return;
    }
    setPlan(p);
  }, [navigate]);

  const { doneCount, total, allDone } = useMemo(() => {
    const total = plan?.campaigns.length ?? 0;
    const doneCount = plan?.statuses.filter((s) => s === "done").length ?? 0;
    return { doneCount, total, allDone: total > 0 && doneCount === total };
  }, [plan]);

  if (!plan) return null;

  const update = (next: StoredPlan) => {
    saveStrategyPlan(next);
    setPlan(next);
  };

  const startCampaign = async (idx: number) => {
    if (buildingIndex !== null) return;
    if (!activeBrand?.id) {
      toast.error("Choose a brand first.");
      return;
    }

    const statuses = [...plan.statuses];
    if (statuses[idx] === "todo") statuses[idx] = "in_progress";
    const startedPlan = { ...plan, statuses, activeIndex: idx };
    update(startedPlan);
    const c = plan.campaigns[idx];
    const goal = c?.goal;
    const objective = c?.objective;
    const campaignName = c?.name;

    // Persist the chosen strategy step into the CampaignDraft so it survives
    // route changes into /creative and /launch.
    setStrategy({
      slug: plan.slug,
      name: plan.name,
      offer_id: plan.offer_id,
      campaignIndex: idx,
      campaignName,
      goal,
      objective,
      audience: c?.audience,
      creative_brief: c?.creative_brief,
      description: c?.description,
    });

    const existingWorkspaceId = startedPlan.workspaceIds?.[idx];
    if (existingWorkspaceId) {
      navigate(`/creative-studio?workspace=${existingWorkspaceId}`);
      return;
    }

    setBuildingIndex(idx);
    try {
      const [{ data: brandData, error: brandError }, { data: templatesData, error: templatesError }] = await Promise.all([
        supabase.from("brands").select("*").eq("id", activeBrand.id).single(),
        supabase.from("campaign_templates").select("*").eq("active", true).order("sort_order"),
      ]);
      if (brandError) throw brandError;
      if (templatesError) throw templatesError;

      const templates = (templatesData || []) as CampaignTemplate[];
      const selectedTemplate = pickStrategyTemplate(templates, objective, campaignName) || templates[0];
      if (!selectedTemplate) throw new Error("Missing campaign template");

      const { data: selectedOffer } = plan.offer_id
        ? await supabase.from("offers").select("*").eq("id", plan.offer_id).maybeSingle()
        : { data: null } as any;

      const strategyJson = {
        ...(selectedTemplate.strategy_template || {}),
        objective,
        campaign_name: campaignName,
        creative_brief: c?.creative_brief || null,
        strategyPlanContext: {
          objective,
          name: campaignName,
          goal,
          audience: c?.audience || null,
          creative_brief: c?.creative_brief || null,
        },
      };

      const { data: anglesData, error: anglesError } = await supabase.functions.invoke("generate-creative-angles", {
        body: {
          brandName: (brandData as any).name,
          strategyData: strategyJson,
          audiencePsychology: (brandData as any).audience_psychology,
          offerData: selectedOffer
            ? {
                name: (selectedOffer as any).name,
                description: (selectedOffer as any).description,
                price: (selectedOffer as any).price_point,
                product_psychology: (selectedOffer as any).product_psychology,
              }
            : {
                name: campaignName || plan.name,
                description: c?.description,
              },
          campaignObjective: objective,
          creativeBrief: c?.creative_brief || null,
          campaignName,
        },
      });
      if (anglesError) throw anglesError;

      const finalAngles = Array.isArray((anglesData as any)?.angles) && (anglesData as any).angles.length > 0
        ? (anglesData as any).angles
        : fallbackAngles;

      const workspaceName = campaignName || selectedTemplate.name;
      const { data: strategy, error: strategyError } = await supabase
        .from("strategies")
        .insert({
          brand_id: activeBrand.id,
          template_id: selectedTemplate.id,
          name: workspaceName,
          campaign_type: (selectedTemplate.strategy_template as any)?.campaign_type || "cold",
          messaging_framework: (selectedTemplate.strategy_template as any)?.messaging_framework,
          audience_psychology: (selectedTemplate.strategy_template as any)?.audience_psychology,
          optimization_goals: (selectedTemplate.strategy_template as any)?.optimization_goals,
          kpi_benchmarks: (selectedTemplate.strategy_template as any)?.kpi_benchmarks,
          status: "active",
          offer_name: (selectedOffer as any)?.name || null,
          offer_url: (selectedOffer as any)?.url || null,
          offer_price: (selectedOffer as any)?.price_point || null,
          offer_description: (selectedOffer as any)?.description || null,
        })
        .select()
        .single();
      if (strategyError) throw strategyError;

      const { data: workspace, error: workspaceError } = await supabase
        .from("campaign_workspaces")
        .insert([{ 
          brand_id: activeBrand.id,
          strategy_id: (strategy as any).id,
          template_id: selectedTemplate.id,
          name: workspaceName,
          strategy_json: strategyJson as any,
          progress_status: "creative_in_progress",
          offer_id: (selectedOffer as any)?.id || plan.offer_id || null,
          offer_name: (selectedOffer as any)?.name || null,
          offer_url: (selectedOffer as any)?.url || null,
          offer_price: (selectedOffer as any)?.price_point || null,
          offer_description: (selectedOffer as any)?.description || null,
          creative_json: {
            angles: finalAngles.map((a: any) => ({ ...a })),
            selectedAngleIds: [],
            selectedCreativeTemplates: [],
            phase1Flow: true,
            fromStrategyPlan: true,
            strategyPlanSlug: plan.slug,
            strategyPlanCampaignIndex: idx,
          } as any,
        }])
        .select()
        .single();
      if (workspaceError) throw workspaceError;

      const workspaceIds = [...(startedPlan.workspaceIds || Array(plan.campaigns.length).fill(null))];
      workspaceIds[idx] = (workspace as any).id;
      update({ ...startedPlan, workspaceIds });
      toast.success("Angles are ready.");
      navigate(`/creative-studio?workspace=${(workspace as any).id}`);
    } catch (error: any) {
      console.error("Error opening strategy campaign:", error);
      toast.error(error.message || "Failed to open angles");
    } finally {
      setBuildingIndex(null);
    }
  };

  const markDone = (idx: number) => {
    const statuses = [...plan.statuses];
    statuses[idx] = "done";
    update({ ...plan, statuses, activeIndex: null });
    toast.success(`Campaign ${idx + 1} marked as built.`);
  };

  const resetCampaign = (idx: number) => {
    const statuses = [...plan.statuses];
    statuses[idx] = "todo";
    update({ ...plan, statuses });
  };

  const finishStrategy = () => {
    clearStrategyPlan();
    toast.success("Your strategy is live. Beautiful work.");
    navigate("/dashboard");
  };

  const handleStartOver = () => {
    const ok = window.confirm(
      "Start over? This clears your current strategy plan and in-progress campaign draft so you can pick a different offer.",
    );
    if (!ok) return;
    clearStrategyPlan();
    clearDraft();
    toast.success("Cleared. Let's build a fresh strategy.");
    navigate("/recommended-strategy");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <CampaignSpine currentStep={1} />
        <div className="flex items-center justify-between mb-6 gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/recommended-strategy")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to recommendation
          </Button>
          <Button variant="outline" size="sm" onClick={handleStartOver}>
            <RotateCcw className="h-4 w-4 mr-1" /> Start over
          </Button>
        </div>

        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-lumi-pink-1/10 to-lumi-purple-1/10 border border-lumi-pink-1/20 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-lumi-pink-1" />
            <span className="text-xs font-medium text-lumi-pink-1">
              Your Strategy Plan
            </span>
          </div>
          <h1 className="text-2xl font-heading font-bold">{plan.name}</h1>
          {plan.intro && (
            <p className="text-sm text-muted-foreground italic">"{plan.intro}"</p>
          )}
        </div>

        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">
              {doneCount} of {total} campaigns built
            </p>
            <Badge variant={allDone ? "default" : "secondary"}>
              {allDone ? "Complete" : `${total - doneCount} to go`}
            </Badge>
          </div>
          <Progress value={total === 0 ? 0 : (doneCount / total) * 100} />
        </Card>

        <div className="space-y-3">
          {plan.campaigns.map((c, idx) => {
            const status = plan.statuses[idx];
            const isDone = status === "done";
            const isActive = status === "in_progress";
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card
                  className={`p-5 ${
                    isDone
                      ? "bg-muted/30 border-primary/30"
                      : isActive
                      ? "border-lumi-pink-1/40 shadow-glow"
                      : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 pt-0.5">
                      {isDone ? (
                        <CheckCircle2 className="h-6 w-6 text-primary" />
                      ) : isActive ? (
                        <PlayCircle className="h-6 w-6 text-lumi-pink-1" />
                      ) : (
                        <Circle className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-muted-foreground">
                          Step {idx + 1} of {total}
                        </span>
                        {isActive && (
                          <Badge className="bg-lumi-pink-1/10 text-lumi-pink-1 border-lumi-pink-1/30">
                            In progress
                          </Badge>
                        )}
                        {isDone && (
                          <Badge variant="outline">Built</Badge>
                        )}
                      </div>
                      <h3 className="font-semibold">
                        {c.name ?? `Campaign ${idx + 1}`}
                      </h3>
                      {c.description && (
                        <p className="text-sm text-muted-foreground">
                          {c.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {c.objective && (
                          <Badge variant="secondary">{c.objective}</Badge>
                        )}
                        {c.audience && (
                          <Badge variant="outline">
                            Audience: {c.audience}
                          </Badge>
                        )}
                        {typeof c.budget_pct === "number" && (
                          <Badge variant="outline">
                            {c.budget_pct}% of budget
                          </Badge>
                        )}
                      </div>
                      {c.creative_brief && (
                        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-1">
                          <span className="font-medium text-foreground">
                            Creative brief:{" "}
                          </span>
                          {c.creative_brief}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2">
                        {!isDone && (
                          <Button
                            size="sm"
                            onClick={() => startCampaign(idx)}
                            disabled={buildingIndex !== null}
                            className={isActive ? "" : ""}
                          >
                            {buildingIndex === idx ? (
                              <>
                                Opening angles
                                <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                              </>
                            ) : (
                              <>
                                {isActive ? "Resume building" : "Start building"}
                                <ArrowRight className="h-4 w-4 ml-1" />
                              </>
                            )}
                          </Button>
                        )}
                        {!isDone && isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markDone(idx)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Mark as built
                          </Button>
                        )}
                        {isDone && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => resetCampaign(idx)}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reopen
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {allDone && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <Card className="p-6 text-center bg-gradient-to-br from-lumi-pink-1/10 to-lumi-purple-1/10 border-lumi-pink-1/30">
              <PartyPopper className="h-8 w-8 text-lumi-pink-1 mx-auto mb-3" />
              <h2 className="font-heading font-bold text-lg mb-1">
                Your full strategy is live
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Every campaign in your plan is built. Time to let it run.
              </p>
              <Button onClick={finishStrategy}>Go to dashboard</Button>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
