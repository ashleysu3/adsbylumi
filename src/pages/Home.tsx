import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Check, Clock, Trash2, Rocket, Plug, ChevronRight, Loader2, Plus, Activity } from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { IntentBar } from "@/components/IntentBar";
import { SetupPrompt } from "@/components/SetupPrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { useBrand } from "@/contexts/BrandContext";
import { useTasks } from "@/hooks/useTasks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CampaignSuggestion {
  workspaceId: string;
  workspaceName: string;
  recId: string;
  title: string;
  reasoning: string;
}

const ACTION_VERB: Record<string, string> = {
  turn_off: "Turn off",
  scale: "Scale",
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

const TYPEWRITER_PROMPTS = [
  "Launch a new campaign",
  "Why is my cost per lead up?",
  "Make a creative from my board",
  "What needs my attention?",
];

// Easy to edit: add/remove witty sublines here.
const SUBLINES = [
  "Let's turn some scrollers into buyers.",
  "Today's forecast: high CTR, chance of conversions.",
  "Let's make some ads they can't scroll past.",
  "Coffee first. Then we charm the algorithm.",
  "Your offer + the right humans = magic. Let's go.",
  "Time to stop the scroll.",
  "Let's turn ad spend into 'take my money.'",
  "Another day, another algorithm to win over.",
  "Big launches start with small daily budgets.",
  "Let's make the pixel proud.",
  "Test today, scale tomorrow.",
  "Warm up that audience like last night's leftovers.",
  "Less doomscrolling your ad account. More winning.",
  "Your best ad is the one you haven't tested yet.",
];

function buildGreeting(name: string): string {
  const n = name ? `, ${name}` : "";
  const hour = new Date().getHours();
  let variants: string[];
  if (hour < 12) {
    variants = [`Good morning${n}`, `Morning${n} ☀`, `Howdy${n}`, `Rise and shine${n}`];
  } else if (hour < 17) {
    variants = [`Good afternoon${n}`, `Afternoon${n}`, `Howdy${n}`, `Hey${n}`];
  } else {
    variants = [`Good evening${n}`, `Evening${n}`, `Howdy${n}`, `Hey${n} 🌙`];
  }
  return variants[Math.floor(Math.random() * variants.length)];
}

export default function Home() {
  const navigate = useNavigate();
  const { activeBrand, brands, loading: brandLoading } = useBrand();
  const { tasks, loading: tasksLoading, updateStatus, snoozeTask, deleteTask } = useTasks("open");

  const [firstName, setFirstName] = useState<string>("");
  const [campaignSuggestions, setCampaignSuggestions] = useState<CampaignSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [hasMetaConnection, setHasMetaConnection] = useState<boolean>(true);
  const [hasActiveCampaigns, setHasActiveCampaigns] = useState<boolean>(true);

  // Greeting — pull first name from profile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const user = u?.user;
        if (!user) return;
        const { data } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        const full = (data?.full_name || "").trim();
        const first = full ? full.split(/\s+/)[0] : (user.email?.split("@")[0] ?? "");
        setFirstName(first);
      } catch {
        /* non-blocking */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load top recommendations across active campaigns — same source the
  // Big Picture / Quick List uses.
  useEffect(() => {
    if (brandLoading) return;
    if (!activeBrand) {
      setSuggestionsLoading(false);
      setHasActiveCampaigns(false);
      return;
    }

    let cancelled = false;
    setSuggestionsLoading(true);

    (async () => {
      try {
        setHasMetaConnection(!!activeBrand.meta_account_id);

        const { data: workspaces } = await supabase
          .from("campaign_workspaces")
          .select("id, name, meta_campaign_ids, meta_campaign_status")
          .eq("brand_id", activeBrand.id)
          .not("meta_campaign_ids", "is", null)
          .order("created_at", { ascending: false });

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
        setHasActiveCampaigns(active.length > 0);
        if (active.length === 0) {
          setCampaignSuggestions([]);
          return;
        }

        // Filter out snoozed recommendations.
        const nowIso = new Date().toISOString();
        const { data: overrides } = await supabase
          .from("recommendation_overrides")
          .select("ad_id, snooze_until")
          .eq("brand_id", activeBrand.id)
          .eq("user_action", "snoozed")
          .gt("snooze_until", nowIso);
        const snoozed = new Set((overrides || []).map((o: any) => o.ad_id).filter(Boolean));

        const settled = await Promise.allSettled(
          active.map((w: any) =>
            supabase.functions
              .invoke("evaluate-campaign-status", {
                body: {
                  workspaceId: w.id,
                  brandId: activeBrand.id,
                  metaCampaignId: (w.meta_campaign_ids as any).campaignId,
                },
              })
              .then((res) => ({ res, workspaceId: w.id as string, workspaceName: w.name as string })),
          ),
        );

        if (cancelled) return;

        const items: Array<CampaignSuggestion & { impact: number }> = [];
        settled.forEach((s) => {
          if (s.status !== "fulfilled") return;
          const d = (s.value.res as any)?.data;
          if (!d || !d.campaign) return;
          const reach = Number(d.campaign.reach || 0);
          if (reach <= 0) return;
          const top = d.topRecommendation;
          if (!top) return;
          if (snoozed.has(top.id)) return;
          const verb = ACTION_VERB[top.recommendation?.action] || top.recommendation?.action || "Review";
          items.push({
            workspaceId: s.value.workspaceId,
            workspaceName: s.value.workspaceName,
            recId: top.id,
            title: `${verb} "${top.name}"`,
            reasoning: top.recommendation?.reasoning || "",
            impact: top.recommendation?.impact ?? 0,
          });
        });

        items.sort((a, b) => b.impact - a.impact);
        setCampaignSuggestions(items.slice(0, 5));
      } catch (e) {
        console.error("[Home] failed loading suggestions", e);
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [activeBrand, brandLoading]);

  const highPriorityTasks = useMemo(() => tasks.slice(0, 5), [tasks]);

  async function handleSnoozeCampaignRec(s: CampaignSuggestion) {
    if (!activeBrand) return;
    const until = new Date();
    until.setDate(until.getDate() + 5);
    setCampaignSuggestions((prev) => prev.filter((x) => x.recId !== s.recId));
    toast.success("Snoozed for 5 days");
    try {
      await supabase.from("recommendation_overrides").insert({
        brand_id: activeBrand.id,
        ad_id: s.recId,
        recommendation_action: "snooze",
        user_action: "snoozed",
        snooze_until: until.toISOString(),
      });
    } catch (e) {
      console.error("snooze persist error", e);
    }
  }

  function handleDeleteCampaignRec(s: CampaignSuggestion) {
    setCampaignSuggestions((prev) => prev.filter((x) => x.recId !== s.recId));
    toast.success("Dismissed");
    // Persistence: treated the same as a long snooze. Server-side dismiss
    // semantics live in the recommendation engine.
    if (activeBrand) {
      const until = new Date();
      until.setDate(until.getDate() + 30);
      supabase.from("recommendation_overrides").insert({
        brand_id: activeBrand.id,
        ad_id: s.recId,
        recommendation_action: "dismiss",
        user_action: "snoozed",
        snooze_until: until.toISOString(),
      }).then(({ error }) => {
        if (error) console.error("dismiss persist error", error);
      });
    }
  }

  const noBrand = !brandLoading && brands.length === 0;
  const loading = brandLoading || suggestionsLoading || tasksLoading;
  const isCaughtUp =
    !loading &&
    !noBrand &&
    hasActiveCampaigns &&
    campaignSuggestions.length === 0 &&
    highPriorityTasks.length === 0;

  const greeting = useMemo(() => buildGreeting(firstName), [firstName]);
  const subline = useMemo(() => SUBLINES[Math.floor(Math.random() * SUBLINES.length)], []);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-10">
        {/* Greeting */}
        <header className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {greeting}
          </h1>
          <p className="text-sm text-muted-foreground italic">
            {subline}
          </p>
        </header>

        {/* AI command bar */}
        <section>
          <IntentBar
            size="lg"
            innerBgClassName="bg-background"
            typewriterPrompts={TYPEWRITER_PROMPTS}
          />
        </section>

        {/* LUMI suggests… */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-lumi-pink-1" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              LUMI suggests…
            </h2>
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Reading the room…
              </CardContent>
            </Card>
          ) : noBrand ? (
            <SetupPrompt
              icon={Rocket}
              title="Finish setting up your brand"
              description="LUMI needs your brand basics before she can suggest anything useful."
              ctaLabel="Set up brand"
              onCta={() => navigate("/brand-setup")}
            />
          ) : !hasMetaConnection ? (
            <SetupPrompt
              icon={Plug}
              title="Connect your Meta ad account"
              description="Once Meta is connected, LUMI will surface what to do next across your campaigns."
              ctaLabel="Connect Meta"
              onCta={() => navigate("/meta-settings")}
              tone="warning"
            />
          ) : !hasActiveCampaigns ? (
            <SetupPrompt
              icon={Rocket}
              title="Launch your first campaign"
              description="Once a campaign is live, LUMI will start showing the moves worth making each week."
              ctaLabel="New campaign"
              onCta={() => navigate("/create")}
            />
          ) : isCaughtUp ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nothing needs you right now — you're all caught up. ✨
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {campaignSuggestions.map((s) => (
                <Card
                  key={s.recId}
                  className="hover:border-lumi-pink-1/40 transition cursor-pointer"
                  onClick={() => navigate(`/live-ads/${s.workspaceId}`)}
                >
                  <CardContent className="py-4 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {s.workspaceName}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium mt-1.5 truncate">{s.title}</p>
                      {s.reasoning && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {s.reasoning}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/live-ads/${s.workspaceId}`);
                          }}
                          className="gap-1.5"
                        >
                          <Check className="h-3.5 w-3.5" /> Review &amp; approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); handleSnoozeCampaignRec(s); }}
                          className="gap-1.5"
                        >
                          <Clock className="h-3.5 w-3.5" /> Snooze
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); handleDeleteCampaignRec(s); }}
                          className="gap-1.5 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Dismiss
                        </Button>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </CardContent>
                </Card>
              ))}

              {highPriorityTasks.map((t) => (
                <Card key={t.id}>
                  <CardContent className="py-4 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        Task
                      </Badge>
                      <p className="text-sm font-medium mt-1.5">{t.title}</p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {t.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {t.link_to && (
                          <Button
                            size="sm"
                            onClick={() => navigate(t.link_to as string)}
                            className="gap-1.5"
                          >
                            <Check className="h-3.5 w-3.5" /> Do it
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const until = new Date();
                            until.setDate(until.getDate() + 5);
                            snoozeTask(t.id, until);
                          }}
                          className="gap-1.5"
                        >
                          <Clock className="h-3.5 w-3.5" /> Snooze
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteTask(t.id)}
                          className="gap-1.5 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
