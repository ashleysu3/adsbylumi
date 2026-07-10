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
import { supabase } from "@/integrations/supabase/client";
import { LeadQualityCheck } from "@/components/insights/LeadQualityCheck";
import { AdFitReviewTaskCard } from "@/components/insights/AdFitReviewTaskCard";
import { MetaImportBridgeBanner } from "@/components/insights/MetaImportBridgeBanner";
import { useBrand } from "@/contexts/BrandContext";
import { toast } from "sonner";
import {
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Clock,
  History,
  Loader2,
  BarChart2,
  DollarSign,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { upsertRecommendationTasks, closeMatchingTasks, RecForTask } from "@/lib/task-executors";
import { DateRangePicker } from "@/components/insights/DateRangePicker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Target } from "lucide-react";
import { format } from "date-fns";
import { SetupPrompt } from "@/components/SetupPrompt";
import { GoalSetupModal } from "@/components/insights/GoalSetupModal";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Zap } from "lucide-react";


// ============================================================================
// /ad-performance — Live Ads "Big Picture"
//
// Top: up to 3 highest-impact recommendations across all active campaigns,
//      each with Approve (wired to the existing task/execute confirm path).
// Below: one card per active campaign with purpose, measure of success,
//      KPI summary, and the campaign's top recommendation in plain English.
//      Card click → /live-ads/:workspaceId (Closer Look, built next).
// ============================================================================

type Status =
  | "learning"
  | "scaling_ready"
  | "performing"
  | "promising"
  | "underperforming"
  | "fatigued"
  | "spend_starved";

interface WindowSnapshot {
  spend: number;
  results: number;
  kpiValue: number | null;
}

interface KpiEntry {
  kpi: string;
  label: string;
  value: number | null;
  goal: number;
  vsGoalPct: number | null;
  direction: "less_than" | "greater_than";
  status: "above" | "below" | "at" | "no_data";
  isDefault: boolean;
}

interface AdEval {
  id: string;
  name: string;
  level: "campaign" | "adset" | "ad";
  status: Status;
  primary: { value: number | null; vsGoalPct: number | null; trendDirection?: string };
  secondary: { value: number | null; label: string } | null;
  kpis?: KpiEntry[];
  reach?: number;
  frequency?: number;
  daysLive?: number;
  windows?: { short: WindowSnapshot; medium: WindowSnapshot; long: WindowSnapshot };
  recommendation: {
    action: string;
    reasoning: string;
    confidence: "high" | "medium" | "low";
    impact: number;
    impactReasoning: string;
    priorityTier?: number;
    diagnosis?: {
      rootCause: string;
      why: string;
      signals: string[];
      primaryAction: string;
      confidence: "high" | "medium" | "low";
      needsConversionTracking?: boolean;
    };
  };
}

