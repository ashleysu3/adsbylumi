import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Target,
  Activity,
  Plus,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Wallet,
  Package,
  Link2,
  Flag,
} from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SetupPrompt } from "@/components/SetupPrompt";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import { computeStrategyBudget } from "@/lib/strategy-budget";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FunnelMapChat, type FunnelMap, type FunnelGap, type FunnelChatDraft } from "@/components/FunnelMapChat";

type OfferRow = {
  id: string;
  name: string;
  price_point: string | null;
  target_outcome: string | null;
  funnel_map: FunnelMap | null;
  funnel_gaps: FunnelGap[] | null;
  funnel_chat_draft: FunnelChatDraft | null;
};

type WorkspaceRow = {
  id: string;
  name: string;
  objective: string | null;
  offer_id: string | null;
  offer_name: string | null;
  offer_price: string | null;
  meta_campaign_ids: any;
  meta_campaign_status: string | null;
  archived: boolean | null;
};

type GoalRow = {
  workspace_id: string | null;
  primary_kpi: string;
  primary_kpi_label: string;
  primary_kpi_threshold: number;
  primary_kpi_goal_type: string;
};

type Stage = "grow" | "nurture" | "convert";

type EvalResult = {
  workspaceId: string;
  status: "green" | "yellow" | "red" | "unknown";
  bottleneck?: string;
  dailyBudget?: number;
  spend?: number;
};

const STAGE_META: Record<Stage, { label: string; tone: string; description: string }> = {
  grow: {
    label: "Grow",
    tone: "bg-lumi-orange-1/15 text-lumi-orange-1 border-lumi-orange-1/30",
    description: "Reach cold audiences",
  },
  nurture: {
    label: "Nurture",
    tone: "bg-lumi-pink-1/15 text-lumi-pink-1 border-lumi-pink-1/30",
    description: "Warm leads & build trust",
  },
  convert: {
    label: "Convert",
    tone: "bg-lumi-purple-1/15 text-lumi-purple-1 border-lumi-purple-1/30",
    description: "Close the sale",
  },
};

function classifyStage(objective?: string | null, name?: string): Stage {
  const o = (objective || "").toUpperCase();
  const n = (name || "").toLowerCase();
  if (o.includes("SALES") || o.includes("CONVERSION") || /sale|purchase|convert|close/.test(n))
    return "convert";
  if (o.includes("LEAD") || /lead|webinar|opt.?in|signup|register|nurture|warm/.test(n))
    return "nurture";
  return "grow";
}

function jobForStage(stage: Stage, offerName?: string): string {
  const o = offerName ? ` for ${offerName}` : "";
  if (stage === "convert") return `Closes the sale${o}`;
  if (stage === "nurture") return `Warms leads${o}`;
  return `Gets in front of new people${o}`;
}

function statusFromEval(d: any): EvalResult["status"] {
  const reach = Number(d?.campaign?.reach || 0);
  if (reach <= 0) return "unknown";
  const ads = (d?.ads || []) as any[];
  if (!ads.length) return "unknown";
  const reds = ads.filter((a) => a?.status === "red").length;
  const yellows = ads.filter((a) => a?.status === "yellow").length;
  if (reds >= Math.ceil(ads.length / 2)) return "red";
  if (reds + yellows > ads.length / 2) return "yellow";
  return "green";
}

function StatusDot({ status }: { status: EvalResult["status"] }) {
  const cls =
    status === "green"
      ? "bg-emerald-500"
      : status === "yellow"
      ? "bg-amber-500"
      : status === "red"
      ? "bg-red-500"
      : "bg-muted-foreground/40";
  return <span className={cn("inline-block h-2 w-2 rounded-full", cls)} />;
}

