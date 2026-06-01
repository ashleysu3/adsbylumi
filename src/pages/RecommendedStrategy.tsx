import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Package,
  MessageCircle,
  Users,
  Instagram,
  MapPin,
  CheckCircle2,
  Mail,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBrand } from "@/contexts/BrandContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const GOALS = [
  { id: "promote_offer", icon: Package, title: "Promote an offer or landing page" },
  { id: "book_calls", icon: MessageCircle, title: "Get people to contact me" },
  { id: "dm_leads", icon: Users, title: "Get people to DM me" },
  { id: "grow_social", icon: Instagram, title: "Grow my social presence" },
  { id: "local", icon: MapPin, title: "Promote a local business or event" },
];

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

const CYCLE_PHRASES = [
  "your website",
  "your audience psychological profile",
  "your brand information",
  "your offers",
  "your goals",
];

function CyclingReviewing() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % CYCLE_PHRASES.length);
    }, 2500);
    return () => clearInterval(timer);
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
  const [step, setStep] = useState<"thinking" | "result" | "error">("thinking");
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

  const runRecommendation = async () => {
    if (!activeBrand) return;
    setStep("thinking");
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "recommend-strategy",
        { body: { brand_id: activeBrand.id, user_goal: "auto" } },
      );
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

  useEffect(() => {
    if (activeBrand && step === "thinking" && !matched) {
      runRecommendation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand]);

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
          <CyclingBasedOn />
          {activeBrand && (
            <p className="text-sm text-muted-foreground">
              For <span className="font-medium text-foreground">{activeBrand.name}</span>
              {activeBrand.industry ? ` · ${activeBrand.industry}` : ""}
            </p>
          )}
        </div>

        {step === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-10 space-y-4"
          >
            <p className="text-sm text-destructive">
              {errorMsg ?? "We couldn't generate a recommendation right now."}
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate("/create")}>
                Pick a campaign myself
              </Button>
              <Button onClick={runRecommendation}>Try again</Button>
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
            <p className="text-sm text-muted-foreground mt-1">
              Reading your brand, offers, and goal.
            </p>
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

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => navigate("/create")} className="flex-1">
                Pick a different goal
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
              <Button variant="outline" onClick={() => navigate("/create")}>
                Pick a campaign myself
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