interface EngineResult {
  success?: boolean;
  workspaceId?: string;
  workspaceName?: string;
  meta: {
    primaryKpi: string;
    primaryKpiLabel: string;
    primaryGoal: number | null;
    secondaryKpi: string | null;
    goals?: { kpi: string; label: string; goal: number; direction: string; isDefault: boolean }[];
    hasUserGoals?: boolean;
    campaignType?: string;
    objective?: string | null;
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

// Plain-English purpose statements keyed by Meta objective. Covers both the
// modern OUTCOME_* values and the older legacy objective names.
const OBJECTIVE_PURPOSE: Record<string, string> = {
  OUTCOME_SALES: "Get in front of cold audiences and drive purchases of your offer.",
  OUTCOME_LEADS: "Reach cold audiences and collect new leads for your offer.",
  OUTCOME_TRAFFIC: "Send cold audiences to your website and grow awareness of your offer.",
  OUTCOME_ENGAGEMENT: "Get more people interacting with your content (messages, likes, comments, shares).",
  OUTCOME_AWARENESS: "Put your brand in front of as many of the right people as possible.",
  OUTCOME_APP_PROMOTION: "Drive installs and activity for your app.",
  // Legacy objective names
  CONVERSIONS: "Get in front of cold audiences and drive purchases or sign-ups for your offer.",
  LEAD_GENERATION: "Reach cold audiences and collect new leads for your offer.",
  LINK_CLICKS: "Send cold audiences to your website and grow awareness of your offer.",
  TRAFFIC: "Send cold audiences to your website and grow awareness of your offer.",
  POST_ENGAGEMENT: "Get more people interacting with your content (messages, likes, comments, shares).",
  MESSAGES: "Start more conversations with potential customers in DMs.",
  VIDEO_VIEWS: "Get your video in front of more of the right people.",
  REACH: "Put your brand in front of as many of the right people as possible.",
  BRAND_AWARENESS: "Put your brand in front of as many of the right people as possible.",
};

function purposeLine(objective?: string | null, primaryKpi?: string): string {
  if (objective && OBJECTIVE_PURPOSE[objective]) return OBJECTIVE_PURPOSE[objective];
  // Fallback by primary KPI when objective is missing/unknown.
  switch (primaryKpi) {
    case "roas":
    case "cpp":
      return "Get in front of cold audiences and drive purchases of your offer.";
    case "cpl":
      return "Reach cold audiences and collect new leads for your offer.";
    case "cpc":
    case "ctr":
      return "Send cold audiences to your website and grow awareness of your offer.";
    default:
      return "Drive results from this campaign.";
  }
}

function formatKpi(kpi: string, value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (kpi === "roas") return `${value.toFixed(2)}×`;
  if (kpi === "ctr") return `${value.toFixed(2)}%`;
  if (kpi === "frequency") return value.toFixed(2);
  return `$${value.toFixed(2)}`;
}

function TrendArrow({ kpi, vsGoalPct, direction }: { kpi: string; vsGoalPct: number | null; direction?: string }) {
  // direction (if provided) is "up"/"down"/"flat" from the engine.
  // Higher-is-better KPIs: roas, ctr. Lower-is-better: cost-based, frequency.
  const higherIsBetter = kpi === "roas" || kpi === "ctr";
  let arrow: "up" | "down" | "flat" | null = null;
  if (direction === "up" || direction === "down" || direction === "flat") {
    arrow = direction as any;
  } else if (vsGoalPct != null) {
    arrow = vsGoalPct > 5 ? "up" : vsGoalPct < -5 ? "down" : "flat";
  }
  if (!arrow) return null;
  const good = arrow === "flat" ? true : higherIsBetter ? arrow === "up" : arrow === "down";
  const color = arrow === "flat" ? "text-muted-foreground" : good ? "text-emerald-600" : "text-amber-600";
  const Icon = arrow === "up" ? TrendingUp : arrow === "down" ? TrendingDown : Minus;
  return <Icon className={cn("h-3.5 w-3.5", color)} />;
}

export default function Performance() {
  const navigate = useNavigate();
  const { activeBrand, loading: brandLoading } = useBrand();

  const [results, setResults] = useState<EngineResult[]>([]);
  const [chosen, setChosen] = useState<{ result: EngineResult; rec: AdEval } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasActive, setHasActive] = useState(false);
  const [whyOpenId, setWhyOpenId] = useState<string | null>(null);
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [goalModalFor, setGoalModalFor] = useState<EngineResult | null>(null);
  const [quickListOpen, setQuickListOpen] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);


  // Date range — persists in localStorage. "3" | "7" | "14" | "30" (preset days)
  // or "custom" with a customDateRange. Default: last 7 days.
  const [dateRange, setDateRange] = useState<string>(() => {
    try { return localStorage.getItem("liveAdsDateRange") || "7"; } catch { return "7"; }
  });
  const [customDateRange, setCustomDateRange] = useState<{ from: Date; to: Date } | null>(() => {
    try {
      const raw = localStorage.getItem("liveAdsCustomDateRange");
      if (!raw) return null;
      const p = JSON.parse(raw);
      return p?.from && p?.to ? { from: new Date(p.from), to: new Date(p.to) } : null;
    } catch { return null; }
  });
  useEffect(() => { try { localStorage.setItem("liveAdsDateRange", dateRange); } catch { /* noop */ } }, [dateRange]);
  useEffect(() => {
    try {
      if (customDateRange) localStorage.setItem("liveAdsCustomDateRange", JSON.stringify({ from: customDateRange.from.toISOString(), to: customDateRange.to.toISOString() }));
      else localStorage.removeItem("liveAdsCustomDateRange");
    } catch { /* noop */ }
  }, [customDateRange]);

