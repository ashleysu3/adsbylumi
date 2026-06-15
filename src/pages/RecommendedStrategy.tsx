import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Mail,
  RotateCcw,
  Sparkles,
  Package,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { clearStrategyPlan } from "./StrategyPlan";
import { useCampaignDraft } from "@/contexts/CampaignDraftContext";

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
    const t = setInterval(() => setIndex((p) => (p + 1) % CYCLE_PHRASES.length), 2500);
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

export default function RecommendedStrategy() {
  const navigate = useNavigate();
  const { activeBrand, loading: brandsLoading } = useBrand();
  const { clearDraft } = useCampaignDraft();
  const [step, setStep] = useState<"pick_offer" | "thinking" | "result" | "error">(
    "pick_offer",
  );
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [matched, setMatched] = useState<MatchedStrategy | null>(null);
  const [intro, setIntro] = useState<string>("");
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!brandsLoading && !activeBrand) {
      toast.error("Add a brand first so LUMI can build your strategy.");
      navigate("/start");
    }
  }, [brandsLoading, activeBrand, navigate]);

  // Load offers for the active brand
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
        if (!cancelled) setOffers((data ?? []) as unknown as OfferRow[]);
      } catch (err: any) {
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
      const { data, error } = await supabase.functions.invoke("recommend-strategy", {
        body: {
          brand_id: activeBrand.id,
          user_goal: "auto",
          offer_id: offerId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.matched && data?.strategy) {
        setMatched(data.strategy as MatchedStrategy);
        setIntro(data.personalized_intro ?? "");
      } else if (data?.pending) {
        setPendingRequestId(data.request_id ?? null);
        setMatched(null);
      }
      setStep("result");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message ?? "Something went wrong");
      setStep("error");
      toast.error(err?.message ?? "Could not get a recommendation");
    }
  };

  const handleStartOver = () => {
    clearStrategyPlan();
    clearDraft();
    setMatched(null);
    setIntro("");
    setSelectedOfferId(null);
    setStep("pick_offer");
  };

  const handleBuild = () => {
    if (!matched) return;
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
    navigate("/strategy-plan");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/create")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-tight">
            <span className="text-gradient-lumi">LUMI recommends</span>
          </h1>
          {activeBrand && (
            <p className="text-sm text-muted-foreground">
              For <span className="font-medium text-foreground">{activeBrand.name}</span>
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
                  <h2 className="font-semibold mb-1">
                    What are we promoting?
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Pick the specific offer (webinar, course, product, service)
                    you want to run ads to. Your strategy is built around it —
                    not just your main website.
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
                              {o.offer_type && (
                                <Badge variant="secondary" className="text-xs">
                                  {o.offer_type}
                                </Badge>
                              )}
                              {typeof o.price === "number" && o.price > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  ${o.price}
                                </Badge>
                              )}
                            </div>
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
                    Build my strategy <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            )}
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

        {step === "thinking" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Loader2 className="h-10 w-10 animate-spin text-lumi-pink-1 mx-auto mb-4" />
            <p className="font-medium">LUMI is matching the right strategy for you…</p>
            <CyclingReviewing />
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
              <h2 className="text-xl font-heading font-bold mb-2">{matched.name}</h2>
              {intro && (
                <p className="text-sm text-muted-foreground mb-3 italic">"{intro}"</p>
              )}
              {matched.why_it_works && (
                <div className="text-sm text-foreground/90 leading-relaxed">
                  <p className="font-medium mb-1">Why this works for you</p>
                  <p className="text-muted-foreground">{matched.why_it_works}</p>
                </div>
              )}
            </Card>

            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Your campaign plan
              </p>
              {matched.campaigns?.map((c, idx) => (
                <Card key={idx} className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="font-semibold">{c.name ?? `Campaign ${idx + 1}`}</h3>
                      {c.description && (
                        <p className="text-sm text-muted-foreground">{c.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {c.objective && (
                          <Badge variant="secondary">{c.objective}</Badge>
                        )}
                        {c.audience && (
                          <Badge variant="outline">Audience: {c.audience}</Badge>
                        )}
                        {typeof c.budget_pct === "number" && (
                          <Badge variant="outline">{c.budget_pct}% of budget</Badge>
                        )}
                      </div>
                      {c.creative_brief && (
                        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-2">
                          <span className="font-medium text-foreground">Creative brief: </span>
                          {c.creative_brief}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex gap-3 pt-2 flex-wrap">
              <Button variant="ghost" onClick={handleStartOver}>
                <RotateCcw className="h-4 w-4 mr-1" /> Start over
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep("pick_offer")}
                className="flex-1"
              >
                Pick a different offer
              </Button>
              <Button onClick={handleBuild} className="flex-1">
                Build this strategy <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === "result" && !matched && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-10"
          >
            <div className="inline-flex h-14 w-14 rounded-full bg-lumi-pink-1/10 items-center justify-center mb-4">
              <Mail className="h-7 w-7 text-lumi-pink-1" />
            </div>
            <h2 className="text-xl font-heading font-bold mb-2">
              LUMI is building you a custom plan
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Your business is unique enough that we want to hand-craft this. We'll
              email you within 1 business day with the exact campaigns to run.
            </p>
            {pendingRequestId && (
              <p className="text-xs text-muted-foreground mb-6">
                Request ID: {pendingRequestId.slice(0, 8)}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={handleStartOver}>
                Start over
              </Button>
              <Button onClick={() => navigate("/create")}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Got it
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
