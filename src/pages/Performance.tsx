import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DollarSign,
  Target,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// /performance — Step 4 of the campaign spine ("Optimize").
//
// Everyday view. Calls evaluate-campaign-status (the decision engine) for
// the active campaign and renders:
//   1) Hero "the one thing this week" card from topRecommendation
//   2) KPI cards (spend, primary KPI, cost-per-X, secondary KPI)
//   3) "Your ads right now" with engine status badges
//   4) Link to /retrospectives for lifetime history
//
// No engine logic is re-implemented here — purely a presentation layer
// over the function output.
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
  primary: { value: number | null; vsGoalPct: number | null };
  secondary: { value: number | null; label: string } | null;
  windows: {
    long: { spend: number; results: number; kpiValue: number | null };
  };
  recommendation: {
    action: string;
    reasoning: string;
    confidence: "high" | "medium" | "low";
  };
}

interface EngineResult {
  meta: {
    primaryKpi: string;
    primaryKpiLabel: string;
    primaryGoal: number | null;
    primaryDirection: "less_than" | "greater_than";
    secondaryKpi: string | null;
  };
  campaign: AdEval;
  adsets: AdEval[];
  ads: AdEval[];
  topRecommendation: AdEval | null;
}

const STATUS_STYLE: Record<Status, { label: string; cls: string }> = {
  scaling_ready: {
    label: "Scaling ready",
    cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  },
  performing: {
    label: "Performing",
    cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
  promising: {
    label: "Promising",
    cls: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  },
  learning: {
    label: "Learning",
    cls: "bg-muted text-muted-foreground border-border",
  },
  fatigued: {
    label: "Fatigued",
    cls: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  },
  spend_starved: {
    label: "Spend starved",
    cls: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  },
  underperforming: {
    label: "Underperforming",
    cls: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

const ACTION_LABEL: Record<string, string> = {
  turn_off: "Turn it off",
  promote_to_scaling: "Promote to scaling",
  add_similar_variants: "Add similar variants",
  increase_budget: "Increase budget",
  hold: "Hold steady",
  wait: "Give it more time",
  refresh_creative: "Refresh creative",
  push_delivery: "Push delivery",
  broaden_audience: "Broaden audience",
  reduce_budget: "Reduce budget",
};

function formatKpi(kpi: string, value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (kpi === "roas") return `${value.toFixed(2)}×`;
  if (kpi === "ctr") return `${value.toFixed(2)}%`;
  return `$${value.toFixed(2)}`;
}

export default function Performance() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const workspaceIdFromUrl = params.get("workspace");
  const { activeBrand, loading: brandLoading } = useBrand();

  const [workspaceId, setWorkspaceId] = useState<string | null>(
    workspaceIdFromUrl,
  );
  const [workspaceName, setWorkspaceName] = useState<string>("Campaign");
  const [result, setResult] = useState<EngineResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState<string | null>(null);

  // Pick a workspace if one wasn't supplied
  useEffect(() => {
    if (workspaceId || brandLoading || !activeBrand) return;
    (async () => {
      const { data } = await supabase
        .from("campaign_workspaces")
        .select("id, name")
        .eq("brand_id", activeBrand.id)
        .not("meta_campaign_ids", "is", null)
        .neq("meta_campaign_status", "draft")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        setWorkspaceId(data.id);
        setWorkspaceName(data.name || "Campaign");
      } else {
        setLoading(false);
      }
    })();
  }, [workspaceId, activeBrand, brandLoading]);

  // Run the engine
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "evaluate-campaign-status",
          { body: { workspaceId } },
        );
        if (cancelled) return;
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        setResult(data as EngineResult);
        if ((data as any)?.campaign?.name)
          setWorkspaceName((data as any).campaign.name);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Couldn't load performance");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const top = result?.topRecommendation ?? null;
  const primaryKpi = result?.meta.primaryKpi || "cpl";
  const primaryLabel = result?.meta.primaryKpiLabel || "Cost per Lead";
  const secondaryKpi = result?.meta.secondaryKpi || null;
  const campaign = result?.campaign;

  const totalSpend = useMemo(() => {
    return campaign?.windows?.long?.spend ?? 0;
  }, [campaign]);
  const totalResults = campaign?.windows?.long?.results ?? 0;

  function handleSnooze() {
    const until = new Date();
    until.setDate(until.getDate() + 5);
    setSnoozedUntil(until.toISOString());
    toast.success("Snoozed for 5 days", {
      description:
        "We'll surface this again on " + until.toLocaleDateString() + ".",
    });
    // Note: persists to local UI only — wire to recommendation_overrides
    // when that table lands.
  }

  function handleDoIt() {
    toast.success("Got it — opening campaign settings.", {
      description: top?.recommendation?.reasoning,
    });
    navigate(`/ad-performance?workspace=${workspaceId}`);
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <CampaignSpine currentStep={4} />

        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{workspaceName}</h1>
            <p className="text-sm text-muted-foreground">
              Your daily look at what's working and what to do next.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/retrospectives")}
            className="gap-2"
          >
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

        {!loading && error && (
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setWorkspaceId((id) => id)}
              >
                Try again
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && !workspaceId && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No live campaigns yet. Launch one to see daily insights here.
            </CardContent>
          </Card>
        )}

        {!loading && !error && result && (
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
                {top ? (
                  <>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {top.level === "campaign"
                          ? "Campaign"
                          : top.level === "adset"
                            ? "Ad set"
                            : "Ad"}{" "}
                        · {top.name}
                      </div>
                      <div className="text-lg font-semibold">
                        {ACTION_LABEL[top.recommendation.action] ||
                          top.recommendation.action}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {top.recommendation.reasoning}
                      </p>
                    </div>

                    {whyOpen && (
                      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                        <div>
                          <strong className="text-foreground">
                            Confidence:
                          </strong>{" "}
                          {top.recommendation.confidence}
                        </div>
                        <div>
                          <strong className="text-foreground">Status:</strong>{" "}
                          {STATUS_STYLE[top.status]?.label || top.status}
                        </div>
                        <div>
                          <strong className="text-foreground">
                            Last 30 days:
                          </strong>{" "}
                          ${top.windows.long.spend.toFixed(2)} spend ·{" "}
                          {top.windows.long.results} results
                        </div>
                      </div>
                    )}

                    {snoozedUntil && (
                      <div className="text-xs text-muted-foreground italic">
                        Snoozed until{" "}
                        {new Date(snoozedUntil).toLocaleDateString()}.
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleDoIt} className="gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Do it
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setWhyOpen((v) => !v)}
                        className="gap-2"
                      >
                        <HelpCircle className="h-4 w-4" />
                        Why?
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={handleSnooze}
                        className="gap-2"
                      >
                        <Clock className="h-4 w-4" />
                        Snooze 5 days
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nothing urgent — everything's tracking. We'll holler when
                    that changes. ✨
                  </p>
                )}
              </CardContent>
            </Card>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard
                icon={<DollarSign className="h-4 w-4" />}
                label="Spend (30d)"
                value={`$${totalSpend.toFixed(2)}`}
              />
              <KpiCard
                icon={<Target className="h-4 w-4" />}
                label="Results (30d)"
                value={`${totalResults}`}
              />
              <KpiCard
                icon={<Target className="h-4 w-4" />}
                label={primaryLabel}
                value={formatKpi(primaryKpi, campaign?.primary.value ?? null)}
                hint={
                  campaign?.primary.vsGoalPct != null
                    ? `${campaign.primary.vsGoalPct > 0 ? "+" : ""}${campaign.primary.vsGoalPct.toFixed(0)}% vs goal`
                    : undefined
                }
              />
              <KpiCard
                icon={<Target className="h-4 w-4" />}
                label={campaign?.secondary?.label || "Secondary"}
                value={
                  campaign?.secondary
                    ? formatKpi(secondaryKpi || "", campaign.secondary.value)
                    : "—"
                }
              />
            </div>

            {/* Your ads right now */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your ads right now</CardTitle>
              </CardHeader>
              <CardContent>
                {result.ads.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No ads in this window.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {result.ads.map((ad) => {
                      const s = STATUS_STYLE[ad.status] ?? STATUS_STYLE.learning;
                      return (
                        <li
                          key={ad.id}
                          className="py-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {ad.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {formatKpi(primaryKpi, ad.primary.value)} ·{" "}
                              {ad.windows.long.results} results · $
                              {ad.windows.long.spend.toFixed(0)} spend
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn("flex-shrink-0", s.cls)}
                          >
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
              <Button
                variant="link"
                onClick={() => navigate("/retrospectives")}
                className="gap-2"
              >
                <History className="h-4 w-4" />
                See full lifetime history
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
        {hint && (
          <div className="text-xs text-muted-foreground mt-1">{hint}</div>
        )}
      </CardContent>
    </Card>
  );
}
