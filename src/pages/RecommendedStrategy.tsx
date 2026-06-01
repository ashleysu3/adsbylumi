import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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

export default function RecommendedStrategy() {
  const navigate = useNavigate();
  const { activeBrand, loading: brandsLoading } = useBrand();
  const [step, setStep] = useState<"goal" | "thinking" | "result">("goal");
  const [goal, setGoal] = useState<string | null>(null);
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

  const runRecommendation = async (selectedGoal: string) => {
    if (!activeBrand) return;
    setGoal(selectedGoal);
    setStep("thinking");
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "recommend-strategy",
        { body: { brand_id: activeBrand.id, user_goal: selectedGoal } },
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
      setStep("goal");
      toast.error(err?.message ?? "Could not get a recommendation");
    }
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-lumi-pink-1/10 to-lumi-purple-1/10 border border-lumi-pink-1/20 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-lumi-pink-1" />
            <span className="text-xs font-medium text-lumi-pink-1">
              LUMI Strategy Recommendation
            </span>
          </div>
          <h1 className="text-2xl font-heading font-bold">
            Tell LUMI what you want — we'll plan the rest
          </h1>
          {activeBrand && (
            <p className="text-sm text-muted-foreground">
              For <span className="font-medium text-foreground">{activeBrand.name}</span>
              {activeBrand.industry ? ` · ${activeBrand.industry}` : ""}
            </p>
          )}
        </div>

        {step === "goal" && (
          <motion.div
            key="goal"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <p className="text-sm font-medium text-foreground mb-3">
              What's your #1 goal right now?
            </p>
            {GOALS.map((g) => {
              const Icon = g.icon;
              return (
                <button
                  key={g.id}
                  onClick={() => runRecommendation(g.id)}
                  className="w-full text-left group"
                >
                  <Card className="p-4 hover:border-primary/50 hover:shadow-glow transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Icon className="h-5 w-5 text-foreground" />
                      </div>
                      <div className="flex-1 font-medium">{g.title}</div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </Card>
                </button>
              );
            })}
            {errorMsg && (
              <p className="text-sm text-destructive text-center pt-2">{errorMsg}</p>
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
              <Button variant="outline" onClick={() => setStep("goal")} className="flex-1">
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
              <Button variant="outline" onClick={() => setStep("goal")}>
                Try another goal
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