export default function AdStrategy() {
  const navigate = useNavigate();
  const { activeBrand, loading: brandLoading } = useBrand();

  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [evals, setEvals] = useState<Record<string, EvalResult>>({});

  useEffect(() => {
    if (brandLoading) return;
    if (!activeBrand) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [offersRes, wsRes, goalsRes] = await Promise.all([
          supabase
            .from("offers")
            .select("id, name, price_point, target_outcome, funnel_map, funnel_gaps, funnel_chat_draft")
            .eq("brand_id", activeBrand.id)
            .eq("archived", false)
            .order("created_at", { ascending: false }),
          supabase
            .from("campaign_workspaces")
            .select(
              "id, name, objective, offer_id, offer_name, offer_price, meta_campaign_ids, meta_campaign_status, archived",
            )
            .eq("brand_id", activeBrand.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("campaign_goals")
            .select(
              "workspace_id, primary_kpi, primary_kpi_label, primary_kpi_threshold, primary_kpi_goal_type",
            )
            .eq("brand_id", activeBrand.id),
        ]);

        if (cancelled) return;
        const offersList = (offersRes.data || []) as unknown as OfferRow[];
        // Only surface campaigns that are actually LIVE on Meta. Drafts (no
        // meta_campaign_ids), paused, archived, or deleted campaigns shouldn't
        // appear on the 30,000-ft strategy map — they're not part of the
        // current system. De-dupe by Meta campaign id so re-saved workspaces
        // don't double up.
        const seen = new Set<string>();
        const wsList = ((wsRes.data || []) as WorkspaceRow[]).filter((w) => {
          const cid = (w.meta_campaign_ids as any)?.campaignId;
          if (!cid) return false;
          const status = (w.meta_campaign_status || "").toLowerCase();
          if (status !== "active") return false;
          const key = String(cid);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setOffers(offersList);
        setWorkspaces(wsList);
        setGoals((goalsRes.data || []) as GoalRow[]);

        // Health pings
        const settled = await Promise.allSettled(
          wsList.map((w) =>
            supabase.functions
              .invoke("evaluate-campaign-status", {
                body: {
                  workspaceId: w.id,
                  brandId: activeBrand.id,
                  metaCampaignId: (w.meta_campaign_ids as any).campaignId,
                },
              })
              .then((res) => ({ id: w.id, res })),
          ),
        );
        if (cancelled) return;
        const map: Record<string, EvalResult> = {};
        settled.forEach((s) => {
          if (s.status !== "fulfilled") return;
          const d = (s.value.res as any)?.data;
          if (!d) return;
          map[s.value.id] = {
            workspaceId: s.value.id,
            status: statusFromEval(d),
            bottleneck: d?.topRecommendation?.recommendation?.reasoning,
            dailyBudget: Number(d?.campaign?.daily_budget || 0) / 100 || undefined,
            spend: Number(d?.campaign?.spend || 0),
          };
        });
        setEvals(map);
      } catch (e) {
        console.error("[AdStrategy] load error", e);
        toast.error("Couldn't load your ad strategy");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBrand?.id, brandLoading]);

  // Group campaigns by offer (= funnel)
  const funnels = useMemo(() => {
    type Funnel = {
      key: string;
      offerId: string | null;
      offerName: string;
      pricePoint: string | null;
      targetOutcome: string | null;
      funnelMap: FunnelMap | null;
      funnelGaps: FunnelGap[] | null;
      funnelChatDraft: FunnelChatDraft | null;
      campaigns: (WorkspaceRow & { stage: Stage })[];
    };
    const map = new Map<string, Funnel>();
    // seed from offers so empty offers still appear
    offers.forEach((o) =>
      map.set(o.id, {
        key: o.id,
        offerId: o.id,
        offerName: o.name,
        pricePoint: o.price_point,
        targetOutcome: o.target_outcome,
        funnelMap: o.funnel_map,
        funnelGaps: o.funnel_gaps,
        funnelChatDraft: o.funnel_chat_draft,
        campaigns: [],
      }),
    );
    // attach campaigns
    workspaces.forEach((w) => {
      const stage = classifyStage(w.objective, w.name);
      const key = w.offer_id || `unlinked:${w.offer_name || "Other"}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          offerId: w.offer_id,
          offerName: w.offer_name || "Unlinked campaigns",
          pricePoint: w.offer_price || null,
          targetOutcome: null,
          funnelMap: null,
          funnelGaps: null,
          funnelChatDraft: null,
          campaigns: [],
        });
      }
      map.get(key)!.campaigns.push({ ...w, stage });
    });
    return Array.from(map.values());
  }, [offers, workspaces]);

  const handleFunnelMapSaved = (offerId: string, funnelMap: FunnelMap, gaps: FunnelGap[]) => {
    setOffers((prev) =>
      prev.map((o) =>
        o.id === offerId ? { ...o, funnel_map: funnelMap, funnel_gaps: gaps, funnel_chat_draft: null } : o,
      ),
    );
  };

  const goalForWs = (wsId: string) =>
    goals.find((g) => g.workspace_id === wsId) || null;

  // System summary
  const systemSummary = useMemo(() => {
    const liveFunnels = funnels.filter((f) => f.campaigns.length > 0);
    if (liveFunnels.length === 0) return "No live funnels yet.";
    const parts = liveFunnels.map((f) => {
      const stages = new Set(f.campaigns.map((c) => c.stage));
      const order = ["grow", "nurture", "convert"].filter((s) => stages.has(s as Stage));
      const chain = order.map((s) => STAGE_META[s as Stage].label.toLowerCase()).join(" → ");
      return `${f.offerName} (${chain})`;
    });
    return `You're running: ${parts.join("; ")}.`;
  }, [funnels]);

  // System bottleneck
  const systemHealth = useMemo(() => {
    const liveFunnels = funnels.filter((f) => f.campaigns.length > 0);
    const issues: string[] = [];
    liveFunnels.forEach((f) => {
      const reds: Stage[] = [];
      f.campaigns.forEach((c) => {
        const ev = evals[c.id];
        if (ev?.status === "red" || ev?.status === "yellow") reds.push(c.stage);
      });
      if (reds.includes("convert"))
        issues.push(`${f.offerName}: the conversion stage is the leak — sales aren't closing efficiently.`);
      else if (reds.includes("nurture"))
        issues.push(`${f.offerName}: warm → sale is the bottleneck — leads aren't converting.`);
      else if (reds.includes("grow"))
        issues.push(`${f.offerName}: cold reach is underperforming — fewer new people are coming in.`);
    });
    if (issues.length === 0 && liveFunnels.length > 0)
      return { tone: "ok" as const, text: "Everything is reading healthy across your funnels." };
    if (issues.length === 0) return null;
    return { tone: "warn" as const, text: issues.join(" ") };
  }, [funnels, evals]);

  // Next moves
  const nextMoves = useMemo(() => {
    const moves: { id: string; title: string; cta: string; onCta: () => void }[] = [];
    // Offers with no campaign
    offers.forEach((o) => {
      const hasCamp = workspaces.some((w) => w.offer_id === o.id);
      if (!hasCamp)
        moves.push({
          id: `offer-noc-${o.id}`,
          title: `${o.name} has no campaign running yet.`,
          cta: "Create campaign",
          onCta: () => navigate(`/create?from=strategy&goal=promote_offer&offerId=${o.id}`),
        });
    });
    // Funnels missing stages
    funnels
      .filter((f) => f.campaigns.length > 0)
      .forEach((f) => {
        const stages = new Set(f.campaigns.map((c) => c.stage));
        if (!stages.has("convert"))
          moves.push({
            id: `gap-convert-${f.key}`,
            title: `${f.offerName}: no conversion campaign — there's no campaign closing the sale.`,
            cta: "Add convert campaign",
            onCta: () =>
              navigate(
                `/create?from=strategy&goal=promote_offer${f.offerId ? `&offerId=${f.offerId}` : ""}`,
              ),
          });
        if (!stages.has("grow") && stages.has("convert"))
          moves.push({
            id: `gap-grow-${f.key}`,
            title: `${f.offerName}: no cold-traffic campaign — you may run out of new leads.`,
            cta: "Add cold campaign",
            onCta: () =>
              navigate(
                `/create?from=strategy&goal=grow_social${f.offerId ? `&offerId=${f.offerId}` : ""}`,
              ),
          });
      });
    // Bottlenecks → tasks
    Object.values(evals).forEach((ev) => {
      if (ev.status === "red") {
        const w = workspaces.find((x) => x.id === ev.workspaceId);
        if (w)
          moves.push({
            id: `bottleneck-${w.id}`,
            title: `${w.name} needs attention — health is red.`,
            cta: "Open",
            onCta: () => navigate(`/live-ads/${w.id}`),
          });
      }
    });
    return moves.slice(0, 8);
  }, [offers, workspaces, funnels, evals, navigate]);

  const noBrand = !brandLoading && !activeBrand;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-lumi-pink-1" />
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Your Ad Strategy
            </span>
          </div>
          <h1 className="text-3xl font-display tracking-tight">
            How your ads grow your business
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            A living view of every offer, the campaigns feeding it, and where the
            system is leaking. LUMI drafts it from what's already in your account —
            refine anything that's off.
          </p>
        </header>

        {/* Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Flag className="h-4 w-4 text-lumi-pink-1" /> Goals
            </CardTitle>
            <CardDescription>
              Set the business outcomes LUMI should optimize against.
            </CardDescription>
          </CardHeader>
        </Card>



        {loading ? (
          <Card>
            <CardContent className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Mapping your strategy…
            </CardContent>
          </Card>
        ) : noBrand ? (
          <SetupPrompt
            title="Set up your brand first"
            description="LUMI needs your brand and offers before she can map your ad strategy."
            ctaLabel="Set up brand"
            onCta={() => navigate("/brand-setup")}
          />
        ) : (
          <>
            {/* 1. System Map */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-lumi-pink-1" /> The system map
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/create?from=strategy")}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Add a funnel
                </Button>
              </div>

              {funnels.length === 0 ? (
                <SetupPrompt
                  icon={Package}
                  title="No offers yet"
                  description="Add an offer to start mapping how your ads grow your business."
                  ctaLabel="Add offer"
                  onCta={() => navigate("/offers")}
                />
              ) : (
                <div className="space-y-4">
                  {funnels.map((f) => (
                    <Card key={f.key} className="border-border/60">
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <h3 className="font-semibold">{f.offerName}</h3>
                              {f.pricePoint && (
                                <Badge variant="outline" className="text-[10px]">
                                  {f.pricePoint}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {f.campaigns.length === 0 && f.offerId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/create?from=strategy&goal=promote_offer&offerId=${f.offerId}`)}
                              className="gap-1.5"
                            >
                              <Plus className="h-3.5 w-3.5" /> Build a campaign
                            </Button>
                          )}
                        </div>

                        {f.offerId && (
                          <FunnelMapChat
                            offerId={f.offerId}
                            offerName={f.offerName}
                            targetOutcome={f.targetOutcome}
                            funnelMap={f.funnelMap}
                            gaps={f.funnelGaps}
                            draft={f.funnelChatDraft}
                            onSaved={handleFunnelMapSaved}
                          />
                        )}

                        {f.campaigns.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No campaign running for this offer yet.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {(["grow", "nurture", "convert"] as Stage[]).map((stage) => {
                              const camps = f.campaigns.filter((c) => c.stage === stage);
                              const meta = STAGE_META[stage];
                              return (
                                <div
                                  key={stage}
                                  className={cn(
                                    "rounded-lg border p-3 space-y-2 min-h-[110px]",
                                    camps.length === 0
                                      ? "border-dashed border-border/40 bg-muted/20"
                                      : "border-border/60",
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border",
                                        meta.tone,
                                      )}
                                    >
                                      {meta.label}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {meta.description}
                                    </span>
                                  </div>
                                  {camps.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground italic">
                                      No campaign at this stage
                                    </p>
                                  ) : (
                                    camps.map((c) => {
                                      const ev = evals[c.id];
                                      return (
                                        <button
                                          key={c.id}
                                          onClick={() => navigate(`/live-ads/${c.id}`)}
                                          className="w-full text-left rounded-md bg-card border border-border/60 px-2.5 py-2 hover:border-lumi-pink-1/50 transition"
                                        >
                                          <div className="flex items-center gap-2">
                                            <StatusDot status={ev?.status || "unknown"} />
                                            <span className="text-xs font-medium truncate flex-1">
                                              {c.name}
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-muted-foreground mt-0.5">
                                            {jobForStage(c.stage, f.offerName)}
                                          </p>
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  <Card className="bg-muted/20">
                    <CardContent className="py-3 text-sm text-muted-foreground">
                      {systemSummary}
                    </CardContent>
                  </Card>
                </div>
              )}
            </section>

            {/* 2. Realistic Goals — only once there's a campaign to set goals
                on. Its empty state was one of four "no campaign yet / create a
                campaign" repeats; the system map + next moves already carry
                that, so it stays hidden until a campaign exists. */}
            {workspaces.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-lumi-pink-1" /> Realistic goals
              </h2>

              <div className="space-y-2">
                  {workspaces.map((w) => {
                    const g = goalForWs(w.id);
                    const ev = evals[w.id];
                    const daily = ev?.dailyBudget || 0;
                    const stage = classifyStage(w.objective, w.name);
                    let realityNote: string | null = null;
                    if (g) {
                      const budget = computeStrategyBudget({
                        campaigns: [
                          {
                            name: w.name,
                            objective: w.objective || undefined,
                            goal: g.primary_kpi,
                          },
                        ],
                        pricePoint: w.offer_price,
                        goalCount: g.primary_kpi
                          ? Number(g.primary_kpi_threshold) || null
                          : null,
                      });
                      const need = budget.requiredDailyForGoal || budget.totalDaily;
                      if (need && daily) {
                        if (daily >= need * 0.9)
                          realityNote = `Realistic — about $${Math.round(
                            need,
                          )}/day needed; you're at $${Math.round(daily)}/day.`;
                        else
                          realityNote = `Short by ~$${Math.round(
                            need - daily,
                          )}/day to hit ${g.primary_kpi_label} of ${g.primary_kpi_threshold}.`;
                      } else if (need) {
                        realityNote = `Plan needs ~$${Math.round(need)}/day to hit this goal.`;
                      }
                    }
                    return (
                      <Card key={w.id}>
                        <CardContent className="py-3 px-4 flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-[10px]">
                                {STAGE_META[stage].label}
                              </Badge>
                              <span className="text-sm font-medium truncate">{w.name}</span>
                            </div>
                            {g ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                Goal: {g.primary_kpi_label}{" "}
                                {g.primary_kpi_goal_type === "less_than" ? "≤" : "≥"}{" "}
                                {g.primary_kpi_threshold}
                                {realityNote && <> · {realityNote}</>}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-1">
                                No goal set — LUMI won't pretend to know what success looks like.
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant={g ? "ghost" : "outline"}
                            onClick={() => navigate(`/live-ads/${w.id}`)}
                          >
                            {g ? "Edit goal" : "Set a goal"}
                            <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
            </section>
            )}

            {/* 3. Health — hidden until there's a campaign to have health for;
                before that its empty state was just a third "no campaign yet"
                repeat with nothing to act on. */}
            {workspaces.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-lumi-pink-1" /> System health
              </h2>
              {systemHealth?.tone === "ok" ? (
                <Card className="border-emerald-500/30 bg-emerald-500/5">
                  <CardContent className="py-4 flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                    <p className="text-sm">{systemHealth.text}</p>
                  </CardContent>
                </Card>
              ) : systemHealth ? (
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="py-4 flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                    <p className="text-sm">{systemHealth.text}</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-4 text-sm text-muted-foreground">
                    Not enough data yet — give your campaigns a few days of reach to read.
                  </CardContent>
                </Card>
              )}
            </section>
            )}

            {/* 4. Next moves */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-lumi-pink-1" /> Next moves
              </h2>
              {nextMoves.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-sm text-muted-foreground text-center">
                    Nothing strategic to chase right now. Keep an eye on your live ads. ✨
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {nextMoves.map((m) => (
                    <Card key={m.id}>
                      <CardContent className="py-3 px-4 flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-sm flex-1 min-w-0">{m.title}</p>
                        <Button size="sm" onClick={m.onCta} className="gap-1.5">
                          {m.cta} <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
