import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Send, Loader2, ArrowRight, CheckSquare, Bug } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/contexts/BrandContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type IntentAction = {
  label: string;
  type: "route" | "task" | "open";
  target: any;
  routeParams?: Record<string, any>;
};

export type IntentResponse = {
  mode: "route" | "converse";
  route?: string;
  routeParams?: Record<string, any>;
  reply?: string;
  actions?: IntentAction[];
};

type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; actions?: IntentAction[] };

interface IntentConversationProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Seed message + first router reply (already fetched). */
  initial?: { userText: string; response: IntentResponse } | null;
}

function routeWithParams(route: string, params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) return route;
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    qs.set(k, typeof v === "string" ? v : JSON.stringify(v));
  });
  const sep = route.includes("?") ? "&" : "?";
  return `${route}${sep}${qs.toString()}`;
}

/**
 * Shared intent router invocation. Exported so the IntentBar can route
 * directly without opening the sheet when the answer is mode="route".
 */
export async function callIntentRouter(
  messages: { role: "user" | "assistant"; content: string }[],
  brandId?: string,
): Promise<IntentResponse> {
  const { data, error } = await supabase.functions.invoke("intent-router", {
    body: { messages, brandId },
  });
  if (error) throw error;
  return data as IntentResponse;
}

export function IntentConversation({ open, onOpenChange, initial }: IntentConversationProps) {
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed when opened with an initial response
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTurns([
        { role: "user", content: initial.userText },
        {
          role: "assistant",
          content:
            initial.response.reply ||
            (initial.response.mode === "route"
              ? `Taking you to ${initial.response.route}…`
              : "Pick one to get going."),
          actions:
            initial.response.actions && initial.response.actions.length > 0
              ? initial.response.actions
              : initial.response.mode === "route" && initial.response.route
              ? [
                  {
                    label: "Go there",
                    type: "route",
                    target: initial.response.route,
                    routeParams: initial.response.routeParams,
                  },
                ]
              : undefined,
        },
      ]);
    } else {
      setTurns([]);
    }
  }, [open, initial]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending]);

  async function handleAction(a: IntentAction) {
    if (a.type === "route") {
      const route = typeof a.target === "string" ? a.target : "/studio";
      onOpenChange(false);
      navigate(routeWithParams(route, a.routeParams));
      return;
    }
    if (a.type === "task") {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user) throw new Error("Not signed in");
        const t = typeof a.target === "object" ? a.target : { title: a.label };
        const { error } = await supabase.from("tasks").insert({
          user_id: u.user.id,
          brand_id: activeBrand?.id ?? null,
          title: t.title || a.label,
          link_to: t.link_to ?? null,
          source: "lumi_intent",
          status: "open",
        });
        if (error) throw error;
        toast.success("Added to your tasks");
      } catch (e: any) {
        toast.error(e?.message || "Couldn't create task");
      }
      return;
    }
    if (a.type === "open") {
      const key = String(a.target);
      if (key === "bug_report") {
        window.dispatchEvent(new Event("open-bug-report"));
        onOpenChange(false);
        return;
      }
      if (key === "quick_list") {
        onOpenChange(false);
        navigate("/studio");
        return;
      }
      if (key === "create_from_board") {
        onOpenChange(false);
        navigate("/creative-studio");
        return;
      }
      onOpenChange(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const nextTurns: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(nextTurns);
    setSending(true);
    try {
      const messages = nextTurns.map((t) => ({
        role: t.role,
        content: t.content,
      }));
      const res = await callIntentRouter(messages, activeBrand?.id);
      // mode="route" mid-conversation: surface as an assistant turn with a Go button,
      // so the user stays in control inside the chat instead of being yanked away.
      const assistant: Turn = {
        role: "assistant",
        content:
          res.reply ||
          (res.mode === "route" && res.route
            ? `Ready when you are — open ${res.route}?`
            : "Here's what I can do."),
        actions:
          res.actions && res.actions.length > 0
            ? res.actions
            : res.mode === "route" && res.route
            ? [
                {
                  label: "Go there",
                  type: "route",
                  target: res.route,
                  routeParams: res.routeParams,
                },
              ]
            : [
                { label: "Launch a campaign", type: "route", target: "/create" },
                { label: "Check performance", type: "route", target: "/ad-performance" },
              ],
      };
      setTurns((p) => [...p, assistant]);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't reach LUMI");
      setTurns((p) => [
        ...p,
        {
          role: "assistant",
          content: "Something hiccupped on my end. Want to try one of these instead?",
          actions: [
            { label: "Launch a campaign", type: "route", target: "/create" },
            { label: "Check performance", type: "route", target: "/ad-performance" },
            { label: "Make creative", type: "route", target: "/creative-studio" },
          ],
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-lumi-pink-1" />
            LUMI
          </SheetTitle>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="rounded-2xl bg-lumi-pink-1/10 text-foreground px-3.5 py-2 text-sm max-w-[85%]">
                  {t.content}
                </div>
              </div>
            ) : (
              <div key={i} className="space-y-2">
                <div className="rounded-2xl bg-muted px-3.5 py-2 text-sm max-w-[90%]">
                  {t.content}
                </div>
                {t.actions && t.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pl-1">
                    {t.actions.map((a, j) => {
                      const Icon =
                        a.type === "task" ? CheckSquare : a.type === "open" && a.target === "bug_report" ? Bug : ArrowRight;
                      return (
                        <Button
                          key={j}
                          size="sm"
                          variant={j === 0 ? "default" : "outline"}
                          onClick={() => handleAction(a)}
                          className="gap-1.5"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {a.label}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            ),
          )}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> LUMI is thinking…
            </div>
          )}
        </div>

        <form
          className="border-t p-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a follow-up…"
            className="flex-1"
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
