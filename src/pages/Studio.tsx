import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import Performance, { PerformanceSummary } from "@/pages/Performance";
import { CampaignsList } from "@/components/CampaignsList";
import { ResumeWorkspaceBanner } from "@/components/ResumeWorkspaceBanner";
import { MetaImportBridgeBanner } from "@/components/insights/MetaImportBridgeBanner";
import { ImportFromMetaButton } from "@/components/insights/ImportFromMetaButton";
import { DateRangePillPicker } from "@/components/insights/DateRangePillPicker";
import { GridShimmer } from "@/components/GradientShimmer";
import { Plus, PenTool, ChevronDown } from "lucide-react";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ============================================================================
// /studio — the single home for everything a brand is running or building.
//
//   Today's move  → the performance engine's highest-impact recommendation,
//                   one at a time (rendered inside <Performance>)
//   Metric strip  → spend, leads, best performer, needs-attention count
//   LIVE          → the performance engine (recommendations + campaign rows)
//   IN PROGRESS   → drafts you're still building, resume where you left off
//
// Replaces the old split between /live-ads and /campaigns.
// ============================================================================

const STORAGE_PREFIX = "lumi:my-ads:sections";

function fmtDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Mirrors Performance.tsx's own activeRange math so the metric strip's
// spend/leads numbers cover exactly the same window as everything else.
function rangeToDates(dateRange: string, customDateRange: { from: Date; to: Date } | null) {
  if (dateRange === "custom" && customDateRange) {
    return { since: fmtDay(customDateRange.from), until: fmtDay(customDateRange.to) };
  }
  if (dateRange === "yesterday") {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return { since: fmtDay(y), until: fmtDay(y) };
  }
  const days = parseInt(dateRange, 10) || 7;
  const until = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { since: fmtDay(from), until: fmtDay(until) };
}

function previousPeriod(since: string, until: string) {
  const from = new Date(since);
  const to = new Date(until);
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (days - 1));
  return { since: fmtDay(prevFrom), until: fmtDay(prevTo) };
}

interface AccountTotals {
  spend: number;
  leads: number;
}

function MetricStrip({
  brandId,
  dateRange,
  customDateRange,
  summary,
}: {
  brandId: string;
  dateRange: string;
  customDateRange: { from: Date; to: Date } | null;
  summary: PerformanceSummary | null;
}) {
  const [current, setCurrent] = useState<AccountTotals | null>(null);
  const [previous, setPrevious] = useState<AccountTotals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { since, until } = rangeToDates(dateRange, customDateRange);
    const prev = previousPeriod(since, until);
    (async () => {
      const [curRes, prevRes] = await Promise.all([
        supabase.functions.invoke("fetch-account-overview", {
          body: { brandId, dateRangeStart: since, dateRangeEnd: until },
        }),
        supabase.functions.invoke("fetch-account-overview", {
          body: { brandId, dateRangeStart: prev.since, dateRangeEnd: prev.until },
        }),
      ]);
      if (cancelled) return;
      const cur = curRes.data?.metrics;
      const prv = prevRes.data?.metrics;
      setCurrent(cur ? { spend: Number(cur.spend || 0), leads: Number(cur.leads || 0) } : null);
      setPrevious(prv ? { spend: Number(prv.spend || 0), leads: Number(prv.leads || 0) } : null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [brandId, dateRange, customDateRange]);

  const spendDeltaPct = current && previous && previous.spend > 0
    ? Math.round(((current.spend - previous.spend) / previous.spend) * 100)
    : null;
  const costPerLead = current && current.leads > 0 ? current.spend / current.leads : null;
  const prevCostPerLead = previous && previous.leads > 0 ? previous.spend / previous.leads : null;

  const tiles = [
    {
      key: "spend",
      label: "Spend",
      value: loading ? "—" : current ? `$${current.spend.toFixed(0)}` : "—",
      footnote: spendDeltaPct != null ? `${spendDeltaPct >= 0 ? "+" : ""}${spendDeltaPct}% vs last period` : null,
      footnoteGood: spendDeltaPct != null && spendDeltaPct >= 0,
    },
    {
      key: "leads",
      label: "Leads",
      value: loading ? "—" : current ? `${current.leads}` : "—",
      footnote: costPerLead != null
        ? `$${costPerLead.toFixed(2)} each${prevCostPerLead != null ? ` — ${costPerLead <= prevCostPerLead ? "down" : "up"} from $${prevCostPerLead.toFixed(2)}` : ""}`
        : null,
      footnoteGood: costPerLead != null && prevCostPerLead != null && costPerLead <= prevCostPerLead,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {tiles.map((t) => (
        <div key={t.key} className="bg-card border border-border rounded-2xl p-5 shadow-card flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t.label}</span>
          <span className="font-display text-[34px] leading-none tracking-[-0.02em] tabular-nums text-foreground">{t.value}</span>
          {t.footnote && (
            <span className={cn("text-[13px]", t.footnoteGood ? "text-[#16A34A]" : "text-muted-foreground")}>
              {t.footnote}
            </span>
          )}
        </div>
      ))}

      <div className="bg-card border border-border rounded-2xl p-5 shadow-card flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Best performing ad</span>
        {summary?.bestPerformer ? (
          <>
            <span className="text-[15px] font-semibold text-foreground truncate">{summary.bestPerformer.name}</span>
            <span className="text-[13px] text-muted-foreground">
              {summary.bestPerformer.secondaryLabel ? `${summary.bestPerformer.secondaryLabel} · ` : ""}
              {summary.bestPerformer.primaryLabel}
            </span>
          </>
        ) : (
          <span className="font-display text-2xl leading-none tracking-[-0.02em] text-muted-foreground">—</span>
        )}
      </div>

      <div
        className={cn(
          "bg-card border rounded-2xl p-5 shadow-card flex flex-col gap-1.5",
          summary && summary.needsAttentionCount > 0 ? "border-[#F0C4A6]" : "border-border"
        )}
      >
        <span
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.08em]",
            summary && summary.needsAttentionCount > 0 ? "text-[#B4551F]" : "text-muted-foreground"
          )}
        >
          Needs attention
        </span>
        <span className="font-display text-[34px] leading-none tracking-[-0.02em] tabular-nums text-foreground">
          {summary ? summary.needsAttentionCount : "—"}
        </span>
        {summary && summary.needsAttentionReasons.length > 0 && (
          <span className="text-[13px] text-muted-foreground truncate">{summary.needsAttentionReasons.join(", ")}</span>
        )}
      </div>
    </div>
  );
}

