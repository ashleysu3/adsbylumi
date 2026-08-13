import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import Performance from "@/pages/Performance";
import { CampaignsList } from "@/components/CampaignsList";
import { ResumeWorkspaceBanner } from "@/components/ResumeWorkspaceBanner";
import { MetaImportBridgeBanner } from "@/components/insights/MetaImportBridgeBanner";
import { ImportFromMetaButton } from "@/components/insights/ImportFromMetaButton";
import { GridShimmer } from "@/components/GradientShimmer";
import { Button } from "@/components/ui/button";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, Radio, PenTool, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// /studio — the single home for everything a brand is running or building.
//
//   LIVE          → the performance engine (recommendations + campaign cards)
//   IN PROGRESS   → drafts you're still building, resume where you left off
//
// Replaces the old split between /live-ads and /campaigns.
// ============================================================================

type SectionKey = "live" | "progress";

const STORAGE_PREFIX = "lumi:my-ads:sections";

function SectionHeader({
  open,
  icon: Icon,
  label,
  count,
  hint,
}: {
  open: boolean;
  icon: any;
  label: string;
  count: number | null;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 w-full text-left">
      <ChevronDown
        className={cn(
          "h-4 w-4 text-muted-foreground transition-transform shrink-0",
          !open && "-rotate-90",
        )}
      />
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm font-semibold uppercase tracking-wide">{label}</span>
      {count !== null && (
        <span className="text-xs font-medium rounded-full bg-muted px-2 py-0.5 text-muted-foreground tabular-nums">
          {count}
        </span>
      )}
      {hint && <span className="text-xs text-muted-foreground hidden sm:inline truncate">{hint}</span>}
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


  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    live: true,
    progress: false,
  });
  const [restoredPrefs, setRestoredPrefs] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Restore each user's own open/closed choice.
  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}:${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        setOpenSections((prev) => ({ ...prev, ...parsed }));
        setRestoredPrefs(true);
      }
    } catch {
      /* ignore malformed prefs */
    }
  }, [userId]);

  // Default behaviour when the user has no saved preference:
  // Live open, In progress open only when there's nothing live yet.
  useEffect(() => {
    if (restoredPrefs || liveCount === null) return;
    setOpenSections({ live: liveCount > 0, progress: liveCount === 0 });
  }, [liveCount, restoredPrefs]);

  const toggleSection = useCallback(
    (key: SectionKey) => {
      setOpenSections((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        setRestoredPrefs(true);
        if (userId) {
          try {
            localStorage.setItem(`${STORAGE_PREFIX}:${userId}`, JSON.stringify(next));
          } catch {
            /* storage full / blocked — not worth surfacing */
          }
        }
        return next;
      });
    },
    [userId],
  );

  useEffect(() => {
    if (!brandLoading && !activeBrand) navigate("/onboarding");
  }, [brandLoading, activeBrand, navigate]);

  const handleClearAddCreativeMode = () => {
    searchParams.delete("addCreative");
    setSearchParams(searchParams);
  };

  if (brandLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
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

  // "Add creative to…" mode is a focused picker — skip the live section entirely.
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

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Page header */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">
              Ad <span className="text-gradient-lumi">Dashboard</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Everything you're running, and everything you're building.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/create")}
            className="rounded-lg bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 text-white shadow-sm px-4 py-2.5 flex items-center gap-2 font-semibold tracking-tight transition-transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Plus className="h-4 w-4" />
            Create a new ad
          </button>
        </div>

        {/* Meta has campaigns LUMI doesn't know about yet */}
        <MetaImportBridgeBanner surface="live-ads" />

        {/* Nothing live, nothing in progress — one clear invitation. */}
        {liveCount === 0 && draftCount === 0 && (
          <div className="rounded-2xl border bg-card/60 px-6 py-14 text-center space-y-4">
            <h2 className="text-xl font-display font-semibold">Make your first ad</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              LUMI will read your brand, pick a strategy, and write the creative with you.
            </p>
            <button
              type="button"
              onClick={() => navigate("/create")}
              className="rounded-lg bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 text-white shadow-sm px-5 py-2.5 inline-flex items-center gap-2 font-semibold tracking-tight transition-transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <Plus className="h-4 w-4" />
              Create a new ad
            </button>
          </div>
        )}

        <div className={liveCount === 0 && draftCount === 0 ? "hidden" : "space-y-6"}>
        {/* ── LIVE ───────────────────────────────────────────────────────── */}
        {/* Header and content share one panel so the section reads as a single
            block instead of a floating title above a gap. Both engines stay
            mounted while collapsed so the counts are accurate. */}
        <section className="rounded-xl border bg-card/60 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              type="button"
              onClick={() => toggleSection("live")}
              className="flex-1 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              <SectionHeader
                open={openSections.live}
                icon={Radio}
                label="Live"
                count={liveCount}
                hint="Running, paused, or off in Meta"
              />
            </button>
            <ImportFromMetaButton
              brandId={activeBrand.id}
              className="shrink-0"
              onImported={() => setLiveRefreshKey((k) => k + 1)}
            />
          </div>
          <div className={cn("border-t", !openSections.live && "hidden")}>
            {liveCount === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No ads running yet — finish a draft below and hit publish, or import what's
                already running in Meta.
              </p>
            ) : null}
            <div className={cn("p-4", liveCount === 0 && "hidden")}>
              <Performance key={liveRefreshKey} embedded onLiveCountChange={setLiveCount} />
            </div>
          </div>
        </section>

        {/* ── IN PROGRESS ────────────────────────────────────────────────── */}
        <section className="rounded-xl border bg-card/60 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("progress")}
            className="w-full px-4 py-3 hover:bg-card transition-colors"
          >
            <SectionHeader
              open={openSections.progress}
              icon={PenTool}
              label="In progress"
              count={draftCount}
              hint="Drafts you're still building"
            />
          </button>
          <div className={cn("border-t p-4 space-y-3", !openSections.progress && "hidden")}>
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
        </div>


      </div>
    </DashboardLayout>
  );
}
