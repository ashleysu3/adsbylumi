import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  Target,
  User as UserIcon,
  Users,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useBrand } from "@/contexts/BrandContext";
import { useCampaignDraft } from "@/contexts/CampaignDraftContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ChatMsg = { role: "user" | "assistant"; content: string };

type ProposedStrategy = {
  campaignType: string;
  kpiLabel: string;
  audience: string;
  startingBudget: string;
  why: string;
};

const STARTERS = [
  "Get people to DM me",
  "Grow my Instagram",
  "More website traffic",
];

export function StrategyChatPanel() {
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const { setStrategy } = useCampaignDraft();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposed, setProposed] = useState<{
    goalId: string;
    strategy: ProposedStrategy;
  } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, proposed, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading || !activeBrand) return;
    const next: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setProposed(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("strategy-chat", {
        body: { brand_id: activeBrand.id, messages: next },
      });
      if (error) throw error;
      const reply: string = data?.reply ?? "…";
      setMessages([...next, { role: "assistant", content: reply }]);
      if (data?.phase === "proposed" && data?.goalId && data?.strategy) {
        setProposed({ goalId: data.goalId, strategy: data.strategy });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "LUMI couldn't respond");
      setMessages(next);
    } finally {
      setLoading(false);
    }
  };

  const handleUseProposed = () => {
    if (!proposed) return;
    setStrategy({
      name: proposed.strategy.campaignType,
      goal: proposed.goalId,
      objective: proposed.strategy.campaignType,
      audience: proposed.strategy.audience,
      description: proposed.strategy.why,
      why_it_works: proposed.strategy.why,
      kpi_label: proposed.strategy.kpiLabel,
      starting_budget: proposed.strategy.startingBudget,
      source: "strategy-chat",
    });
    navigate("/creative");
  };

  if (!open) {
    return (
      <Card
        className="p-5 border-lumi-pink-1/30 bg-gradient-to-br from-lumi-pink-1/5 to-lumi-purple-1/5 cursor-pointer hover:shadow-glow transition"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-start gap-3">
          <MessageCircle className="h-5 w-5 text-lumi-pink-1 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">
              Have something specific in mind? Talk it through with LUMI
            </h3>
            <p className="text-sm text-muted-foreground">
              Describe the kind of ad you want — even something you saw someone
              else run. LUMI figures out the goal and builds the strategy.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-lumi-pink-1" />
          <span className="text-sm font-medium">Chat with LUMI</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[500px] min-h-[280px]">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-6">
            Tell LUMI what you want to happen — or pick a starter below.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback
                className={
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }
              >
                {m.role === "user" ? (
                  <UserIcon className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </AvatarFallback>
            </Avatar>
            <div
              className={`flex-1 ${m.role === "user" ? "flex justify-end" : ""}`}
            >
              <div
                className={`rounded-lg px-4 py-3 max-w-[85%] break-words ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">
                  {m.content}
                </p>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-muted">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="bg-muted rounded-lg px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        {proposed && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-5 border-lumi-pink-1/30 bg-gradient-to-br from-lumi-pink-1/5 to-lumi-purple-1/5">
              <Badge className="mb-3 bg-gradient-to-r from-lumi-pink-1 to-lumi-orange-1 text-white border-0">
                LUMI's proposed plan
              </Badge>
              <h3 className="text-lg font-heading font-bold mb-4">
                {proposed.strategy.campaignType}
              </h3>

              <div className="grid sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-background/60 border border-border/60 p-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    <Target className="h-3.5 w-3.5" /> Measured by
                  </div>
                  <p className="text-sm font-medium">
                    {proposed.strategy.kpiLabel}
                  </p>
                </div>
                <div className="rounded-lg bg-background/60 border border-border/60 p-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    <Users className="h-3.5 w-3.5" /> Audience
                  </div>
                  <p className="text-sm font-medium">
                    {proposed.strategy.audience}
                  </p>
                </div>
                <div className="rounded-lg bg-background/60 border border-border/60 p-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    <Wallet className="h-3.5 w-3.5" /> Starting budget
                  </div>
                  <p className="text-sm font-medium">
                    {proposed.strategy.startingBudget}
                  </p>
                </div>
              </div>

              <div className="text-sm mb-4">
                <p className="font-medium mb-1">Why this</p>
                <p className="text-muted-foreground">{proposed.strategy.why}</p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => setProposed(null)}
                  className="flex-1"
                >
                  Keep chatting
                </Button>
                <Button onClick={handleUseProposed} className="flex-1">
                  Use this plan — build creative
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        <div ref={endRef} />
      </div>

      {messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              onClick={() => setInput(s)}
              className="text-xs"
            >
              {s}
            </Button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t p-3 flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe what you want to happen…"
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !input.trim()} size="icon">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </Card>
  );
}
