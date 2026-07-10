import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Compass,
  Lightbulb,
  Loader2,
  MessageCircle,
  Pencil,
  Send,
  User as UserIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type FunnelMap = { goal: string; grow: string; nurture: string; convert: string };
export type FunnelGap = { stage: "grow" | "nurture" | "convert"; suggestion: string; why: string };

type ChatMsg = { role: "user" | "assistant"; content: string };
type Slot = "goal" | "grow" | "nurture" | "convert";

const STAGE_LABEL: Record<Slot, string> = {
  goal: "Goal",
  grow: "Grow",
  nurture: "Nurture",
  convert: "Convert",
};

const CHIPS: Record<Slot, string[]> = {
  goal: ["More leads", "More sales calls", "More direct sales"],
  grow: ["Lead magnet", "Webinar", "Challenge", "Organic content only", "Referrals only", "Nothing yet"],
  nurture: ["Email sequence", "Retargeting ads", "I follow up personally", "Nothing yet"],
  convert: ["Discovery call", "Application", "Buy straight off a page", "DM to close", "Nothing yet"],
};

function opener(offerName: string, targetOutcome: string | null): string {
  if (targetOutcome) {
    return `Looks like the goal for ${offerName} is roughly "${targetOutcome}" — still right, or has that shifted? Tell me in your own words, or pick below.`;
  }
  return `Let's map out how ${offerName} actually sells today, so ads can slot into the right place. What would "more" look like here — more leads, more sales calls booked, or more direct sales?`;
}

interface FunnelMapChatProps {
  offerId: string;
  offerName: string;
  targetOutcome: string | null;
  funnelMap: FunnelMap | null;
  gaps: FunnelGap[] | null;
  onSaved: (offerId: string, funnelMap: FunnelMap, gaps: FunnelGap[]) => void;
}

export function FunnelMapChat({
  offerId,
  offerName,
  targetOutcome,
  funnelMap,
  gaps,
  onSaved,
}: FunnelMapChatProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [slot, setSlot] = useState<Slot>("goal");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposed, setProposed] = useState<{ funnelMap: FunnelMap; gaps: FunnelGap[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, proposed, loading]);

  const startChat = () => {
    setMessages([{ role: "assistant", content: opener(offerName, targetOutcome) }]);
    setSlot("goal");
    setProposed(null);
    setChatOpen(true);
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setProposed(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("funnel-strategy-chat", {
        body: { offer_id: offerId, messages: next },
      });
      if (error) throw error;
      const reply: string = data?.reply ?? "…";
      setMessages([...next, { role: "assistant", content: reply }]);
      if (data?.slot) setSlot(data.slot as Slot);
      if (data?.phase === "proposed" && data?.funnelMap) {
        setProposed({ funnelMap: data.funnelMap, gaps: data.gaps ?? [] });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "LUMI couldn't respond");
      setMessages(next);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!proposed) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("offers")
        .update({
          funnel_map: proposed.funnelMap,
          funnel_gaps: proposed.gaps,
          funnel_map_updated_at: new Date().toISOString(),
        })
        .eq("id", offerId);
      if (error) throw error;
      onSaved(offerId, proposed.funnelMap, proposed.gaps);
      setChatOpen(false);
      toast.success("Funnel map saved");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Couldn't save the funnel map");
    } finally {
      setSaving(false);
    }
  };

  // Summary view — funnel map already saved, chat collapsed
  if (funnelMap && !chatOpen) {
    return (
      <Card className="p-4 border-border/60">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Compass className="h-4 w-4 text-lumi-purple-1" />
            How {offerName} actually sells
          </div>
          <Button size="sm" variant="ghost" onClick={startChat} className="gap-1.5 h-7 text-xs">
            <Pencil className="h-3.5 w-3.5" /> Update
          </Button>
        </div>
        <div className="grid sm:grid-cols-4 gap-2 mt-3">
          {(["goal", "grow", "nurture", "convert"] as Slot[]).map((s) => (
            <div key={s} className="rounded-lg bg-muted/30 border border-border/50 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {STAGE_LABEL[s]}
              </div>
              <p className="text-xs font-medium leading-snug">{funnelMap[s]}</p>
            </div>
          ))}
        </div>
        {gaps && gaps.length > 0 && (
          <div className="mt-3 space-y-2">
            {gaps.map((g, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <span>
                  <b className="text-foreground">{STAGE_LABEL[g.stage]}:</b> {g.suggestion} — {g.why}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  // Closed prompt — no funnel map yet
  if (!chatOpen) {
    return (
      <Card
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startChat(); } }}
        className="group p-4 border-2 border-dashed border-lumi-purple-1/40 bg-background cursor-pointer hover:border-lumi-purple-1 hover:bg-lumi-purple-1/5 transition"
        onClick={startChat}
      >
        <div className="flex items-start gap-3">
          <MessageCircle className="h-4 w-4 text-lumi-purple-1 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold mb-0.5">
              Map how {offerName} actually sells
            </h4>
            <p className="text-xs text-muted-foreground">
              A few quick questions about what you already have — LUMI figures out where ads can help.
            </p>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-lumi-purple-1 flex-shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    );
  }

  // Open chat
  return (
    <Card className="flex flex-col overflow-hidden border-lumi-purple-1/30">
      <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-lumi-purple-1" />
          <span className="text-sm font-medium">Mapping {offerName}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setChatOpen(false)}>
          Close
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[440px] min-h-[220px]">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
            <Avatar className="h-7 w-7">
              <AvatarFallback className={m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}>
                {m.role === "user" ? <UserIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </AvatarFallback>
            </Avatar>
            <div className={cn("flex-1", m.role === "user" && "flex justify-end")}>
              <div
                className={cn(
                  "rounded-lg px-3.5 py-2.5 max-w-[85%] break-words text-sm whitespace-pre-wrap",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {m.content}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-muted">
                <Bot className="h-3.5 w-3.5" />
              </AvatarFallback>
            </Avatar>
            <div className="bg-muted rounded-lg px-3.5 py-2.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        {proposed && !loading && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-4 border-lumi-purple-1/30 bg-gradient-to-br from-lumi-purple-1/5 to-lumi-pink-1/5">
              <Badge className="mb-3 bg-gradient-to-r from-lumi-pink-1 to-lumi-purple-1 text-white border-0">
                LUMI's read on your funnel
              </Badge>
              <div className="grid sm:grid-cols-4 gap-2 mb-3">
                {(["goal", "grow", "nurture", "convert"] as Slot[]).map((s) => (
                  <div key={s} className="rounded-lg bg-background/60 border border-border/60 p-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      {STAGE_LABEL[s]}
                    </div>
                    <p className="text-xs font-medium leading-snug">{proposed.funnelMap[s]}</p>
                  </div>
                ))}
              </div>
              {proposed.gaps.length > 0 && (
                <div className="space-y-2 mb-4">
                  {proposed.gaps.map((g, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>
                        <b>{STAGE_LABEL[g.stage]}:</b> {g.suggestion}{" "}
                        <span className="text-muted-foreground">— {g.why}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setProposed(null)} className="flex-1">
                  Keep chatting
                </Button>
                <Button size="sm" onClick={save} disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Save funnel map
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        <div ref={endRef} />
      </div>

      {!proposed && !loading && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {CHIPS[slot].map((c) => (
            <Button key={c} variant="outline" size="sm" onClick={() => send(c)} className="text-xs h-7">
              {c}
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
          placeholder="Type your own answer…"
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !input.trim()} size="icon">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </Card>
  );
}
