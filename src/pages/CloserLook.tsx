import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import { FatigueGauge } from "@/components/insights/FatigueGauge";
import { getFatigueStatus } from "@/lib/fatigue";
import { TaskExecuteDialog, ExecutableTaskShape } from "@/components/TaskExecuteDialog";
import { BugReportModal } from "@/components/BugReportModal";
import { upsertRecommendationTasks } from "@/lib/task-executors";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  MoreHorizontal,
  Rocket,
  Pause,
  Wand2,
  Brain,
  Layers,
  Bug,
  Lightbulb,
  Heart,
  History,
  Target,
} from "lucide-react";
import { SetupPrompt } from "@/components/SetupPrompt";
import { GoalSetupModal } from "@/components/insights/GoalSetupModal";

// ============================================================================
// /live-ads/:campaignId — Closer Look at one live campaign.
// Reuses evaluate-campaign-status engine, FatigueGauge, TaskExecuteDialog,
// and task-executors. Additive: no new executor logic.
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
  primary: { value: number | null; vsGoalPct: number | null; trendDirection?: "up" | "down" | "flat" };
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
  meta: {
    primaryKpi: string;
    primaryKpiLabel: string;
    primaryGoal: number | null;
    primaryDirection?: "less_than" | "greater_than";
    secondaryKpi: string | null;
    goals?: { kpi: string; label: string; goal: number; direction: string; isDefault: boolean }[];
    hasUserGoals?: boolean;
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

function formatKpi(kpi: string, value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (kpi === "roas") return `${value.toFixed(2)}×`;
  if (kpi === "ctr") return `${value.toFixed(2)}%`;
  if (kpi === "frequency") return value.toFixed(2);
  if (kpi === "cpp") return value.toLocaleString();
  return `$${value.toFixed(2)}`;
}

function TrendArrow({ direction, kpi }: { direction?: string; kpi: string }) {
  if (!direction || direction === "flat") {
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  const higherIsBetter = kpi === "roas" || kpi === "ctr";
  const good = higherIsBetter ? direction === "up" : direction === "down";
  const Icon = direction === "up" ? TrendingUp : TrendingDown;
  return <Icon className={cn("h-3.5 w-3.5", good ? "text-emerald-600" : "text-amber-600")} />;
}

export default function CloserLook() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { activeBrand, loading: brandLoading } = useBrand();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string>("");
  const [actions, setActions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  // Task-execute dialog (shared confirm + execute path)
  const [taskOpen, setTaskOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<ExecutableTaskShape | null>(null);

  const [bugOpen, setBugOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (brandLoading || !activeBrand || !campaignId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setResult(null);
      setWorkspaceId(null);
      try {
        const { data: workspaceRows, error: wsErr } = await supabase
          .from("campaign_workspaces")
          .select("id, name, meta_campaign_ids, brand_id")
          .eq("brand_id", activeBrand.id)
          .not("meta_campaign_ids", "is", null);
        if (wsErr) throw wsErr;
        const ws = (workspaceRows || []).find((row: any) => {
          const metaId = (row.meta_campaign_ids as any)?.campaignId;
          return row.id === campaignId || metaId === campaignId;
        });
        if (!ws) {
          setError("Couldn't find that campaign in your account.");
          return;
        }
        const metaCampaignId = (ws.meta_campaign_ids as any)?.campaignId;
        if (!metaCampaignId) {
          setError("This campaign hasn't been pushed to Meta yet.");
          return;
        }
        setWorkspaceId(ws.id);
        setWorkspaceName(ws.name || "Campaign");

        const { data, error: evalErr } = await supabase.functions.invoke("evaluate-campaign-status", {
          body: { workspaceId: ws.id, brandId: activeBrand.id, metaCampaignId },
        });
        if (cancelled) return;
        if (evalErr || !data?.campaign) {
          setError(evalErr?.message || data?.error || "Couldn't evaluate this campaign.");
          return;
        }
        setResult(data as EngineResult);

        // Recent ad_action_log entries for this campaign's workspace.
        const { data: logs } = await supabase
          .from("ad_action_log")
          .select("id, action_type, action_detail, source, created_at, meta_entity_id")
          .eq("brand_id", activeBrand.id)
          .eq("workspace_id", ws.id)
          .order("created_at", { ascending: false })
          .limit(8);
        if (!cancelled) setActions(logs || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Couldn't load this campaign.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeBrand, brandLoading, campaignId, reloadKey]);

  const top = result?.topRecommendation || null;
  const fatigue = useMemo(
    () => getFatigueStatus(result?.campaign.frequency ?? null),
    [result?.campaign.frequency],
  );

  function budgetTargetAdSetId(action: string, rec: AdEval) {
    if (!result) return undefined;
    if (rec.level === "adset") return rec.id;
    if (result.meta?.campaignType !== "ABO") return undefined;
    const matching = result.adsets.find((adset) => adset.recommendation?.action === action);
    if (matching) return matching.id;
    return [...result.adsets]
      .sort((a, b) => (b.windows?.medium?.spend ?? 0) - (a.windows?.medium?.spend ?? 0))[0]?.id;
  }

  // -------------------------------------------------------------------------
  // Launch the shared confirm+execute dialog. Builds a transient task shape;
  // also writes a real task row via upsertRecommendationTasks so the action
  // also appears in the tray.
  // -------------------------------------------------------------------------
  async function openExecuteFor(rec: AdEval) {
    if (!result || !activeBrand || !workspaceId) return;
    if (!workspaceId) return;
    const action = rec.recommendation.action;
    let actionType: "pause" | "budget" | "rotate" | null = null;
    if (action === "turn_off") actionType = "pause";
    else if (action === "increase_budget" || action === "reduce_budget") actionType = "budget";
    else if (action === "refresh_creative") actionType = "rotate";
    const targetAdSetId = actionType === "budget" ? budgetTargetAdSetId(action, rec) : undefined;

    if (!actionType) {
      // Non-meta-mutating recs — route via reuse paths.
      if (action === "promote_to_scaling") {
        toast.message("Here's how to scale this", { description: rec.recommendation.reasoning });
        navigate("/launch");
        return;
      }
      if (action === "add_similar_variants") {
        navigate(`/creative-studio?workspace=${workspaceId}`);
        return;
      }
      toast.message("Here's how to do it", { description: rec.recommendation.reasoning });
      return;
    }

    // Persist a task so the tray reflects it too (dedupes inside upsert).
    let hasBench = false;
    if (actionType === "rotate") {
      const { count } = await supabase
        .from("creative_bench")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", activeBrand.id)
        .eq("workspace_id", workspaceId)
        .in("status", ["bench", "paused", "retesting"])
        .not("meta_ad_id", "is", null);
      hasBench = (count || 0) > 0;
      if (!hasBench) {
        toast.message("No fresh creative ready to swap in.", {
          description: "Generate or upload a new ad in Creative Studio first.",
        });
        navigate(`/creative-studio?workspace=${workspaceId}&refreshCreative=true`);
        return;
      }
    }

    try {
      await upsertRecommendationTasks([
        {
          entityId: rec.id,
          entityName: rec.name,
          entityLevel: rec.level,
          workspaceId,
          brandId: activeBrand.id,
          action,
          reasoning: rec.recommendation.reasoning,
          hasBench,
          adSetId: targetAdSetId ?? null,
        },
      ]);
    } catch (e) {
      console.warn("[closer-look] task upsert failed", e);
    }

    // Transient task shape — the dialog will execute against Meta and call
    // closeMatchingTasks(entity+action), which closes the row we just upserted.
    const shape: ExecutableTaskShape = {
      id: `transient-${rec.id}-${action}`,
      title: `${ACTION_VERB[action] || action} "${rec.name}"`,
      action_type: actionType,
      action_payload: {
        entityId: rec.id,
        entityLevel: rec.level,
        workspaceId,
        brandId: activeBrand.id,
        action,
        ...(actionType === "budget" ? { kind: action, adSetId: targetAdSetId ?? null } : {}),
        ...(actionType === "rotate" ? { fatigueAdId: rec.id, fatigueAdName: rec.name } : {}),
        reason: rec.recommendation.reasoning,
      },
    };
    setActiveTask(shape);
    setTaskOpen(true);
  }

  // Synthetic recommendation for Options menu (uses campaign-level entity).
  function syntheticRecForOption(action: string, friendly: string): AdEval | null {
    if (!result) return null;
    return {
      ...result.campaign,
      recommendation: {
        action,
        reasoning: friendly,
        confidence: "medium",
        impact: 0,
        impactReasoning: "",
      },
    };
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Card>
            <CardContent className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading the room…
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !result) {
    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
          <Button variant="ghost" onClick={() => navigate("/ad-performance")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Live Ads
          </Button>
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {error || "Couldn't load this campaign."}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const primaryKpi = result.meta.primaryKpi;
  const secondaryKpi = result.meta.secondaryKpi;
  const s = STATUS_STYLE[result.campaign.status] ?? STATUS_STYLE.learning;

  // Configured goal KPIs — derive from meta.goals (preferred) or fall back
  // to whatever shows up in the campaign-row's kpis[], or just the primary.
  const goalKpis: { kpi: string; label: string; goal: number; direction: string; isDefault: boolean }[] =
    (result.meta.goals && result.meta.goals.length > 0)
      ? result.meta.goals
      : (result.campaign.kpis && result.campaign.kpis.length > 0)
        ? result.campaign.kpis.map(k => ({ kpi: k.kpi, label: k.label, goal: k.goal, direction: k.direction, isDefault: k.isDefault }))
        : [{ kpi: primaryKpi, label: result.meta.primaryKpiLabel, goal: result.meta.primaryGoal ?? 0, direction: "less_than", isDefault: false }];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/ad-performance")}
              className="gap-2 -ml-2 h-7"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Live Ads
            </Button>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold truncate">{workspaceName || result.campaign.name}</h1>
              <Badge variant="outline" className={s.cls}>{s.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Measure of success:</span>{" "}
              {(result.meta.goals && result.meta.goals.length > 0
                ? result.meta.goals
                : [{ kpi: primaryKpi, label: result.meta.primaryKpiLabel, goal: result.meta.primaryGoal ?? 0, direction: "less_than", isDefault: false }]
              ).map((g, i) => (
                <span key={g.kpi}>
                  {i > 0 ? " · " : ""}
                  {g.label} (goal {formatKpi(g.kpi, g.goal)})
                </span>
              ))}
            </p>

          </div>
          {result.meta.hasUserGoals === false && (
            <div className="w-full">
              <SetupPrompt
                icon={Target}
                title="Set goals for this campaign"
                description="So LUMI can measure success against your targets (we're showing benchmark defaults for now)."
                ctaLabel="Set goals"
                tone="warning"
                onCta={() => setGoalModalOpen(true)}
                autoTask={{
                  title: `Set goals for ${workspaceName || result.campaign.name}`,
                  link_to: `/live-ads/${campaignId}`,
                }}
              />
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <MoreHorizontal className="h-4 w-4" /> Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>What do you want to do?</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  const r = syntheticRecForOption("increase_budget", "Approved scaling from Closer Look");
                  if (r) openExecuteFor(r);
                }}
              >
                <Rocket className="h-4 w-4 mr-2" /> Scale it (increase budget)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const r = syntheticRecForOption("turn_off", "Approved pause from Closer Look");
                  if (r) openExecuteFor(r);
                }}
              >
                <Pause className="h-4 w-4 mr-2" /> Kill it (pause campaign)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const r = syntheticRecForOption("refresh_creative", "Approved creative refresh from Closer Look");
                  if (r) openExecuteFor(r);
                }}
              >
                <Wand2 className="h-4 w-4 mr-2" /> New creative
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/strategy-builder")}>
                <Brain className="h-4 w-4 mr-2" /> Build a new strategy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/launch")}>
                <Layers className="h-4 w-4 mr-2" /> Add a supplemental campaign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* LUMI recommends — compact */}
        <Card className="relative overflow-hidden border-transparent">
          <div
            aria-hidden
            className="absolute inset-0 rounded-lg p-[1.5px] bg-gradient-to-br from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 [mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)] [mask-composite:exclude]"
          />
          <CardContent className="p-3">
            {(() => {
              const primaryIsNull = result.campaign.primary?.value == null;
              if (primaryIsNull) {
                return (
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-4 w-4 text-lumi-pink-1 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">LUMI recommends</span>
                      <p className="text-sm">
                        {(result.meta.primaryKpiLabel || (result.meta.primaryKpi || "Primary KPI").toUpperCase())} has no value yet — can't judge performance.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Likely either too early, or conversion tracking isn't set up for this goal.
                      </p>
                    </div>
                  </div>
                );
              }
              return top ? (
                <div className="flex items-start gap-3">
                  <Sparkles className="h-4 w-4 text-lumi-pink-1 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">LUMI recommends</span>
                      <span className="text-sm font-semibold">
                        {ACTION_VERB[top.recommendation.action] || top.recommendation.action} "{top.name}"
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {top.recommendation.confidence} confidence
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{top.recommendation.reasoning}</p>
                    {top.recommendation.diagnosis?.needsConversionTracking && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 italic">
                        Conversion tracking isn't reporting — set it up for a sharper read.
                      </p>
                    )}
                  </div>
                  <Button size="sm" onClick={() => openExecuteFor(top)} className="gap-1.5 flex-shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-lumi-pink-1" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">LUMI recommends</span>
                  <span className="text-sm text-muted-foreground">Holding steady — no changes needed right now.</span>
                </div>
              );
            })()}
          </CardContent>
        </Card>


        {/* Fatigue */}
        {fatigue.shouldSurface && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Creative fatigue</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center gap-4">
              <FatigueGauge frequency={fatigue.frequency} level={fatigue.level} />
              <div className="space-y-1 flex-1">
                <Badge variant="outline" className={fatigue.badgeClass}>{fatigue.label}</Badge>
                <p className="text-sm">{fatigue.explanation}</p>
                <p className="text-sm text-muted-foreground">{fatigue.recommendation}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI table: campaign → adsets → ads. One column per configured KPI. */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Performance breakdown</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-2 font-medium">Name</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                  <th className="py-2 px-2 font-medium text-right">Reach</th>
                  <th className="py-2 px-2 font-medium text-right">Freq</th>
                  {goalKpis.map(g => (
                    <th key={g.kpi} className="py-2 px-2 font-medium text-right">
                      {g.label}
                      <div className="text-[10px] text-muted-foreground font-normal">
                        goal {formatKpi(g.kpi, g.goal)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <KpiRow row={result.campaign} goalKpis={goalKpis} depth={0} />
                {result.adsets.map((as) => (
                  <KpiRow key={as.id} row={as} goalKpis={goalKpis} depth={1} />
                ))}
                {result.ads.map((ad) => (
                  <KpiRow key={ad.id} row={ad} goalKpis={goalKpis} depth={2} />
                ))}
              </tbody>
            </table>

          </CardContent>
        </Card>

        {/* Window lens */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{result.meta.primaryKpiLabel} across time</CardTitle>
            <p className="text-xs text-muted-foreground">
              Last 3 / 7 / 30 days. (Adding a 14-day window is a small engine change for later.)
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {(["short", "medium", "long"] as const).map((win, idx) => {
                const w = result.campaign.windows?.[win];
                const label = idx === 0 ? "Last 3 days" : idx === 1 ? "Last 7 days" : "Last 30 days";
                return (
                  <div key={win} className="rounded-lg border bg-background/60 p-3 space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                    <div className="text-lg font-semibold tabular-nums">
                      {formatKpi(primaryKpi, w?.kpiValue ?? null)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Spend ${(w?.spend ?? 0).toFixed(0)} · {w?.results ?? 0} results
                    </div>
                  </div>
                );
              })}
            </div>

            {(() => {
              const goal = result.meta.primaryGoal;
              const direction = result.meta.primaryDirection || "less_than";
              const label = result.meta.primaryKpiLabel;
              const wins = (["short", "medium", "long"] as const).map((k, i) => ({
                key: k,
                label: i === 0 ? "3-day" : i === 1 ? "7-day" : "30-day",
                value: result.campaign.windows?.[k]?.kpiValue ?? null,
                spend: result.campaign.windows?.[k]?.spend ?? 0,
              }));
              const hasData = wins.filter(w => w.value !== null && w.value > 0);
              if (!goal || hasData.length === 0) {
                return (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                    Not enough data yet to read trends across windows. Once spend builds up across 3, 7 and 30 days, you'll see a plain-english read here.
                  </div>
                );
              }
              const meets = (v: number) => direction === "less_than" ? v <= goal : v >= goal;
              const hitting = hasData.filter(w => meets(w.value as number));
              const missing = hasData.filter(w => !meets(w.value as number));
              const allHit = missing.length === 0;
              const allMiss = hitting.length === 0;
              const mixed = !allHit && !allMiss;
              const overUnder = direction === "less_than" ? { good: "under", bad: "over" } : { good: "over", bad: "under" };

              let headline = "";
              let body = "";
              let advice = "";

              if (allHit) {
                headline = `${label} is hitting goal across every window.`;
                body = `Your 3-day, 7-day, and 30-day ${label} are all ${overUnder.good} your goal of ${formatKpi(primaryKpi, goal)}. That's a strong, consistent signal — performance isn't a fluke of one good day.`;
                advice = `This is the moment to lean in: scale budget in small steps (15–25%), keep your winning creative running, and start queueing up fresh variations of your top hooks/angles so you have backups ready before fatigue sets in.`;
              } else if (allMiss) {
                headline = `${label} is ${overUnder.bad} goal across every window.`;
                body = `Your 3-day, 7-day, and 30-day ${label} are all ${overUnder.bad} your goal of ${formatKpi(primaryKpi, goal)}. This isn't volatility — it's a consistent pattern that needs action.`;
                advice = `Refresh your creative with new hooks, angles, and formats. Revisit any past winners and build variations of them. Double-check your offer messaging and audience alignment before adding more budget.`;
              } else if (mixed) {
                const hitLabels = hitting.map(w => w.label).join(" and ");
                const missLabels = missing.map(w => w.label).join(" and ");
                headline = `Looks volatile — ${hitLabels} ${hitting.length > 1 ? "are" : "is"} hitting goal but ${missLabels} ${missing.length > 1 ? "are" : "is"} ${overUnder.bad}.`;
                body = `Your ${label} goal is ${formatKpi(primaryKpi, goal)}. The mixed signal across windows usually means normal fluctuation — the market, time of year, day-of-week swings, audience saturation cycles, even what's happening in the news can move CPL around week to week. Don't make big changes off one window.`;
                advice = `Keep an eye on it for a few more days before pulling levers. If you want to get ahead of the fluctuation, the smartest moves are: add fresh creative and copy variations, test a couple of new hooks or angles, and revisit your past winning creative types and rebuild variations of them. Small, additive moves — not big structural changes.`;
              }

              return (
                <div className="rounded-lg border bg-primary/5 border-primary/20 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary flex-shrink-0" />
                    <p className="text-sm font-semibold">{headline}</p>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{body}</p>
                  <p className="text-sm text-foreground/80 leading-relaxed"><span className="font-medium">What to do: </span>{advice}</p>
                </div>
              );
            })()}

            {/* Suggested actions — context aware, with LUMI's pick flagged */}
            {(() => {
              const goal = result.meta.primaryGoal;
              const direction = result.meta.primaryDirection || "less_than";
              const short = result.campaign.windows?.short?.kpiValue ?? null;
              const medium = result.campaign.windows?.medium?.kpiValue ?? null;
              const long = result.campaign.windows?.long?.kpiValue ?? null;
              const totalSpend = (result.campaign.windows?.long?.spend ?? 0);
              const meets = (v: number | null) => v !== null && v > 0 && (direction === "less_than" ? v <= (goal ?? 0) : v >= (goal ?? 0));
              const valid = [short, medium, long].filter((v): v is number => v !== null && v > 0);
              if (!goal || valid.length === 0) return null;
              const hits = [short, medium, long].filter(meets).length;
              const allHit = hits === 3 && valid.length === 3;
              const allMiss = hits === 0;
              const isFatigued = fatigue.shouldSurface && (fatigue.level === "high" || fatigue.level === "building");
              // Trend: in less_than goal, lower 3d than 30d = improving
              const improving = short !== null && long !== null && (direction === "less_than" ? short < long : short > long);
              const worsening = short !== null && long !== null && (direction === "less_than" ? short > long * 1.15 : short < long * 0.85);

              type Suggestion = {
                id: string;
                label: string;
                why: string;
                run: () => void;
                tone: "primary" | "secondary" | "danger";
              };

              const scale: Suggestion = {
                id: "increase_budget",
                label: "Scale budget +15–25%",
                why: "Performance is consistent across windows — small, additive budget bumps compound without breaking learnings.",
                run: () => { const r = syntheticRecForOption("increase_budget", "Approved scaling from Closer Look"); if (r) openExecuteFor(r); },
                tone: "primary",
              };
              const refresh: Suggestion = {
                id: "refresh_creative",
                label: "Refresh creative — new hooks & angles",
                why: "Add 2–3 new hooks or angles and rebuild variations of past winners to bring the KPI back in line.",
                run: () => { const r = syntheticRecForOption("refresh_creative", "Approved creative refresh from Closer Look"); if (r) openExecuteFor(r); },
                tone: "primary",
              };
              const hold: Suggestion = {
                id: "hold",
                label: "Hold steady — monitor for 3–5 more days",
                why: "Volatility across windows is usually normal fluctuation. Don't make structural changes off one bad window.",
                run: () => {},
                tone: "secondary",
              };
              const newCreative: Suggestion = {
                id: "new_creative",
                label: "Generate fresh creative in Creative Studio",
                why: "Queue up variations of your winning hooks before fatigue hits or to inject new angles into the mix.",
                run: () => navigate("/creative-studio"),
                tone: "secondary",
              };
              const pause: Suggestion = {
                id: "turn_off",
                label: "Pause the campaign",
                why: "Consistent miss across every window with enough spend behind it — stop the bleed and rework before relaunching.",
                run: () => { const r = syntheticRecForOption("turn_off", "Approved pause from Closer Look"); if (r) openExecuteFor(r); },
                tone: "danger",
              };
              const reviewAudience: Suggestion = {
                id: "review_audience",
                label: "Revisit offer & audience alignment",
                why: "When every window misses, the message-to-market match is usually the root cause — not the creative.",
                run: () => navigate("/dashboard"),
                tone: "secondary",
              };

              const suggestions: Suggestion[] = [];
              if (allHit) {
                suggestions.push(scale, newCreative, hold);
              } else if (allMiss) {
                if (totalSpend > 100) {
                  suggestions.push(pause, refresh, reviewAudience);
                } else {
                  suggestions.push(refresh, reviewAudience, hold);
                }
              } else if (isFatigued) {
                suggestions.push(refresh, newCreative, hold);
              } else if (worsening) {
                suggestions.push(refresh, newCreative, hold);
              } else if (improving) {
                suggestions.push(hold, newCreative, scale);
              } else {
                suggestions.push(hold, newCreative, refresh);
              }

              // Which one does LUMI back? Map from engine top rec when present.
              const engineAction = top?.recommendation?.action;
              const lumiPickId = (() => {
                if (engineAction === "increase_budget") return "increase_budget";
                if (engineAction === "turn_off") return "turn_off";
                if (engineAction === "refresh_creative" || engineAction === "new_creative") return "refresh_creative";
                // Fallback: first suggestion in our context-aware list
                return suggestions[0]?.id;
              })();

              // Float LUMI's pick to the top.
              suggestions.sort((a, b) => (a.id === lumiPickId ? -1 : b.id === lumiPickId ? 1 : 0));


              const toneCls: Record<Suggestion["tone"], string> = {
                primary: "border-primary/30",
                secondary: "border-border",
                danger: "border-destructive/40",
              };

              return (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      What you could do next
                    </p>
                    <span className="text-[10px] text-muted-foreground">Tailored to this campaign's numbers</span>
                  </div>
                  <div className="grid gap-2">
                    {suggestions.map((sg) => {
                      const isPick = sg.id === lumiPickId;
                      return (
                        <div
                          key={sg.id}
                          className={`rounded-lg border ${toneCls[sg.tone]} ${isPick ? "bg-gradient-to-r from-lumi-orange-1/5 via-lumi-pink-1/5 to-lumi-purple-1/5 border-lumi-pink-1/40" : "bg-background/60"} p-3 flex items-start gap-3`}
                        >
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">{sg.label}</span>
                              {isPick && (
                                <Badge variant="outline" className="text-[10px] bg-lumi-pink-1/10 border-lumi-pink-1/40 text-foreground gap-1">
                                  <Sparkles className="h-3 w-3 text-lumi-pink-1" /> LUMI recommends
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{sg.why}</p>
                          </div>
                          {sg.id !== "hold" && (
                            <Button
                              size="sm"
                              variant={isPick ? "default" : "outline"}
                              className="flex-shrink-0"
                              onClick={sg.run}
                            >
                              {sg.id === "new_creative" || sg.id === "review_audience" ? "Open" : "Approve"}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </CardContent>



        </Card>

        {/* Lead-fit feedback loop */}
        {activeBrand && workspaceId && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4" /> Lead quality
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AdFitReviewTaskCard
                workspaceId={workspaceId}
                brandId={activeBrand.id}
                variant="full"
              />
              <LeadQualityCheck
                workspaceId={workspaceId}
                brandId={activeBrand.id}
                campaignMetaId={(result?.campaign as any)?.id || null}
                variant="full"
              />
            </CardContent>
          </Card>
        )}

        {/* Recent actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" /> Recent actions in this account
            </CardTitle>
          </CardHeader>
          <CardContent>
            {actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing recorded yet. Actions you take through LUMI will show up here.
              </p>
            ) : (
              <ul className="space-y-2">
                {actions.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm border-b last:border-b-0 pb-2 last:pb-0">
                    <div className="text-xs text-muted-foreground w-32 flex-shrink-0">
                      {new Date(a.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium capitalize">{String(a.action_type).replace(/_/g, " ")}</div>
                      {a.meta_entity_id && (
                        <div className="text-xs text-muted-foreground truncate">
                          Entity {a.meta_entity_id}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px]">{a.source || "system"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Footer links */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
          <button onClick={() => setBugOpen(true)} className="hover:text-foreground flex items-center gap-1">
            <Bug className="h-3 w-3" /> Report a bug
          </button>
          <span>·</span>
          <button onClick={() => navigate("/beta-feedback")} className="hover:text-foreground flex items-center gap-1">
            <Lightbulb className="h-3 w-3" /> Request a feature
          </button>
          <span>·</span>
          <button onClick={() => navigate("/refer")} className="hover:text-foreground flex items-center gap-1">
            <Heart className="h-3 w-3" /> Refer a friend
          </button>
        </div>

        <TaskExecuteDialog
          task={activeTask}
          open={taskOpen}
          onOpenChange={setTaskOpen}
          onDone={() => {
            // Refresh recent actions after a successful execution.
            if (!activeBrand || !workspaceId) return;
            supabase
              .from("ad_action_log")
              .select("id, action_type, action_detail, source, created_at, meta_entity_id")
              .eq("brand_id", activeBrand.id)
              .eq("workspace_id", workspaceId)
              .order("created_at", { ascending: false })
              .limit(8)
              .then(({ data }) => setActions(data || []));
          }}
        />

        <BugReportModal open={bugOpen} onOpenChange={setBugOpen} context="closer-look" />
        <GoalSetupModal
          open={goalModalOpen}
          onOpenChange={setGoalModalOpen}
          campaigns={workspaceId ? [{
            id: workspaceId,
            name: workspaceName || result.campaign.name,
            brandId: activeBrand?.id,
          }] : []}
          onGoalsSaved={() => { setGoalModalOpen(false); setReloadKey((n) => n + 1); }}
        />
      </div>
    </DashboardLayout>
  );
}

function KpiRow({
  row,
  goalKpis,
  depth,
}: {
  row: AdEval;
  goalKpis: { kpi: string; label: string; goal: number; direction: string; isDefault: boolean }[];
  depth: 0 | 1 | 2;
}) {
  const s = STATUS_STYLE[row.status] ?? STATUS_STYLE.learning;
  const indent = depth === 0 ? "" : depth === 1 ? "pl-4" : "pl-8";
  // Index entity's kpis by key so we can match the configured columns.
  const byKpi = new Map<string, KpiEntry>((row.kpis || []).map(k => [k.kpi, k]));
  return (
    <tr className="border-b last:border-b-0 align-top">
      <td className={cn("py-2 pr-2", indent)}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {row.level === "adset" ? "ad set" : row.level}
          </span>
          <span className="font-medium truncate max-w-[260px]">{row.name}</span>
        </div>
      </td>
      <td className="py-2 px-2">
        <Badge variant="outline" className={cn("text-[10px]", s.cls)}>{s.label}</Badge>
      </td>
      <td className="py-2 px-2 text-right tabular-nums">
        {row.reach != null ? row.reach.toLocaleString() : "—"}
      </td>
      <td className="py-2 px-2 text-right tabular-nums">
        {row.frequency != null ? row.frequency.toFixed(2) : "—"}
      </td>
      {goalKpis.map(g => {
        const entry = byKpi.get(g.kpi);
        const value = entry?.value ?? null;
        const hitting = entry?.status === "above" || entry?.status === "at";
        const missing = entry?.status === "below";
        const cls = entry?.status === "no_data" || value == null
          ? "text-muted-foreground"
          : hitting ? "text-emerald-700" : "text-amber-700";
        const pct = entry?.vsGoalPct;
        return (
          <td key={g.kpi} className="py-2 px-2 text-right tabular-nums">
            <div className={cn("font-medium", cls)}>
              {formatKpi(g.kpi, value)} {hitting && value != null ? "✓" : missing ? "✗" : ""}
            </div>
            <div className="text-[10px] text-muted-foreground">
              vs {formatKpi(g.kpi, g.goal)}
              {pct != null && Math.abs(pct) > 1 ? ` (${pct > 0 ? "+" : ""}${pct.toFixed(0)}%)` : ""}
            </div>
          </td>
        );
      })}
    </tr>
  );
}
