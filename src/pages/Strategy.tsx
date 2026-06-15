import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  CheckCircle2,
  Sparkles,
  Package,
  Settings2,
  Mail,
  RotateCcw,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CampaignSpine } from "@/components/CampaignSpine";
import { useBrand } from "@/contexts/BrandContext";
import { useCampaignDraft } from "@/contexts/CampaignDraftContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { clearStrategyPlan } from "./StrategyPlan";

type CampaignPlan = {
  name?: string;
  objective?: string;
  goal?: string;
  audience?: string;
  budget_pct?: number;
  creative_brief?: string;
  description?: string;
};

type MatchedStrategy = {
  id: string;
  slug: string;
  name: string;
  description: string;
  why_it_works: string;
  campaigns: CampaignPlan[];
};

type OfferRow = {
  id: string;
  name: string | null;
  description: string | null;
  price_point: string | null;
  target_outcome: string | null;
  url: string | null;
};

const CYCLE_PHRASES = [
  "your website",
  "your audience psychological profile",
  "your brand information",
  "your selected offer",
  "your goals",
];

function CyclingReviewing() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setIndex((p) => (p + 1) % CYCLE_PHRASES.length),
      2500,
    );
    return () => clearInterval(t);
  }, []);
  return (
    <p className="text-sm text-muted-foreground mt-3">
      Reviewing{" "}
      <span className="relative inline-block min-w-[12ch] text-center align-bottom">
        <AnimatePresence mode="wait">
          <motion.span
            key={index}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-gradient-lumi font-medium"
          >
            {CYCLE_PHRASES[index]}
          </motion.span>
        </AnimatePresence>
        <span className="invisible whitespace-nowrap">
          {CYCLE_PHRASES.reduce((a, b) => (a.length > b.length ? a : b))}
        </span>
      </span>
    </p>
  );
}

function summarizeAudience(campaigns: CampaignPlan[]): string {
  const unique = Array.from(
    new Set(
      campaigns
        .map((c) => (c.audience || "").trim())
        .filter(Boolean),
    ),
  );
  if (unique.length === 0) return "Broad+ (LUMI's default)";
  if (unique.length === 1) return unique[0];
  return unique.join(" → ");
}

function summarizeCampaignType(matched: MatchedStrategy): string {
  const count = matched.campaigns?.length ?? 0;
  if (count <= 1) {
    const c = matched.campaigns?.[0];
    return c?.name || matched.name;
  }
  return `${matched.name} · ${count}-campaign funnel`;
}

const STARTING_BUDGET_DEFAULT = "$20/day to start";

