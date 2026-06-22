import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CampaignSpine } from "@/components/CampaignSpine";
import { useCampaignDraft } from "@/contexts/CampaignDraftContext";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertTriangle, Loader2, Rocket, Layers, ShieldCheck, ArrowLeft, Sparkles } from "lucide-react";
import CampaignBuilder from "@/pages/CampaignBuilder";
import AdvancedBuild from "@/pages/AdvancedBuild";

// ============================================================================
// /launch — Step 3 of the campaign workflow.
//
// Front door that merges the streamlined CampaignBuilder (Simple) and
// AdvancedBuild (Advanced) into a single page with a toggle. Both
// embedded children still call the existing build-meta-campaign edge
// function for publishing — none of that logic is rewritten here.
//
// On top we show two read-only summary cards driven by the shared
// CampaignDraftContext (set in /strategy and /creative) plus live
// pre-flight checks against Meta + Pixel.
// ============================================================================

type CheckState = "pass" | "warn" | "fail" | "pending";
interface PreflightCheck {
  id: string;
  label: string;
  state: CheckState;
  detail?: string;
}

function StatusIcon({ state }: { state: CheckState }) {
  if (state === "pending")
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (state === "pass")
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  return (
    <AlertTriangle
      className={
        state === "warn" ? "h-4 w-4 text-amber-500" : "h-4 w-4 text-destructive"
      }
    />
  );
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function Launch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workspaceId = searchParams.get("workspace");
  const { draft } = useCampaignDraft();
  const { activeBrand } = useBrand();
  const [mode, setMode] = useState<"simple" | "advanced">("simple");

  const concepts = draft.concepts ?? [];
  const strategy = draft.strategy ?? null;

  // Group concepts by angle for the Structure card
  const grouped = useMemo(() => {
    const byAngle = new Map<string, typeof concepts>();
    for (const c of concepts) {
      const angle = (c.angle || "Untagged").toString();
      const arr = byAngle.get(angle) ?? [];
      arr.push(c);
      byAngle.set(angle, arr);
    }
    return Array.from(byAngle.entries());
  }, [concepts]);

  const totalAds = concepts.length;
  const totalAngles = grouped.length;

  const productName =
    strategy?.name ||
    (strategy as any)?.offer_name ||
    activeBrand?.name ||
    "Campaign";
  const objectiveName = (
    (strategy as any)?.optimization_event ||
    (strategy as any)?.objective ||
    "PURCHASE"
  )
    .toString()
    .toUpperCase();
  const campaignName = `LUMI // ${objectiveName} - ${productName} - ${todayISO()}`;
  const adSetName = `Ad Set 1 - Broad+`;

  // ── Pre-flight checks ──────────────────────────────────────────────────
  const [meta, setMeta] = useState<PreflightCheck>({
    id: "meta",
    label: "Meta connected",
    state: "pending",
  });
  const [pixel, setPixel] = useState<PreflightCheck>({
    id: "pixel",
    label: "Pixel firing",
    state: "pending",
  });
  const budgetCheck: PreflightCheck = useMemo(() => {
    const b = draft.budget?.daily || draft.budget?.total;
    return b
      ? { id: "budget", label: "Budget set", state: "pass", detail: `$${b}` }
      : {
          id: "budget",
          label: "Budget set",
          state: "warn",
          detail: "Set in the builder below",
        };
  }, [draft.budget]);
  const leadFormCheck: PreflightCheck = useMemo(() => {
    const needsLeadForm = /LEAD/.test(objectiveName);
    if (!needsLeadForm)
      return {
        id: "lead",
        label: "Lead form fields",
        state: "pass",
        detail: "Not required for this objective",
      };
    return {
      id: "lead",
      label: "Lead form fields",
      state: "warn",
      detail: "Confirm in the builder below",
    };
  }, [objectiveName]);

  useEffect(() => {
    let cancelled = false;
    const brandId = activeBrand?.id;
    if (!brandId) return;

    (async () => {
      try {
        const { data } = await supabase.functions.invoke("check-meta-setup", {
          body: { brandId },
        });
        if (cancelled) return;
        const status = data?.overallStatus;
        setMeta({
          id: "meta",
          label: "Meta connected",
          state:
            status === "healthy"
              ? "pass"
              : status === "limited"
                ? "warn"
                : "fail",
          detail: data?.summary,
        });
      } catch {
        if (!cancelled)
          setMeta({
            id: "meta",
            label: "Meta connected",
            state: "fail",
            detail: "Couldn't reach Meta",
          });
      }

      try {
        const { data } = await supabase.functions.invoke("check-pixel-status", {
          body: { brandId },
        });
        if (cancelled) return;
        const ok = data?.success && (data?.pixel || data?.pixels?.length);
        setPixel({
          id: "pixel",
          label: "Pixel firing",
          state: ok ? "pass" : "warn",
          detail: ok ? undefined : "No recent events detected",
        });
      } catch {
        if (!cancelled)
          setPixel({
            id: "pixel",
            label: "Pixel firing",
            state: "warn",
            detail: "Couldn't verify pixel",
          });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeBrand?.id]);

  const checks: PreflightCheck[] = [meta, pixel, budgetCheck, leadFormCheck];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <CampaignSpine currentStep={3} />

        {/* Missing prerequisites — shown when the draft is empty */}
        {(concepts.length === 0 || !strategy) && (
          <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                You're not ready to launch yet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-amber-900/90 dark:text-amber-100/90">
                Meta needs creative (and a strategy) before this campaign can go
                live. Here's what's still missing:
              </p>
              <ul className="space-y-3">
                {!strategy && (
                  <li className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-background p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">No strategy picked</div>
                      <div className="text-xs text-muted-foreground">
                        Pick a recommended strategy so LUMI knows the goal and
                        audience.
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate("/strategy")}
                      className="gap-1 flex-shrink-0"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Go to Strategy
                    </Button>
                  </li>
                )}
                {concepts.length === 0 && (
                  <li className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-background p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        No creative concepts selected
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Choose at least 4 concepts in Creative so Meta has
                        enough to test.
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => navigate("/creative")}
                      className="gap-1 flex-shrink-0"
                    >
                      <Sparkles className="h-3 w-3" />
                      Pick concepts
                    </Button>
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        )}


        {/* Structure */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-lumi-pink-1" />
              Campaign structure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <div className="font-mono text-xs text-muted-foreground">
                Campaign
              </div>
              <div className="font-medium truncate">{campaignName}</div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <div className="font-mono text-xs text-muted-foreground">
                Ad set
              </div>
              <div className="font-medium">{adSetName}</div>
            </div>

            {totalAds === 0 ? (
              <p className="text-muted-foreground">
                No ads selected yet. Pick concepts in the Creative step.
              </p>
            ) : (
              <div className="space-y-3">
                {grouped.map(([angle, items]) => (
                  <div key={angle} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{angle}</div>
                      <Badge variant="secondary">{items.length} ads</Badge>
                    </div>
                    <ul className="space-y-1">
                      {items.map((c, i) => (
                        <li
                          key={c.id}
                          className="text-xs text-muted-foreground truncate"
                        >
                          {i + 1}. {c.title || c.templateName || c.id}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                <p className="text-sm text-muted-foreground italic">
                  {totalAds} variations across {totalAngles}{" "}
                  {totalAngles === 1 ? "angle" : "angles"} — enough for Meta to
                  find your winner, then LUMI scales it.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pre-flight */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-lumi-pink-1" />
              Pre-flight check
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid sm:grid-cols-2 gap-3">
              {checks.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-2 rounded-lg border p-3"
                >
                  <StatusIcon state={c.state} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{c.label}</div>
                    {c.detail && (
                      <div className="text-xs text-muted-foreground truncate">
                        {c.detail}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Builder — Simple / Advanced */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Rocket className="h-4 w-4 text-lumi-pink-1" />
              Publish to Meta
            </CardTitle>
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as typeof mode)}
            >
              <TabsList>
                <TabsTrigger value="simple">Simple</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Launches paused — nothing spends until you flip it on.
            </p>

            {!workspaceId ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Pick or create a campaign workspace from the Creative step to
                continue.
              </div>
            ) : (
              <Tabs value={mode}>
                <TabsContent value="simple" className="mt-0">
                  <CampaignBuilder embedded />
                </TabsContent>
                <TabsContent value="advanced" className="mt-0">
                  <AdvancedBuild embedded />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
