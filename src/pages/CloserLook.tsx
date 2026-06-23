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
          body: { brandId: activeBrand.id, metaCampaignId },
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
  }, [activeBrand, brandLoading, campaignId]);

  const top = result?.topRecommendation || null;
  const fatigue = useMemo(
    () => getFatigueStatus(result?.campaign.frequency ?? null),
    [result?.campaign.frequency],
  );

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
        ...(actionType === "budget" ? { kind: action } : {}),
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
              <DropdownMenuItem onClick={() => navigate("/strategy")}>
                <Brain className="h-4 w-4 mr-2" /> Build a new strategy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/launch")}>
                <Layers className="h-4 w-4 mr-2" /> Add a supplemental campaign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* LUMI recommends */}
        <Card className="relative overflow-hidden border-transparent">
          <div
            aria-hidden
            className="absolute inset-0 rounded-lg p-[1.5px] bg-gradient-to-br from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 [mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)] [mask-composite:exclude]"
          />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-lumi-pink-1" /> LUMI recommends
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {top ? (
              <>
                <div className="text-sm font-semibold">
                  {ACTION_VERB[top.recommendation.action] || top.recommendation.action} "{top.name}"
                </div>
                <p className="text-sm text-muted-foreground">{top.recommendation.reasoning}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openExecuteFor(top)} className="gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                  <Badge variant="outline" className="text-xs">
                    Confidence: {top.recommendation.confidence}
                  </Badge>
                  {top.recommendation.impactReasoning && (
                    <span className="text-xs text-muted-foreground italic self-center">
                      {top.recommendation.impactReasoning}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Holding steady — no changes needed right now.
              </p>
            )}
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
          <CardContent>
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
          </CardContent>
        </Card>

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
          onGoalsSaved={() => { setGoalModalOpen(false); window.location.reload(); }}
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
