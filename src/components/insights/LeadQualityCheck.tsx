import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Rating = "right" | "mixed" | "wrong";

const REASON_OPTIONS: { id: string; label: string }[] = [
  { id: "cant_afford", label: "Can't afford" },
  { id: "too_beginner", label: "Too beginner" },
  { id: "just_browsing", label: "Just browsing" },
  { id: "wrong_niche", label: "Wrong niche" },
  { id: "only_want_free", label: "Only want free" },
];

const SHOW_INTERVAL_DAYS = 10;

interface Props {
  workspaceId: string;
  brandId: string;
  campaignMetaId?: string | null;
  variant?: "compact" | "full";
  onSubmitted?: () => void;
}

export function LeadQualityCheck({
  workspaceId,
  brandId,
  campaignMetaId,
  variant = "compact",
  onSubmitted,
}: Props) {
  const [lastAt, setLastAt] = useState<string | null | undefined>(undefined);
  const [rating, setRating] = useState<Rating | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("lead_quality_feedback")
          .select("created_at, fit_rating")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled) setLastAt(data?.created_at ?? null);
      } catch {
        if (!cancelled) setLastAt(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const isDue =
    lastAt === null ||
    (typeof lastAt === "string" &&
      Date.now() - new Date(lastAt).getTime() > SHOW_INTERVAL_DAYS * 86_400_000);

  // Show prompt automatically if due or full variant; otherwise keep it tucked behind a link.
  const showPrompt = open || isDue || variant === "full";

  const toggleReason = (id: string) =>
    setReasons((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const submit = async (chosen: Rating) => {
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) throw new Error("Not signed in");
      const payload = {
        workspace_id: workspaceId,
        brand_id: brandId,
        campaign_id: campaignMetaId || null,
        user_id: u.user.id,
        fit_rating: chosen,
        reasons: chosen === "right" ? [] : reasons,
        note: chosen === "right" ? null : note.trim() || null,
      };
      const { data: row, error } = await supabase
        .from("lead_quality_feedback")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      setLastAt(row.created_at);
      setRating(null);
      setReasons([]);
      setNote("");
      setOpen(false);

      if (chosen === "right") {
        toast.success("Got it — locking in what's working.");
      } else {
        toast.success(
          "Saved in My Creatives — review and add to your campaign when ready. Nothing changes in your live ad until you do.",
        );
        // Fire-and-forget review — re-aimed copy lands in My Creatives as drafts.
        supabase.functions
          .invoke("ad-fit-review", {
            body: { workspace_id: workspaceId, brand_id: brandId, feedback_id: row.id },
          })
          .then(({ error }) => {
            if (error) console.error("ad-fit-review failed", error);
            onSubmitted?.();
          });
      }
      onSubmitted?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Could not save feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRating = (r: Rating) => {
    if (r === "right") {
      submit("right");
      return;
    }
    setRating(r);
  };

  if (lastAt === undefined) return null;

  if (!showPrompt) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ChevronDown className="h-3 w-3" /> Update lead quality
      </button>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-muted/30 p-3 space-y-2",
        variant === "compact" ? "text-xs" : "text-sm",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-foreground">How are the leads?</p>
        {isDue ? null : (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ChevronUp className="h-3 w-3" /> Hide
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <RatingBtn
          active={rating === "right"}
          onClick={() => handleRating("right")}
          disabled={submitting}
        >
          🎯 Right people
        </RatingBtn>
        <RatingBtn
          active={rating === "mixed"}
          onClick={() => handleRating("mixed")}
          disabled={submitting}
        >
          🤷 Mixed
        </RatingBtn>
        <RatingBtn
          active={rating === "wrong"}
          onClick={() => handleRating("wrong")}
          disabled={submitting}
        >
          👎 Wrong people
        </RatingBtn>
      </div>

      {(rating === "mixed" || rating === "wrong") && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-muted-foreground">What's off?</p>
          <div className="flex flex-wrap gap-1.5">
            {REASON_OPTIONS.map((opt) => {
              const on = reasons.includes(opt.id);
              return (
                <Badge
                  key={opt.id}
                  variant={on ? "default" : "outline"}
                  onClick={() => toggleReason(opt.id)}
                  className="cursor-pointer select-none text-[11px]"
                >
                  {opt.label}
                </Badge>
              );
            })}
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="One line of color (optional)…"
            className="text-xs h-16"
            maxLength={240}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRating(null);
                setReasons([]);
                setNote("");
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => submit(rating)}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send to LUMI"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RatingBtn({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background hover:bg-muted border-border",
        disabled && "opacity-60",
      )}
    >
      {children}
    </button>
  );
}
