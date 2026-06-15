import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
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
  campaigns: CampaignPlan[];
  statuses: Array<"todo" | "in_progress" | "done">;
  activeIndex: number | null;
};

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
  const [plan, setPlan] = useState<StoredPlan | null>(null);

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

  const startCampaign = (idx: number) => {
    const statuses = [...plan.statuses];
    if (statuses[idx] === "todo") statuses[idx] = "in_progress";
    update({ ...plan, statuses, activeIndex: idx });
    const c = plan.campaigns[idx];
    const goal = c?.goal;
    const objective = c?.objective;
    const campaignName = c?.name;

    // Persist the chosen strategy step into the CampaignDraft so it survives
    // route changes into /creative and /launch.
    setStrategy({
      slug: plan.slug,
      name: plan.name,
      campaignIndex: idx,
      campaignName,
      goal,
      objective,
      audience: c?.audience,
      creative_brief: c?.creative_brief,
      description: c?.description,
    });

    const params = new URLSearchParams({ from: "strategy" });
    if (goal) params.set("goal", goal);
    if (objective) params.set("objective", objective);
    if (campaignName) params.set("campaignName", campaignName);
    params.set("campaignIdx", String(idx));
    navigate(`/create?${params.toString()}`);
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <CampaignSpine currentStep={1} />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/recommended-strategy")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to recommendation
        </Button>

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
                            className={isActive ? "" : ""}
                          >
                            {isActive ? "Resume building" : "Start building"}
                            <ArrowRight className="h-4 w-4 ml-1" />
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
