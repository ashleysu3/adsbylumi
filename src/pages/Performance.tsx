import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CampaignSpine } from "@/components/CampaignSpine";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import { toast } from "sonner";
import {
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Clock,
  History,
  Target,
  Loader2,
  BarChart2,
  DollarSign,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { upsertRecommendationTasks, closeMatchingTasks, RecForTask } from "@/lib/task-executors";



// ============================================================================
// /performance — leads with the engine's single highest-impact recommendation
// across all active campaigns for the active brand.
//
// Data flow:
//  1. Load campaign_workspaces for active brand where meta_campaign_ids is set
//     and status != 'draft' (same shape as Data.tsx).
//  2. For each, invoke `evaluate-campaign-status` with { brandId, metaCampaignId }.
//  3. Collect topRecommendation from every result; pick the one with the
//     highest `recommendation.impact`. Render hero card from it.
// ============================================================================

type Status =
  | "learning"
  | "scaling_ready"
  | "performing"
  | "promising"
  | "underperforming"
  | "fatigued"
  | "spend_starved";

interface AdEval {
  id: string;
  name: string;
  level: "campaign" | "adset" | "ad";
  status: Status;
  primary: { value: number | null; vsGoalPct: number | null; trendDirection?: string };
  secondary: { value: number | null; label: string } | null;
  reach?: number;
  daysLive?: number;
  recommendation: {
    action: string;
    reasoning: string;
    confidence: "high" | "medium" | "low";
    impact: number;
    impactReasoning: string;
  };
}

interface EngineResult {
  success?: boolean;
  workspaceId?: string;
  meta: {
    primaryKpi: string;
    primaryKpiLabel: string;
    primaryGoal: number | null;
    secondaryKpi: string | null;
    campaignType?: string;
  };
  campaign: AdEval;
  adsets: AdEval[];
  ads: AdEval[];
  topRecommendation: AdEval | null;
}


const STATUS_STYLE: Record<Status, { label: string; cls: string }> = {
  scaling_ready: { label: "Scaling ready", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  performing: { label: "Performing", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  promising: { label: "Promising", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  learning: { label: "Learning", cls: "bg-muted text-muted-foreground border-border" },
  fatigued: { label: "Fatigued", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  spend_starved: { label: "Spend starved", cls: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  underperforming: { label: "Underperforming", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

const ACTION_VERB: Record<string, string> = {
  turn_off: "Turn off",
  promote_to_scaling: "Promote to scaling",
  add_similar_variants: "Add more like",
  increase_budget: "Increase budget on",
  hold: "Hold steady on",
  wait: "Give more time to",
  refresh_creative: "Refresh creative for",
  push_delivery: "Push delivery on",
  broaden_audience: "Broaden audience on",
  reduce_budget: "Reduce budget on",
};

function formatKpi(kpi: string, value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (kpi === "roas") return `${value.toFixed(2)}×`;
  if (kpi === "ctr") return `${value.toFixed(2)}%`;
  return `$${value.toFixed(2)}`;
}

export default function Performance() {
  const navigate = useNavigate();
  const { activeBrand, loading: brandLoading } = useBrand();

  const [results, setResults] = useState<EngineResult[]>([]);
  const [chosen, setChosen] = useState<{ result: EngineResult; rec: AdEval } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasActive, setHasActive] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pausing, setPausing] = useState(false);

  // Budget update dialog state
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetLoadingPreview, setBudgetLoadingPreview] = useState(false);
  const [budgetSubmitting, setBudgetSubmitting] = useState(false);
  const [budgetPreview, setBudgetPreview] = useState<{
    isCBO: boolean;
    level: string;
    current: number | null;
    adSetId: string | null;
  } | null>(null);
  const [newBudgetInput, setNewBudgetInput] = useState<string>("");
  const [budgetActionKind, setBudgetActionKind] = useState<"increase_budget" | "reduce_budget">("increase_budget");

  // Refresh creative dialog state
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [refreshSubmitting, setRefreshSubmitting] = useState(false);
  const [benchCandidates, setBenchCandidates] = useState<Array<{ id: string; meta_ad_id: string; production_item_id: string | null }>>([]);
  const [selectedBenchId, setSelectedBenchId] = useState<string>("");



  useEffect(() => {
    if (brandLoading || !activeBrand) return;
    let cancelled = false;
    setLoading(true);
    setResults([]);
    setChosen(null);

    (async () => {
      try {
        const { data: workspaces, error } = await supabase
          .from("campaign_workspaces")
          .select("id, name, meta_campaign_ids, meta_campaign_status")
          .eq("brand_id", activeBrand.id)
          .not("meta_campaign_ids", "is", null)
          .order("created_at", { ascending: false });
        if (error) throw error;

        const active = (workspaces || []).filter((w: any) => {
          const cid = (w.meta_campaign_ids as any)?.campaignId;
          if (!cid) return false;
          if (typeof cid === "string" && cid.includes("_")) {
            const parts = cid.split("_");
            const ts = parseInt(parts[parts.length - 1]);
            const now = Date.now();
            if (ts > now - 365 * 86400000 && ts <= now) return false;
          }
          if ((w.meta_campaign_status || "").toLowerCase() === "draft") return false;
          return true;
        });

        if (cancelled) return;
        setHasActive(active.length > 0);
        if (active.length === 0) {
          setLoading(false);
          return;
        }

        // Load un-expired snoozed ad_ids for this brand
        const nowIso = new Date().toISOString();
        const { data: overrides } = await supabase
          .from("recommendation_overrides")
          .select("ad_id, snooze_until")
          .eq("brand_id", activeBrand.id)
          .eq("user_action", "snoozed")
          .gt("snooze_until", nowIso);
        const snoozedIds = new Set((overrides || []).map((o: any) => o.ad_id).filter(Boolean));

        const settled = await Promise.allSettled(
          active.map((w: any) =>
            supabase.functions
              .invoke("evaluate-campaign-status", {
                body: {
                  brandId: activeBrand.id,
                  metaCampaignId: (w.meta_campaign_ids as any).campaignId,
                },
              })
              .then((res) => ({ res, workspaceId: w.id as string })),
          ),
        );
        if (cancelled) return;

        const ok: EngineResult[] = [];
        settled.forEach((s) => {
          if (s.status === "fulfilled" && s.value.res.data && !(s.value.res as any).error) {
            const d = s.value.res.data as any;
            if (d && d.campaign) ok.push({ ...d, workspaceId: s.value.workspaceId } as EngineResult);
          }
        });
        setResults(ok);

        // Mirror actionable topRecommendations into the task system so the
        // tray surfaces them. Dedupe is handled inside upsertRecommendationTasks.
        try {
          const recsForTasks: RecForTask[] = [];
          for (const r of ok) {
            const t = r.topRecommendation;
            if (!t) continue;
            if (snoozedIds.has(t.id)) continue;
            const action = t.recommendation?.action;
            if (!action) continue;
            let hasBench = false;
            if (action === "refresh_creative") {
              const { count } = await supabase
                .from("creative_bench")
                .select("id", { count: "exact", head: true })
                .eq("brand_id", activeBrand.id)
                .eq("workspace_id", r.workspaceId!)
                .in("status", ["bench", "paused", "retesting"])
                .not("meta_ad_id", "is", null);
              hasBench = (count || 0) > 0;
            }
            recsForTasks.push({
              entityId: t.id,
              entityName: t.name,
              entityLevel: t.level,
              workspaceId: r.workspaceId!,
              brandId: activeBrand.id,
              action,
              reasoning: t.recommendation?.reasoning || "",
              hasBench,
            });
          }
          await upsertRecommendationTasks(recsForTasks);
        } catch (e) {
          console.warn("[performance] task upsert failed", e);
        }

        let best: { result: EngineResult; rec: AdEval } | null = null;
        for (const r of ok) {
          const t = r.topRecommendation;
          if (!t) continue;
          if (snoozedIds.has(t.id)) continue;
          const impact = t.recommendation?.impact ?? 0;
          if (!best || impact > (best.rec.recommendation?.impact ?? 0)) {
            best = { result: r, rec: t };
          }
        }
        setChosen(best);
      } catch (e: any) {
        console.error("[performance] load error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeBrand, brandLoading]);

  const heroTitle = useMemo(() => {
    if (!chosen) return "";
    const verb = ACTION_VERB[chosen.rec.recommendation.action] || chosen.rec.recommendation.action;
    return `${verb} "${chosen.rec.name}"`;
  }, [chosen]);

  async function handleSnooze() {
    if (!chosen || !activeBrand) return;
    const until = new Date();
    until.setDate(until.getDate() + 5);
    setSnoozedUntil(until.toISOString());
    toast.success("Snoozed for 5 days", {
      description: "We'll resurface this on " + until.toLocaleDateString() + ".",
    });
    try {
      await supabase.from("recommendation_overrides").insert({
        brand_id: activeBrand.id,
        ad_id: chosen.rec.id,
        recommendation_action: chosen.rec.recommendation.action,
        user_action: "snoozed",
        snooze_until: until.toISOString(),
      });
    } catch (e) {
      console.error("snooze persist error", e);
    }
  }

  async function handleDoIt() {
    if (!chosen) return;
    const action = chosen.rec.recommendation.action;
    if (action === "turn_off") {
      setConfirmOpen(true);
      return;
    }
    if (action === "increase_budget" || action === "reduce_budget") {
      await openBudgetDialog(action);
      return;
    }
    if (action === "refresh_creative") {
      await openRefreshDialog();
      return;
    }
    if (action === "promote_to_scaling") {
      toast.message("Set up scaling", {
        description: chosen.rec.recommendation.reasoning,
      });
      navigate("/launch", { state: { recommendation: chosen.rec, workspaceId: chosen.result.workspaceId } });
      return;
    }
    const creativeActions = new Set(["add_similar_variants"]);
    const dest = creativeActions.has(action) ? "/creative" : "/data";
    toast.message("Here's how to do it", {
      description: chosen.rec.recommendation.reasoning,
    });
    navigate(dest);
  }

  function removeChosenFromQueue() {
    if (!chosen) return;
    const id = chosen.rec.id;
    let best: { result: EngineResult; rec: AdEval } | null = null;
    for (const r of results) {
      const t = r.topRecommendation;
      if (!t || t.id === id) continue;
      const impact = t.recommendation?.impact ?? 0;
      if (!best || impact > (best.rec.recommendation?.impact ?? 0)) {
        best = { result: r, rec: t };
      }
    }
    setChosen(best);
  }

  async function logOverride(action: string, user_action: string) {
    if (!activeBrand || !chosen) return;
    try {
      await supabase.from("recommendation_overrides").insert({
        brand_id: activeBrand.id,
        ad_id: chosen.rec.id,
        recommendation_action: action,
        user_action,
      });
    } catch (e) {
      console.error("override log error", e);
    }
  }

  // -----------------------------------------------------------------
  // Budget update flow (increase_budget / reduce_budget)
  // -----------------------------------------------------------------
  async function openBudgetDialog(kind: "increase_budget" | "reduce_budget") {
    if (!chosen || !activeBrand) return;
    setBudgetActionKind(kind);
    setBudgetPreview(null);
    setNewBudgetInput("");
    setBudgetOpen(true);
    setBudgetLoadingPreview(true);
    try {
      const adSetId = chosen.rec.level === "adset" ? chosen.rec.id : undefined;
      const { data, error } = await supabase.functions.invoke("update-meta-budget", {
        body: {
          workspaceId: chosen.result.workspaceId,
          adSetId,
          preview: true,
        },
      });
      if (error || !data?.success) {
        const msg = error?.message || data?.error || "Couldn't read current budget";
        toast.error("Couldn't read current budget", { description: msg });
        setBudgetOpen(false);
        return;
      }
      const current: number | null = data.current_daily_budget;
      const proposed = current
        ? Math.max(1, Math.round((kind === "increase_budget" ? current * 1.25 : current * 0.75)))
        : kind === "increase_budget" ? 25 : 10;
      setBudgetPreview({
        isCBO: !!data.isCBO,
        level: data.level,
        current,
        adSetId: data.ad_set_id ?? null,
      });
      setNewBudgetInput(String(proposed));
    } catch (e: any) {
      toast.error("Couldn't read current budget", { description: e?.message || "Unknown error" });
      setBudgetOpen(false);
    } finally {
      setBudgetLoadingPreview(false);
    }
  }

  async function confirmBudget() {
    if (!chosen || !activeBrand || !budgetPreview) return;
    const newBudget = parseFloat(newBudgetInput);
    if (!Number.isFinite(newBudget) || newBudget < 1) {
      toast.error("Enter a valid daily budget (min $1).");
      return;
    }
    setBudgetSubmitting(true);
    try {
      const adSetIdInitial = budgetPreview.isCBO
        ? undefined
        : chosen.rec.level === "adset"
          ? chosen.rec.id
          : undefined;

      const callUpdate = async (adSetId?: string) =>
        supabase.functions.invoke("update-meta-budget", {
          body: {
            workspaceId: chosen.result.workspaceId,
            newBudget,
            adSetId,
          },
        });

      let { data, error } = await callUpdate(adSetIdInitial);
      // CBO refusal: retry without adSetId
      const cboRefusal =
        data?.error && typeof data.error === "string" && /Campaign Budget Optimization \(CBO\)/i.test(data.error);
      if (cboRefusal && adSetIdInitial) {
        ({ data, error } = await callUpdate(undefined));
      }

      if (error) {
        toast.error("Couldn't update budget in Meta", { description: error.message });
        return;
      }
      if (!data?.success) {
        toast.error("Couldn't update budget in Meta", { description: data?.error || "Unknown error" });
        return;
      }
      toast.success(`Budget updated to $${newBudget}/day in Meta`);
      await closeMatchingTasks({ actionType: "budget", entityId: chosen.rec.id });
      await logOverride(budgetActionKind, "modified");
      removeChosenFromQueue();
      setBudgetOpen(false);
    } catch (e: any) {
      toast.error("Couldn't update budget in Meta", { description: e?.message || "Unknown error" });
    } finally {
      setBudgetSubmitting(false);
    }
  }

  // -----------------------------------------------------------------
  // Refresh creative flow
  // -----------------------------------------------------------------
  async function openRefreshDialog() {
    if (!chosen || !activeBrand) return;
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("creative_bench")
        .select("id, meta_ad_id, production_item_id, retest_eligible_at, status")
        .eq("brand_id", activeBrand.id)
        .eq("workspace_id", chosen.result.workspaceId)
        .in("status", ["bench", "paused", "retesting"])
        .not("meta_ad_id", "is", null);
      if (error) throw error;
      const candidates = (data || [])
        .filter((r: any) => !r.retest_eligible_at || r.retest_eligible_at <= nowIso)
        .map((r: any) => ({ id: r.id, meta_ad_id: r.meta_ad_id, production_item_id: r.production_item_id }));

      if (candidates.length === 0) {
        toast.message("No fresh creative is ready to swap in — let's make one.");
        navigate("/creative", {
          state: { recommendation: chosen.rec, workspaceId: chosen.result.workspaceId },
        });
        return;
      }
      setBenchCandidates(candidates);
      setSelectedBenchId(candidates[0].id);
      setRefreshOpen(true);
    } catch (e: any) {
      toast.error("Couldn't load bench creatives", { description: e?.message || "Unknown error" });
    }
  }

  async function confirmRefresh() {
    if (!chosen || !activeBrand) return;
    const picked = benchCandidates.find((c) => c.id === selectedBenchId);
    if (!picked) {
      toast.error("Pick a creative to swap in.");
      return;
    }
    setRefreshSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("rotate-creative", {
        body: {
          workspaceId: chosen.result.workspaceId,
          brandId: activeBrand.id,
          fatigueAdId: chosen.rec.id,
          benchAdId: picked.meta_ad_id,
          reason: chosen.rec.recommendation.reasoning,
          isAutoRotation: false,
        },
      });
      if (error) {
        toast.error("Couldn't rotate creative in Meta", { description: error.message });
        return;
      }
      if (!data?.success) {
        toast.error("Couldn't rotate creative in Meta", { description: data?.error || "Unknown error" });
        return;
      }
      toast.success("Creative swapped in Meta");
      await closeMatchingTasks({ actionType: "rotate", entityId: chosen.rec.id });
      await logOverride("refresh_creative", "modified");
      removeChosenFromQueue();
      setRefreshOpen(false);
    } catch (e: any) {
      toast.error("Couldn't rotate creative in Meta", { description: e?.message || "Unknown error" });
    } finally {
      setRefreshSubmitting(false);
    }
  }



  async function confirmPause() {
    if (!chosen || !activeBrand) return;
    setPausing(true);
    try {
      const { data, error } = await supabase.functions.invoke("pause-meta-entity", {
        body: {
          workspaceId: chosen.result.workspaceId,
          brandId: activeBrand.id,
          entityId: chosen.rec.id,
          entityLevel: chosen.rec.level,
          reason: chosen.rec.recommendation.reasoning,
        },
      });
      if (error) {
        toast.error("Couldn't pause in Meta", { description: error.message });
        return;
      }
      if (!data?.success) {
        toast.error("Couldn't pause in Meta", { description: data?.error || "Unknown error" });
        return;
      }
      toast.success("Paused in Meta");
      try {
        await supabase.from("recommendation_overrides").insert({
          brand_id: activeBrand.id,
          ad_id: chosen.rec.id,
          recommendation_action: "turn_off",
          user_action: "turned_off_anyway",
        });
      } catch (e) {
        console.error("override log error", e);
      }
      const pausedId = chosen.rec.id;
      let best: { result: EngineResult; rec: AdEval } | null = null;
      for (const r of results) {
        const t = r.topRecommendation;
        if (!t || t.id === pausedId) continue;
        const impact = t.recommendation?.impact ?? 0;
        if (!best || impact > (best.rec.recommendation?.impact ?? 0)) {
          best = { result: r, rec: t };
        }
      }
      setChosen(best);
      setConfirmOpen(false);
    } catch (e: any) {
      toast.error("Couldn't pause in Meta", { description: e?.message || "Unknown error" });
    } finally {
      setPausing(false);
    }
  }

  const campaign = chosen?.result.campaign;
  const meta = chosen?.result.meta;
  const ads = chosen?.result.ads ?? [];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <CampaignSpine currentStep={4} />

        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{campaign?.name || "Performance"}</h1>
            <p className="text-sm text-muted-foreground">
              Your daily look at what's working and what to do next.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/retrospectives")} className="gap-2">
            <History className="h-4 w-4" />
            History
          </Button>
        </div>

        {loading && (
          <Card>
            <CardContent className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading the room…
            </CardContent>
          </Card>
        )}

        {!loading && (!hasActive || !chosen) && (
          <Card>
            <CardContent className="py-10 text-center space-y-2">
              <Sparkles className="h-6 w-6 text-lumi-pink-1 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Once your ads have run a few days, LUMI's recommendation shows up here. ✨
              </p>
              {hasActive && (
                <Button variant="link" onClick={() => navigate("/data")} className="gap-2">
                  <BarChart2 className="h-4 w-4" />
                  See all metrics
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {!loading && chosen && (
          <>
            {/* Hero: the one thing this week */}
            <Card className="relative overflow-hidden border-transparent">
              <div
                aria-hidden
                className="absolute inset-0 rounded-lg p-[1.5px] bg-gradient-to-br from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 [mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)] [mask-composite:exclude]"
              />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-lumi-pink-1" />
                  The one thing this week
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    {chosen.rec.level === "campaign" ? "Campaign" : chosen.rec.level === "adset" ? "Ad set" : "Ad"}
                  </div>
                  <div className="text-lg font-semibold">{heroTitle}</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {chosen.rec.recommendation.reasoning}
                  </p>
                  {chosen.rec.recommendation.impactReasoning && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      {chosen.rec.recommendation.impactReasoning}
                    </p>
                  )}
                </div>

                {whyOpen && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                    <div>
                      <strong className="text-foreground">Confidence:</strong>{" "}
                      {chosen.rec.recommendation.confidence}
                    </div>
                    <div>
                      <strong className="text-foreground">Status:</strong>{" "}
                      {STATUS_STYLE[chosen.rec.status]?.label || chosen.rec.status}
                    </div>
                    {chosen.rec.daysLive != null && (
                      <div>
                        <strong className="text-foreground">Days live:</strong> {chosen.rec.daysLive}
                      </div>
                    )}
                  </div>
                )}

                {snoozedUntil && (
                  <div className="text-xs text-muted-foreground italic">
                    Snoozed until {new Date(snoozedUntil).toLocaleDateString()}.
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleDoIt} className="gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {(() => {
                      const a = chosen.rec.recommendation.action;
                      if (a === "turn_off") return "Do it";
                      if (a === "increase_budget" || a === "reduce_budget") return "Update budget";
                      if (a === "refresh_creative") return "Swap creative";
                      if (a === "promote_to_scaling") return "Set up scaling";
                      return "Show me how";
                    })()}
                  </Button>
                  <Button variant="outline" onClick={() => setWhyOpen((v) => !v)} className="gap-2">
                    <HelpCircle className="h-4 w-4" />
                    Why?
                  </Button>
                  <Button variant="ghost" onClick={handleSnooze} className="gap-2">
                    <Clock className="h-4 w-4" />
                    Snooze 5 days
                  </Button>
                </div>
              </CardContent>
            </Card>

            <AlertDialog open={confirmOpen} onOpenChange={(o) => !pausing && setConfirmOpen(o)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Pause this {chosen.rec.level} "{chosen.rec.name}"?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    It will stop spending in Meta immediately. You can re-enable it any time in Meta or from See all metrics.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={pausing}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      confirmPause();
                    }}
                    disabled={pausing}
                  >
                    {pausing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Pausing…
                      </>
                    ) : (
                      "Pause it in Meta"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Budget update dialog */}
            <AlertDialog
              open={budgetOpen}
              onOpenChange={(o) => !budgetSubmitting && !budgetLoadingPreview && setBudgetOpen(o)}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {budgetActionKind === "increase_budget" ? "Increase budget" : "Reduce budget"} on "{chosen.rec.name}"?
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3 pt-2">
                      {budgetLoadingPreview && (
                        <div className="flex items-center gap-2 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Reading current budget from Meta…
                        </div>
                      )}
                      {!budgetLoadingPreview && budgetPreview && (
                        <>
                          <div className="text-sm">
                            <span className="font-medium text-foreground">
                              Current: ${budgetPreview.current?.toFixed(2) ?? "—"}/day
                            </span>{" "}
                            <span className="text-muted-foreground">
                              on {budgetPreview.isCBO ? "the campaign (CBO)" : budgetPreview.level === "adset" || budgetPreview.level === "adset_single" ? "this ad set" : "the campaign"}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="new-budget" className="text-foreground">New daily budget (USD)</Label>
                            <Input
                              id="new-budget"
                              type="number"
                              min={1}
                              step="1"
                              value={newBudgetInput}
                              onChange={(e) => setNewBudgetInput(e.target.value)}
                              disabled={budgetSubmitting}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This will change spend in Meta immediately. Meta's learning may reset after large changes.
                          </p>
                        </>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={budgetSubmitting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      confirmBudget();
                    }}
                    disabled={budgetSubmitting || budgetLoadingPreview || !budgetPreview}
                  >
                    {budgetSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Updating…
                      </>
                    ) : (
                      "Update budget in Meta"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Refresh creative dialog */}
            <AlertDialog
              open={refreshOpen}
              onOpenChange={(o) => !refreshSubmitting && setRefreshOpen(o)}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Swap to a fresh creative?
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3 pt-2">
                      <div className="text-sm">
                        This pauses <span className="font-medium text-foreground">"{chosen.rec.name}"</span> and activates the selected bench creative in Meta.
                      </div>
                      {benchCandidates.length > 1 ? (
                        <RadioGroup value={selectedBenchId} onValueChange={setSelectedBenchId} className="space-y-2">
                          {benchCandidates.map((c) => (
                            <div key={c.id} className="flex items-center gap-2 rounded-md border p-2">
                              <RadioGroupItem value={c.id} id={`bench-${c.id}`} />
                              <Label htmlFor={`bench-${c.id}`} className="text-sm font-normal cursor-pointer">
                                <span className="font-medium text-foreground">Ad {c.meta_ad_id}</span>
                                {c.production_item_id ? ` · ${c.production_item_id}` : ""}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      ) : (
                        benchCandidates[0] && (
                          <div className="rounded-md border p-2 text-sm">
                            <span className="font-medium text-foreground">Ad {benchCandidates[0].meta_ad_id}</span>
                            {benchCandidates[0].production_item_id ? ` · ${benchCandidates[0].production_item_id}` : ""}
                          </div>
                        )
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={refreshSubmitting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      confirmRefresh();
                    }}
                    disabled={refreshSubmitting || !selectedBenchId}
                  >
                    {refreshSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Swapping…
                      </>
                    ) : (
                      "Swap in Meta"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>


            {/* KPI cards from the chosen campaign */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <KpiCard
                icon={<Target className="h-4 w-4" />}
                label={meta?.primaryKpiLabel || "Primary KPI"}
                value={formatKpi(meta?.primaryKpi || "", campaign?.primary.value ?? null)}
                hint={
                  meta?.primaryGoal != null
                    ? `Goal ${formatKpi(meta.primaryKpi, meta.primaryGoal)}`
                    : undefined
                }
              />
              {campaign?.secondary && (
                <KpiCard
                  icon={<Target className="h-4 w-4" />}
                  label={campaign.secondary.label}
                  value={formatKpi(meta?.secondaryKpi || "", campaign.secondary.value)}
                />
              )}
              <KpiCard
                icon={<Target className="h-4 w-4" />}
                label="Status"
                value={STATUS_STYLE[campaign!.status]?.label || campaign!.status}
              />
            </div>

            {/* Your ads right now */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your ads right now</CardTitle>
              </CardHeader>
              <CardContent>
                {ads.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No ads in this window.</p>
                ) : (
                  <ul className="divide-y">
                    {ads.map((ad) => {
                      const s = STATUS_STYLE[ad.status] ?? STATUS_STYLE.learning;
                      return (
                        <li key={ad.id} className="py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{ad.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {formatKpi(meta?.primaryKpi || "", ad.primary.value)}
                              {ad.daysLive != null && ` · ${ad.daysLive}d live`}
                              {ad.reach != null && ` · ${ad.reach.toLocaleString()} reach`}
                            </div>
                          </div>
                          <Badge variant="outline" className={cn("flex-shrink-0", s.cls)}>
                            {s.label}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="text-center">
              <Button variant="link" onClick={() => navigate("/data")} className="gap-2">
                <BarChart2 className="h-4 w-4" />
                See all metrics
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <div className="text-xl font-semibold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