export default function Studio() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeBrand, loading: brandLoading } = useBrand();

  const isAddCreativeMode = searchParams.get("addCreative") === "true";

  const [userId, setUserId] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [draftCount, setDraftCount] = useState<number | null>(null);
  const [resumeWorkspaceId, setResumeWorkspaceId] = useState<string | null>(null);
  // Bumped after a Meta import so the live engine refetches
  const [liveRefreshKey, setLiveRefreshKey] = useState(0);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);

  // Date range — the whole page reads off this one control. Same storage
  // keys Performance.tsx used to own, so existing preferences carry over.
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

  const [draftsOpen, setDraftsOpen] = useState(true);
  const [restoredPrefs, setRestoredPrefs] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Restore each user's own open/closed choice for the In progress panel.
  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}:${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.progress === "boolean") setDraftsOpen(parsed.progress);
        setRestoredPrefs(true);
      }
    } catch {
      /* ignore malformed prefs */
    }
  }, [userId]);

  // Default when there's no saved preference: open only when nothing's live yet.
  useEffect(() => {
    if (restoredPrefs || liveCount === null) return;
    setDraftsOpen(liveCount === 0);
  }, [liveCount, restoredPrefs]);

  const toggleDrafts = useCallback(() => {
    setDraftsOpen((prev) => {
      const next = !prev;
      setRestoredPrefs(true);
      if (userId) {
        try {
          localStorage.setItem(`${STORAGE_PREFIX}:${userId}`, JSON.stringify({ live: true, progress: next }));
        } catch {
          /* storage full / blocked — not worth surfacing */
        }
      }
      return next;
    });
  }, [userId]);

  useEffect(() => {
    if (!brandLoading && !activeBrand) navigate("/onboarding");
  }, [brandLoading, activeBrand, navigate]);

  const handleClearAddCreativeMode = () => {
    searchParams.delete("addCreative");
    setSearchParams(searchParams);
  };

  const onSummaryChange = useCallback((s: PerformanceSummary) => setSummary(s), []);

  if (brandLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-[1240px] mx-auto px-8 py-7 space-y-6">
          <h1 className="text-3xl font-display font-bold tracking-tight">
            Ad <span className="text-gradient-lumi">Dashboard</span>
          </h1>
          <GridShimmer count={4} className="grid-cols-1 md:grid-cols-2" />
        </div>
      </DashboardLayout>
    );
  }

  if (!activeBrand) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">No brand found. Please set up your brand first.</p>
        </div>
      </DashboardLayout>
    );
  }

  // "Add creative to…" mode is a focused picker — skip everything else.
  if (isAddCreativeMode) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight">
                Ad <span className="text-gradient-lumi">Dashboard</span>
              </h1>
              <p className="text-muted-foreground mt-2">Select an ad to add new creative to.</p>
            </div>
            <button
              onClick={handleClearAddCreativeMode}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <CampaignsList
            brandId={activeBrand.id}
            addCreativeMode
            onCampaignSelectForCreative={(campaignId) =>
              navigate(`/creative-studio?workspace=${campaignId}&addCreative=true`)
            }
          />
        </div>
      </DashboardLayout>
    );
  }

  const nothingYet = liveCount === 0 && draftCount === 0;

  return (
    <DashboardLayout>
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 py-7 space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-[30px] leading-tight tracking-[-0.02em] text-foreground">
              Ad <span className="text-gradient-lumi">Dashboard</span>
            </h1>
            <p className="text-[15px] text-muted-foreground mt-1">
              Everything you're running, and everything you're building.
            </p>
          </div>
          {!nothingYet && (
            <DateRangePillPicker
              dateRange={dateRange}
              customDateRange={customDateRange}
              onDateRangeChange={setDateRange}
              onCustomDateRangeChange={setCustomDateRange}
            />
          )}
        </div>

        {/* Meta has campaigns LUMI doesn't know about yet */}
        <MetaImportBridgeBanner surface="live-ads" />

        {/* Nothing live, nothing in progress — one clear invitation. */}
        {nothingYet && (
          <div className="rounded-2xl border bg-card/60 px-6 py-14 text-center space-y-4">
            <h2 className="text-xl font-display font-semibold">Make your first ad</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              LUMI will read your brand, pick a strategy, and write the creative with you.
            </p>
            <button
              type="button"
              onClick={() => navigate("/create")}
              className="rounded-lg bg-gradient-warm text-white shadow-sm px-5 py-2.5 inline-flex items-center gap-2 font-semibold tracking-tight transition-transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <Plus className="h-4 w-4" />
              Create a new ad
            </button>
          </div>
        )}

        <div className={nothingYet ? "hidden" : "space-y-6"}>
          <Performance
            key={liveRefreshKey}
            embedded
            hideRangeControl
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            customDateRange={customDateRange}
            onCustomDateRangeChange={setCustomDateRange}
            onLiveCountChange={setLiveCount}
            onSummaryChange={onSummaryChange}
            importButton={
              <ImportFromMetaButton
                brandId={activeBrand.id}
                className="h-8 text-xs shrink-0"
                onImported={() => setLiveRefreshKey((k) => k + 1)}
              />
            }
            betweenMoveAndLive={
              <MetricStrip
                brandId={activeBrand.id}
                dateRange={dateRange}
                customDateRange={customDateRange}
                summary={summary}
              />
            }
          />

          {/* ── IN PROGRESS ────────────────────────────────────────────────── */}
          <section className="rounded-2xl border bg-card overflow-hidden">
            <button
              type="button"
              onClick={toggleDrafts}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
            >
              <ChevronDown
                className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", !draftsOpen && "-rotate-90")}
              />
              <PenTool className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-[0.08em]">In progress</span>
              {draftCount !== null && (
                <span className="text-xs font-medium rounded-full bg-muted px-2 py-0.5 text-muted-foreground tabular-nums">
                  {draftCount}
                </span>
              )}
              <span className="text-xs text-muted-foreground hidden sm:inline">Drafts you're still building</span>
              <span className="ml-auto text-xs font-medium text-lumi-pink-1">
                {draftsOpen ? "Hide" : `Show${draftCount ? ` ${draftCount} draft${draftCount === 1 ? "" : "s"}` : ""}`}
              </span>
            </button>
            <div className={cn("border-t bg-background p-4 space-y-3", !draftsOpen && "hidden")}>
              <ResumeWorkspaceBanner
                brandId={activeBrand.id}
                onWorkspaceResolved={setResumeWorkspaceId}
              />
              <CampaignsList
                brandId={activeBrand.id}
                restrictTo="draft"
                onCountChange={setDraftCount}
                excludeWorkspaceId={resumeWorkspaceId}
              />
            </div>
          </section>

          {/* ── FOOTNOTE ───────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground flex-wrap">
            <span>Numbers come straight from your Meta ad account.</span>
            <span>Need a hand? Ask LUMI in the corner.</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