  // Resolve the active display range to { since, until } (UTC date strings)
  // and a friendly label for the "Showing: …" line.
  const activeRange = useMemo(() => {
    const fmtDay = (d: Date) => d.toISOString().slice(0, 10);
    const fmtLabel = (d: Date) => format(d, "MMM d");
    if (dateRange === "custom" && customDateRange?.from && customDateRange?.to) {
      const from = customDateRange.from;
      const to = customDateRange.to;
      const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
      return {
        since: fmtDay(from),
        until: fmtDay(to),
        days,
        label: `custom (${fmtLabel(from)}–${fmtLabel(to)})`,
        body: { since: fmtDay(from), until: fmtDay(to) },
      };
    }
    const days = parseInt(dateRange, 10) || 7;
    const until = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    return {
      since: fmtDay(from),
      until: fmtDay(until),
      days,
      label: `last ${days} days (${fmtLabel(from)}–${fmtLabel(until)})`,
      body: { days },
    };
  }, [dateRange, customDateRange]);



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

        // Only show genuinely-live campaigns. Anything paused, archived,
        // deleted, disapproved, or with issues belongs elsewhere (Off / Drafts
        // / health surfaces) and shouldn't be rendered as a live card.
        const LIVE_STATUSES = new Set(['active', 'live']);
        const active = (workspaces || []).filter((w: any) => {
          const cid = (w.meta_campaign_ids as any)?.campaignId;
          if (!cid) return false;
          if (typeof cid === "string" && cid.includes("_")) {
            const parts = cid.split("_");
            const ts = parseInt(parts[parts.length - 1]);
            const now = Date.now();
            if (ts > now - 365 * 86400000 && ts <= now) return false;
          }
          const status = (w.meta_campaign_status || "").toLowerCase();
          // Treat null/empty status as live (legacy rows pre-status tracking)
          // but exclude any explicit non-live state.
          if (status && !LIVE_STATUSES.has(status)) return false;
          return true;
        });


        if (cancelled) return;
        setHasActive(active.length > 0);
        if (active.length === 0) {
          setLoading(false);
          return;
        }

        const nowIso = new Date().toISOString();
        const { data: overrides } = await supabase
          .from("recommendation_overrides")
          .select("ad_id, snooze_until")
          .eq("brand_id", activeBrand.id)
          .eq("user_action", "snoozed")
          .gt("snooze_until", nowIso);
        const snoozed = new Set((overrides || []).map((o: any) => o.ad_id).filter(Boolean));
        setSnoozedIds(snoozed);

        const settled = await Promise.allSettled(
          active.map((w: any) =>
            supabase.functions
              .invoke("evaluate-campaign-status", {
                body: {
                  workspaceId: w.id,
                  brandId: activeBrand.id,
                  metaCampaignId: (w.meta_campaign_ids as any).campaignId,
                  displayRange: activeRange.body,
                },
              })
              .then((res) => ({ res, workspaceId: w.id as string, workspaceName: w.name as string })),
          ),
        );

        if (cancelled) return;

        const ok: EngineResult[] = [];
        settled.forEach((s) => {
          if (s.status === "fulfilled" && s.value.res.data && !(s.value.res as any).error) {
            const d = s.value.res.data as any;
            if (d && d.campaign) {
              // Skip campaigns that have never delivered (no reach) — nothing to show.
              const reach = Number(d.campaign.reach || 0);
              if (reach <= 0) return;
              ok.push({
                ...d,
                workspaceId: s.value.workspaceId,
                workspaceName: s.value.workspaceName,
              } as EngineResult);
            }
          }
        });
        setResults(ok);