export default function Strategy() {
  const navigate = useNavigate();
  const { activeBrand, loading: brandsLoading } = useBrand();
  const { setStrategy, clearDraft } = useCampaignDraft();

  const [step, setStep] = useState<
    "pick_offer" | "thinking" | "result" | "pending" | "error"
  >("pick_offer");
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [matched, setMatched] = useState<MatchedStrategy | null>(null);
  const [intro, setIntro] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!brandsLoading && !activeBrand) {
      toast.error("Add a brand first so LUMI can build your strategy.");
      navigate("/start");
    }
  }, [brandsLoading, activeBrand, navigate]);

  useEffect(() => {
    if (!activeBrand) return;
    let cancelled = false;
    (async () => {
      setOffersLoading(true);
      try {
        const { data, error } = await supabase
          .from("offers")
          .select("id,name,description,price_point,target_outcome,url")
          .eq("brand_id", activeBrand.id)
          .eq("archived", false)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const list = (data ?? []) as unknown as OfferRow[];
        if (!cancelled) {
          setOffers(list);
          if (list.length === 1) setSelectedOfferId(list[0].id);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setOffers([]);
      } finally {
        if (!cancelled) setOffersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBrand]);

  const runRecommendation = async (offerId: string | null) => {
    if (!activeBrand) return;
    setStep("thinking");
    setErrorMsg(null);
    setMatched(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "recommend-strategy",
        {
          body: {
            brand_id: activeBrand.id,
            user_goal: "auto",
            offer_id: offerId,
          },
        },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.matched && data?.strategy) {
        setMatched(data.strategy as MatchedStrategy);
        setIntro(data.personalized_intro ?? "");
        setStep("result");
      } else if (data?.pending) {
        setPendingRequestId(data.request_id ?? null);
        setStep("pending");
      } else {
        throw new Error("No recommendation returned");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message ?? "Something went wrong");
      setStep("error");
      toast.error(err?.message ?? "Could not get a recommendation");
    }
  };

  const persistPlan = () => {
    if (!matched) return null;
    const campaigns = matched.campaigns ?? [];
    const stored = {
      slug: matched.slug,
      name: matched.name,
      why_it_works: matched.why_it_works,
      intro,
      campaigns,
      statuses: campaigns.map(() => "todo" as const),
      activeIndex: null as number | null,
      offer_id: selectedOfferId,
    };
    sessionStorage.setItem("lumi_strategy_plan", JSON.stringify(stored));
    return stored;
  };

  const handleApprove = () => {
    if (!matched) return;
    persistPlan();
    const primary = matched.campaigns?.[0] ?? {};
    setStrategy({
      id: matched.id,
      slug: matched.slug,
      name: matched.name,
      description: matched.description,
      goal: primary.goal,
      objective: primary.objective,
      audience: summarizeAudience(matched.campaigns ?? []),
      creative_brief: primary.creative_brief,
      why_it_works: matched.why_it_works,
      campaigns: matched.campaigns,
      offer_id: selectedOfferId,
    });
    navigate("/creative");
  };

  const handleAdjust = () => {
    persistPlan();
    navigate("/strategy-plan");
  };

  const handleStartOver = () => {
    clearStrategyPlan();
    clearDraft();
    setMatched(null);
    setIntro("");
    setSelectedOfferId(offers.length === 1 ? offers[0].id : null);
    setStep("pick_offer");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <CampaignSpine currentStep={1} />

        <div className="space-y-2 mb-8">
          <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-tight">
            What should you run?
          </h1>
          <p className="text-muted-foreground">
            LUMI read your offer and goal. Here's the plan it recommends —
            approve it or tweak it.
          </p>
          {activeBrand && (
            <p className="text-xs text-muted-foreground">
              For{" "}
              <span className="font-medium text-foreground">
                {activeBrand.name}
              </span>
              {activeBrand.industry ? ` · ${activeBrand.industry}` : ""}
            </p>
          )}
        </div>

        {step === "pick_offer" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <Card className="p-5 border-lumi-pink-1/30 bg-gradient-to-br from-lumi-pink-1/5 to-lumi-purple-1/5">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-lumi-pink-1 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-semibold mb-1">What are we promoting?</h2>
                  <p className="text-sm text-muted-foreground">
                    Pick the specific offer you want ads to drive to — webinar,
                    course, product, service. Your strategy is built around it.
                  </p>
                </div>
              </div>
            </Card>

            {offersLoading ? (
              <div className="text-center py-10">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : offers.length === 0 ? (
              <Card className="p-6 text-center">
                <Package className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium mb-1">No offers yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Add the webinar, course, or product you want to advertise so
                  LUMI builds the right strategy.
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button onClick={() => navigate("/dashboard?tab=offers")}>
                    Add an offer
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => runRecommendation(null)}
                  >
                    Skip — use brand defaults
                  </Button>
                </div>
              </Card>
            ) : (
              <>
                <div className="space-y-2">
                  {offers.map((o) => {
                    const isSelected = selectedOfferId === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setSelectedOfferId(o.id)}
                        className={`w-full text-left rounded-lg border p-4 transition ${
                          isSelected
                            ? "border-lumi-pink-1 bg-lumi-pink-1/5 shadow-glow"
                            : "border-border hover:border-lumi-pink-1/50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`h-5 w-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                              isSelected
                                ? "border-lumi-pink-1 bg-lumi-pink-1"
                                : "border-muted-foreground/40"
                            }`}
                          >
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">
                                {o.name ?? "Untitled offer"}
                              </span>
                              {o.price_point && (
                                <Badge variant="outline" className="text-xs">
                                  {o.price_point}
                                </Badge>
                              )}
                            </div>
                            {o.target_outcome && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {o.target_outcome}
                              </p>
                            )}
                            {o.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {o.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate("/dashboard?tab=offers")}
                    className="flex-1"
                  >
                    Add a different offer
                  </Button>
                  <Button
                    onClick={() => runRecommendation(selectedOfferId)}
                    disabled={!selectedOfferId}
                    className="flex-1"
                  >
                    Get my plan <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}

        {step === "thinking" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Loader2 className="h-10 w-10 animate-spin text-lumi-pink-1 mx-auto mb-4" />
            <p className="font-medium">
              LUMI is matching the right plan for you…
            </p>
            <CyclingReviewing />
          </motion.div>
        )}

        {step === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-10 space-y-4"
          >
            <p className="text-sm text-destructive">
              {errorMsg ?? "We couldn't generate a recommendation right now."}
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={handleStartOver}>
                Start over
              </Button>
              <Button onClick={() => runRecommendation(selectedOfferId)}>
                Try again
              </Button>
            </div>
          </motion.div>
        )}

        {step === "pending" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-10"
          >
            <div className="inline-flex h-14 w-14 rounded-full bg-lumi-pink-1/10 items-center justify-center mb-4">
              <Mail className="h-7 w-7 text-lumi-pink-1" />
            </div>
            <h2 className="text-xl font-heading font-bold mb-2">
              LUMI is hand-crafting your plan
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Your business is unique enough that we want to build this by
              hand. We'll email you within 1 business day with the exact
              campaigns to run.
            </p>
            {pendingRequestId && (
              <p className="text-xs text-muted-foreground">
                Reference: {pendingRequestId}
              </p>
            )}
            <Button
              variant="outline"
              onClick={handleStartOver}
              className="mt-6"
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Start over
            </Button>
          </motion.div>
        )}

        {step === "result" && matched && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <Card className="p-6 border-lumi-pink-1/30 bg-gradient-to-br from-lumi-pink-1/5 to-lumi-purple-1/5">
              <Badge className="mb-3 bg-gradient-to-r from-lumi-pink-1 to-lumi-orange-1 text-white border-0">
                LUMI recommends
              </Badge>
              <h2 className="text-2xl font-heading font-bold mb-4">
                {matched.name}
              </h2>

              <div className="grid sm:grid-cols-3 gap-3 mb-5">
                <div className="rounded-lg bg-background/60 border border-border/60 p-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    <Target className="h-3.5 w-3.5" /> Campaign type
                  </div>
                  <p className="text-sm font-medium">
                    {summarizeCampaignType(matched)}
                  </p>
                </div>
                <div className="rounded-lg bg-background/60 border border-border/60 p-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    <Users className="h-3.5 w-3.5" /> Audience
                  </div>
                  <p className="text-sm font-medium">
                    {summarizeAudience(matched.campaigns ?? [])}
                  </p>
                </div>
                <div className="rounded-lg bg-background/60 border border-border/60 p-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    <Wallet className="h-3.5 w-3.5" /> Starting budget
                  </div>
                  <p className="text-sm font-medium">
                    {STARTING_BUDGET_DEFAULT}
                  </p>
                </div>
              </div>

              {(matched.why_it_works || intro) && (
                <div className="text-sm text-foreground/90 leading-relaxed">
                  <p className="font-medium mb-1">Why this</p>
                  <p className="text-muted-foreground">
                    {matched.why_it_works ||
                      intro ||
                      "This plan matches your offer, audience, and goal based on the brand info LUMI has on file."}
                  </p>
                </div>
              )}
            </Card>

            <div className="flex gap-3 pt-1 flex-wrap">
              <Button variant="ghost" onClick={handleStartOver}>
                <RotateCcw className="h-4 w-4 mr-1" /> Start over
              </Button>
              <Button
                variant="outline"
                onClick={handleAdjust}
                className="flex-1"
              >
                <Settings2 className="h-4 w-4 mr-1" /> Adjust the plan
              </Button>
              <Button onClick={handleApprove} className="flex-1">
                Use this plan — build creative
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