        // Mirror actionable topRecommendations into the task system.
        try {
          const recsForTasks: RecForTask[] = [];
          for (const r of ok) {
            const t = r.topRecommendation;
            if (!t) continue;
            if (snoozed.has(t.id)) continue;
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
              adSetId: action === "increase_budget" || action === "reduce_budget" ? budgetTargetAdSetId(action, { result: r, rec: t }) : null,
              impact: t.recommendation?.impact,
              confidence: t.recommendation?.confidence,
              priorityTier: t.recommendation?.priorityTier,
            });
          }
          await upsertRecommendationTasks(recsForTasks);
        } catch (e) {
          console.warn("[live-ads] task upsert failed", e);
        }
      } catch (e: any) {
        console.error("[live-ads] load error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeBrand, brandLoading, activeRange.since, activeRange.until, reloadNonce]);

  // Top 3 across all campaigns, sorted by impact, excluding snoozed.
  const topThree = useMemo(() => {
    const items: Array<{ result: EngineResult; rec: AdEval }> = [];
    for (const r of results) {
      const t = r.topRecommendation;
      if (!t) continue;
      if (snoozedIds.has(t.id)) continue;
      items.push({ result: r, rec: t });
    }
    items.sort((a, b) => (b.rec.recommendation?.impact ?? 0) - (a.rec.recommendation?.impact ?? 0));
    return items.slice(0, 3);
  }, [results, snoozedIds]);

  function recTitle(rec: AdEval) {
    const verb = ACTION_VERB[rec.recommendation.action] || rec.recommendation.action;
    return `${verb} "${rec.name}"`;
  }

  function budgetTargetAdSetId(kind: "increase_budget" | "reduce_budget", ctx: { result: EngineResult; rec: AdEval }) {
    if (ctx.rec.level === "adset") return ctx.rec.id;
    if (ctx.result.meta?.campaignType !== "ABO") return undefined;
    const matching = ctx.result.adsets.find((adset) => adset.recommendation?.action === kind);
    if (matching) return matching.id;
    return [...ctx.result.adsets]
      .sort((a, b) => (b.windows?.medium?.spend ?? 0) - (a.windows?.medium?.spend ?? 0))[0]?.id;
  }

  async function handleSnooze(ctx: { result: EngineResult; rec: AdEval }) {
    if (!activeBrand) return;
    const until = new Date();
    until.setDate(until.getDate() + 5);
    setSnoozedIds((prev) => new Set([...prev, ctx.rec.id]));
    toast.success("Snoozed for 5 days", {
      description: "We'll resurface this on " + until.toLocaleDateString() + ".",
    });
    try {
      await supabase.from("recommendation_overrides").insert({
        brand_id: activeBrand.id,
        ad_id: ctx.rec.id,
        recommendation_action: ctx.rec.recommendation.action,
        user_action: "snoozed",
        snooze_until: until.toISOString(),
      });
    } catch (e) {
      console.error("snooze persist error", e);
    }
  }

  async function handleApprove(ctx: { result: EngineResult; rec: AdEval }) {
    setChosen(ctx);
    const action = ctx.rec.recommendation.action;
    if (action === "turn_off") {
      setConfirmOpen(true);
      return;
    }
    if (action === "increase_budget" || action === "reduce_budget") {
      await openBudgetDialog(action, ctx);
      return;
    }
    if (action === "refresh_creative") {
      await openRefreshDialog(ctx);
      return;
    }
    if (action === "promote_to_scaling") {
      toast.message("Set up scaling", { description: ctx.rec.recommendation.reasoning });
      navigate("/launch", { state: { recommendation: ctx.rec, workspaceId: ctx.result.workspaceId } });
      return;
    }
    const creativeActions = new Set(["add_similar_variants"]);
    const dest = creativeActions.has(action) ? "/creative" : "/data";
    toast.message("Here's how to do it", { description: ctx.rec.recommendation.reasoning });
    navigate(dest);
  }

  function removeFromQueue(id: string) {
    setSnoozedIds((prev) => new Set([...prev, id]));
  }

  async function logOverride(action: string, user_action: string, adId: string) {
    if (!activeBrand) return;
    try {
      await supabase.from("recommendation_overrides").insert({
        brand_id: activeBrand.id,
        ad_id: adId,
        recommendation_action: action,
        user_action,
      });
    } catch (e) {
      console.error("override log error", e);
    }
  }

  async function openBudgetDialog(
    kind: "increase_budget" | "reduce_budget",
    ctx: { result: EngineResult; rec: AdEval },
  ) {
    if (!activeBrand) return;
    setBudgetActionKind(kind);
    setBudgetPreview(null);
    setNewBudgetInput("");
    setBudgetOpen(true);
    setBudgetLoadingPreview(true);
    try {
      const adSetId = budgetTargetAdSetId(kind, ctx);
      const { data, error } = await supabase.functions.invoke("update-meta-budget", {
        body: { workspaceId: ctx.result.workspaceId, adSetId, preview: true },
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
        : budgetPreview.adSetId ?? (chosen.rec.level === "adset" ? chosen.rec.id : undefined);
      const callUpdate = async (adSetId?: string) =>
        supabase.functions.invoke("update-meta-budget", {
          body: { workspaceId: chosen.result.workspaceId, newBudget, adSetId },
        });
      let { data, error } = await callUpdate(adSetIdInitial);
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
      await logOverride(budgetActionKind, "modified", chosen.rec.id);
      removeFromQueue(chosen.rec.id);
      setBudgetOpen(false);
    } catch (e: any) {
      toast.error("Couldn't update budget in Meta", { description: e?.message || "Unknown error" });
    } finally {
      setBudgetSubmitting(false);
    }
  }

  async function openRefreshDialog(ctx: { result: EngineResult; rec: AdEval }) {
    if (!activeBrand) return;
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("creative_bench")
        .select("id, meta_ad_id, production_item_id, retest_eligible_at, status")
        .eq("brand_id", activeBrand.id)
        .eq("workspace_id", ctx.result.workspaceId)
        .in("status", ["bench", "paused", "retesting"])
        .not("meta_ad_id", "is", null);
      if (error) throw error;
      const candidates = (data || [])
        .filter((r: any) => !r.retest_eligible_at || r.retest_eligible_at <= nowIso)
        .map((r: any) => ({ id: r.id, meta_ad_id: r.meta_ad_id, production_item_id: r.production_item_id }));
      if (candidates.length === 0) {
        toast.message("No fresh creative is ready to swap in — let's make one.");
        navigate("/creative", { state: { recommendation: ctx.rec, workspaceId: ctx.result.workspaceId } });
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
      await logOverride("refresh_creative", "modified", chosen.rec.id);
      removeFromQueue(chosen.rec.id);
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
      await closeMatchingTasks({ actionType: "pause", entityId: chosen.rec.id });
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
      removeFromQueue(chosen.rec.id);
      setConfirmOpen(false);
    } catch (e: any) {
      toast.error("Couldn't pause in Meta", { description: e?.message || "Unknown error" });
    } finally {
      setPausing(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Live Ads</h1>
            <p className="text-sm text-muted-foreground">
              Everything running, paused, or off in your Meta account. Created a campaign directly in Meta? Import it to manage it here.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DateRangePicker
              dateRange={dateRange}
              customDateRange={customDateRange}
              onDateRangeChange={setDateRange}
              onCustomDateRangeChange={setCustomDateRange}
            />
            {hasActive && !loading && (
              <Button
                onClick={() => setQuickListOpen(true)}
                className="gap-2 bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 text-white hover:opacity-90"
              >
                <Zap className="h-4 w-4" />
                Short on time? See LUMI's recs
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("/retrospectives")} className="gap-2">
              <History className="h-4 w-4" />
              History
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground -mt-3 flex-wrap">
          <span>
            <span className="font-medium text-foreground">Showing:</span> {activeRange.label}
          </span>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline">
                  <Info className="h-3 w-3" />
                  How LUMI decides
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                Recommendations are based on LUMI's 3 / 7 / 30-day analysis, not this view's date range. The picker only changes which numbers are displayed.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>


        {/* Bridge: live Meta campaigns not yet in LUMI */}
        <MetaImportBridgeBanner surface="live-ads" />

        {loading && (
          <Card>
            <CardContent className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading the room…
            </CardContent>
          </Card>
        )}

        {!loading && !hasActive && (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <Sparkles className="h-6 w-6 text-lumi-pink-1 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Once a campaign is running and has spent a few days collecting data, this is where LUMI tells you what to do next. ✨
              </p>
              <p className="text-xs text-muted-foreground/80">
                Don't see a campaign you're running? If you built it in Meta, import it here to manage it in LUMI.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && hasActive && (
          <>
            {/* THE ONE LIST — up to top 3 highest-impact recommendations */}
            <Card className="border-lumi-pink-1/30">

              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-lumi-pink-1" />
                  {topThree.length > 1 ? "The next few moves worth making" : "The one thing this week"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {topThree.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing urgent right now. Everything's running — check the campaigns below for detail.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {topThree.map((item) => {
                      const a = item.rec.recommendation.action;
                      const approveLabel =
                        a === "turn_off" ? "Approve · Pause it" :
                        a === "increase_budget" || a === "reduce_budget" ? "Approve · Update budget" :
                        a === "refresh_creative" ? "Approve · Swap creative" :
                        a === "promote_to_scaling" ? "Approve · Set up scaling" :
                        "Approve · Show me how";
                      const whyOpen = whyOpenId === item.rec.id;
                      return (
                        <li
                          key={`${item.result.workspaceId}-${item.rec.id}`}
                          className="rounded-lg border bg-card/50 p-3 space-y-2"
                        >
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="capitalize">{item.rec.level === "adset" ? "ad set" : item.rec.level}</span>
                            <span>·</span>
                            <span className="truncate">{item.result.workspaceName || item.result.campaign.name}</span>
                          </div>
                          <div className="text-base font-semibold">{recTitle(item.rec)}</div>
                          <p className="text-sm text-muted-foreground">
                            {item.rec.recommendation.reasoning}
                          </p>
                          {item.rec.recommendation.diagnosis && (
                            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs space-y-1">
                              <div className="font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide text-[10px]">
                                Root cause: {(item.rec.recommendation.diagnosis.rootCause || 'unknown').replace(/_/g, ' ')}
                              </div>
                              {item.rec.recommendation.diagnosis.signals?.length > 0 && (
                                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                                  {item.rec.recommendation.diagnosis.signals.map((s: string, i: number) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ul>
                              )}
                              {item.rec.recommendation.diagnosis.needsConversionTracking && (
                                <div className="text-amber-700 dark:text-amber-300 italic">
                                  Conversion tracking isn't reporting — we can't fully diagnose without it.
                                </div>
                              )}
                            </div>
                          )}
                          {whyOpen && (
                            <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground space-y-0.5">
                              <div>
                                <strong className="text-foreground">Confidence:</strong> {item.rec.recommendation.confidence}
                              </div>
                              <div>
                                <strong className="text-foreground">Status:</strong> {STATUS_STYLE[item.rec.status]?.label || item.rec.status}
                              </div>
                              {item.rec.recommendation.impactReasoning && (
                                <div className="italic">{item.rec.recommendation.impactReasoning}</div>
                              )}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button size="sm" onClick={() => handleApprove(item)} className="gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {approveLabel}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setWhyOpenId((id) => (id === item.rec.id ? null : item.rec.id))}
                              className="gap-2"
                            >
                              <HelpCircle className="h-3.5 w-3.5" />
                              Why?
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleSnooze(item)} className="gap-2">
                              <Clock className="h-3.5 w-3.5" />
                              Snooze 5 days
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* CAMPAIGN CARDS — one per active campaign */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Your live campaigns</h2>
              {results.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Once your ads have run a few days, each campaign shows up here. ✨
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {results.map((r) => {
                    const s = STATUS_STYLE[r.campaign.status] ?? STATUS_STYLE.learning;
                    const primaryVal = formatKpi(r.meta.primaryKpi, r.campaign.primary.value);
                    const goalStr = r.meta.primaryGoal != null
                      ? `goal ${formatKpi(r.meta.primaryKpi, r.meta.primaryGoal)}`
                      : null;
                    const secondaryStr =
                      r.campaign.secondary && r.meta.secondaryKpi
                        ? `${r.campaign.secondary.label}: ${formatKpi(r.meta.secondaryKpi, r.campaign.secondary.value)}`
                        : null;
                    const top = r.topRecommendation;
                    const campRec = r.campaign?.recommendation;
                    const primaryVal2 = r.campaign?.primary?.value;
                    const goal = r.meta.primaryGoal;
                    const dir = (r.meta as any).primaryDirection || "less_than";
                    const primaryMissingGoal =
                      goal != null && primaryVal2 != null &&
                      (dir === "less_than" ? primaryVal2 > goal : primaryVal2 < goal);
                    const primaryIsNull = primaryVal2 == null;
                    // CLIENT GUARD: a card can never say "around target" / "hold steady"
                    // while the primary KPI is null or missing its goal.
                    let topLine: string;
                    if (primaryIsNull) {
                      topLine = `${r.meta.primaryKpiLabel || (r.meta.primaryKpi || "Primary KPI").toUpperCase()} has no value yet — can't judge performance. Likely either too early, or conversion tracking isn't set up for this goal.`;
                    } else if (primaryMissingGoal) {
                      const why = campRec?.diagnosis?.why || campRec?.reasoning || "Primary KPI is below goal — needs attention.";
                      topLine = why;
                    } else if (top) {
                      topLine = `${recTitle(top)} — ${top.recommendation.reasoning}`;
                    } else if (campRec?.reasoning) {
                      topLine = campRec.reasoning;
                    } else {
                      topLine = "Holding steady — no changes needed right now.";
                    }
                    return (
                      <Card
                        key={r.workspaceId}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/live-ads/${r.workspaceId}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/live-ads/${r.workspaceId}`);
                          }
                        }}
                        className="cursor-pointer hover:border-lumi-pink-1/40 hover:shadow-sm transition group"
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <CardTitle className="text-base truncate">
                                  {r.workspaceName || r.campaign.name}
                                </CardTitle>
                                <Badge variant="outline" className={cn("flex-shrink-0", s.cls)}>
                                  {s.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                <span className="font-medium text-foreground">Purpose:</span> {purposeLine(r.meta.objective, r.meta.primaryKpi)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">Measure of success:</span>{" "}
                                {r.meta.primaryKpiLabel}
                                {r.meta.primaryGoal != null && ` (${goalStr})`}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:translate-x-0.5 transition" />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* KPI summary row — reach, frequency, then one cell per configured goal KPI */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                            <KpiPill
                              label="Reach"
                              value={r.campaign.reach != null ? r.campaign.reach.toLocaleString() : "—"}
                            />
                            <KpiPill
                              label="Frequency"
                              value={r.campaign.frequency != null ? r.campaign.frequency.toFixed(2) : "—"}
                              hint={r.campaign.frequency != null && r.campaign.frequency > 4 ? "high" : undefined}
                            />
                            {(r.campaign.kpis || []).map(k => {
                              const valStr = formatKpi(k.kpi, k.value);
                              const goalStr = `goal ${formatKpi(k.kpi, k.goal)}`;
                              const hitting = k.status === "above" || k.status === "at";
                              const cls = k.status === "no_data"
                                ? "text-muted-foreground"
                                : hitting ? "text-emerald-700" : "text-amber-700";
                              return (
                                <KpiPill
                                  key={k.kpi}
                                  label={k.label + (k.isDefault ? " (default)" : "")}
                                  value={valStr}
                                  hint={`${goalStr} ${hitting && k.status !== "no_data" ? "✓" : k.status === "below" ? "✗" : ""}`.trim()}
                                  valueClassName={cls}
                                />
                              );
                            })}
                          </div>
                          {r.meta.hasUserGoals === false && (
                            <SetupPrompt
                              icon={Target}
                              title="Set goals for this campaign"
                              description="So LUMI can measure success against your targets (we're showing benchmark defaults for now)."
                              ctaLabel="Set goals"
                              tone="warning"
                              onCta={() => setGoalModalFor(r)}
                              autoTask={{
                                title: `Set goals for ${r.workspaceName || r.campaign.name}`,
                                link_to: `/live-ads/${r.workspaceId}`,
                              }}
                            />
                          )}
                          <p className="text-sm">
                            <span className="text-muted-foreground">LUMI recommends: </span>
                            <span className="text-foreground">{topLine}</span>
                          </p>

                          {activeBrand && (
                            <AdFitReviewTaskCard
                              workspaceId={r.workspaceId}
                              brandId={activeBrand.id}
                              variant="compact"
                            />
                          )}
                          {activeBrand && (
                            <LeadQualityCheck
                              workspaceId={r.workspaceId}
                              brandId={activeBrand.id}
                              campaignMetaId={(r as any).meta?.metaCampaignId || null}
                              variant="compact"
                            />
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="text-center">
              <Button variant="link" onClick={() => navigate("/data")} className="gap-2">
                <BarChart2 className="h-4 w-4" />
                See all metrics
              </Button>
            </div>

            {/* DIALOGS */}
            {chosen && (
              <>
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
                        onClick={(e) => { e.preventDefault(); confirmPause(); }}
                        disabled={pausing}
                      >
                        {pausing ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Pausing…</>) : "Pause it in Meta"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

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
                        onClick={(e) => { e.preventDefault(); confirmBudget(); }}
                        disabled={budgetSubmitting || budgetLoadingPreview || !budgetPreview}
                      >
                        {budgetSubmitting ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating…</>) : "Update budget in Meta"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={refreshOpen} onOpenChange={(o) => !refreshSubmitting && setRefreshOpen(o)}>
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
                        onClick={(e) => { e.preventDefault(); confirmRefresh(); }}
                        disabled={refreshSubmitting || !selectedBenchId}
                      >
                        {refreshSubmitting ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Swapping…</>) : "Swap in Meta"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </>
        )}
      </div>
      <GoalSetupModal
        open={!!goalModalFor}
        onOpenChange={(o) => { if (!o) setGoalModalFor(null); }}
        campaigns={goalModalFor ? [{
          id: goalModalFor.workspaceId || goalModalFor.campaign.id,
          name: goalModalFor.workspaceName || goalModalFor.campaign.name,
          brandId: activeBrand?.id,
        }] : []}
        onGoalsSaved={() => { setGoalModalFor(null); setReloadNonce((n) => n + 1); }}
      />

      <Sheet open={quickListOpen} onOpenChange={setQuickListOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-lumi-pink-1" /> Quick list
            </SheetTitle>
            <SheetDescription>
              One move per campaign this week. Skim, approve, done.
            </SheetDescription>
          </SheetHeader>

          {(() => {
            type Row = { result: EngineResult; rec: AdEval | null; needsGoals: boolean };
            const rows: Row[] = results.map((r) => ({
              result: r,
              rec: r.topRecommendation,
              needsGoals: r.meta.hasUserGoals === false,
            }));
            const needsAttention = rows.filter(
              (row) => row.needsGoals || (row.rec && row.rec.recommendation.priorityTier <= 3)
            );
            const allGood = rows.filter(
              (row) => !row.needsGoals && (!row.rec || row.rec.recommendation.priorityTier >= 4)
            );

            const renderRow = (row: Row) => {
              const name = row.result.workspaceName || row.result.campaign.name;
              if (row.needsGoals) {
                return (
                  <li key={row.result.workspaceId || name} className="rounded-lg border p-3 space-y-2">
                    <div className="font-medium text-sm">{name}</div>
                    <p className="text-xs text-muted-foreground">
                      No goals set — LUMI can't grade this campaign or recommend a move yet.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => { setQuickListOpen(false); setGoalModalFor(row.result); }}
                      className="gap-2"
                    >
                      <Target className="h-3.5 w-3.5" /> Set goals
                    </Button>
                  </li>
                );
              }
              if (!row.rec) {
                const cRec = row.result.campaign?.recommendation;
                const why = cRec?.diagnosis?.why || cRec?.reasoning || "Holding steady — no recommendation right now.";
                return (
                  <li key={row.result.workspaceId || name} className="rounded-lg border p-3 space-y-1">
                    <div className="font-medium text-sm">{name}</div>
                    <p className="text-xs text-muted-foreground">{why}</p>
                  </li>
                );
              }
              const rec = row.rec;
              const why = rec.recommendation.diagnosis?.why || rec.recommendation.reasoning;
              const a = rec.recommendation.action;
              const approveLabel =
                a === "turn_off" ? "Pause it" :
                a === "increase_budget" || a === "reduce_budget" ? "Update budget" :
                a === "refresh_creative" ? "Swap creative" :
                a === "promote_to_scaling" ? "Set up scaling" :
                a === "hold" || a === "wait" ? "Got it" :
                "Do it";
              const isHold = a === "hold" || a === "wait";
              return (
                <li key={rec.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm">{name}</div>
                    <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLE[rec.status]?.cls)}>
                      {STATUS_STYLE[rec.status]?.label || rec.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{why}</p>
                  <div className="text-xs font-medium">
                    {ACTION_VERB[a] || a} <span className="text-muted-foreground">"{rec.name}"</span>
                  </div>
                  <div className="flex gap-2">
                    {!isHold && (
                      <Button
                        size="sm"
                        onClick={() => { setQuickListOpen(false); handleApprove({ result: row.result, rec }); }}
                        className="gap-2"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> {approveLabel}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setQuickListOpen(false); navigate(`/live-ads/${row.result.workspaceId}`); }}
                    >
                      Details
                    </Button>
                  </div>
                </li>
              );
            };

            return (
              <div className="mt-4 space-y-6">
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Needs attention ({needsAttention.length})
                  </h3>
                  {needsAttention.length === 0 ? (
                    <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3">
                      Nothing urgent. Nice.
                    </p>
                  ) : (
                    <ul className="space-y-2">{needsAttention.map(renderRow)}</ul>
                  )}
                </section>

                {allGood.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      All good ({allGood.length})
                    </h3>
                    <ul className="space-y-2">{allGood.map(renderRow)}</ul>
                  </section>
                )}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}

function KpiPill({
  label,
  value,
  hint,
  trend,
  fallback,
  valueClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: React.ReactNode;
  fallback?: string;
  valueClassName?: string;
}) {
  const display = value === "—" && fallback ? fallback : value;
  return (
    <div className="rounded-md border bg-background/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</div>
      <div className={cn("text-sm font-semibold tabular-nums flex items-center gap-1", valueClassName)}>
        <span className="truncate">{display}</span>
        {trend}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}
