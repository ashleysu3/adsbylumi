import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Wand2, Loader2 } from "lucide-react";

export interface FitReview {
  fit_score: "A" | "B" | "C" | "D" | "F";
  attracts: string;
  leaking_phrases: { quote: string; magnet?: string; why: string }[];
  creative_mismatch?: string | null;
  ideal_buyer_summary: string;
  ideal_buyer_thin: boolean;
  rewritten: {
    headline: string;
    primary: string;
    description: string;
    repels_note?: string;
  };
  creative_changes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  workspaceId: string;
  brandId: string;
  review: FitReview;
  onResolved?: () => void;
}

const SCORE_CLASS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 border-emerald-300",
  B: "bg-lime-100 text-lime-800 border-lime-300",
  C: "bg-amber-100 text-amber-800 border-amber-300",
  D: "bg-orange-100 text-orange-800 border-orange-300",
  F: "bg-red-100 text-red-800 border-red-300",
};

export function AdFitReviewDialog({
  open,
  onOpenChange,
  taskId,
  workspaceId,
  brandId,
  review,
  onResolved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const markDone = async () => {
    await supabase
      .from("tasks")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", taskId);
    onResolved?.();
  };

  const handleUseCopy = async () => {
    setSaving(true);
    try {
      const text = `Headline: ${review.rewritten.headline}\n\n${review.rewritten.primary}\n\nDescription: ${review.rewritten.description}${review.rewritten.repels_note ? `\n\n(Repel line: ${review.rewritten.repels_note})` : ""}`;
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Re-aimed copy copied to clipboard.");
      } catch {
        toast.success("Re-aimed copy saved.");
      }
      await markDone();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCreative = async () => {
    await markDone();
    onOpenChange(false);
    navigate(`/creative-studio?workspaceId=${workspaceId}&fitReviewTaskId=${taskId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" /> Re-aim your copy
          </DialogTitle>
          <DialogDescription>
            You flagged wrong-fit leads — here's what your current copy is casting for and a
            re-aimed version that gently filters for your ideal buyer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={`text-base px-3 py-1 ${SCORE_CLASS[review.fit_score] || ""}`}
            >
              Fit Score: {review.fit_score}
            </Badge>
            <p className="text-muted-foreground text-xs flex-1">
              <span className="font-medium text-foreground">Currently attracts:</span>{" "}
              {review.attracts}
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Who you want
            </p>
            <p>{review.ideal_buyer_summary}</p>
            {review.ideal_buyer_thin && (
              <p className="text-xs text-amber-700">
                We worked from a thin ideal-buyer profile — confirm in My Brand to sharpen future
                drafts.
              </p>
            )}
          </div>

          {review.leaking_phrases?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Leaking phrases in your copy
              </p>
              <ul className="space-y-2">
                {review.leaking_phrases.map((p, i) => (
                  <li key={i} className="rounded-lg border-l-4 border-amber-400 bg-amber-50/50 p-2">
                    <p className="font-medium">"{p.quote}"</p>
                    <p className="text-xs text-muted-foreground">
                      {p.magnet ? `${p.magnet} — ` : ""}
                      {p.why}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {review.creative_mismatch && (
            <div className="rounded-lg border-l-4 border-purple-400 bg-purple-50/50 p-3 text-xs">
              <span className="font-semibold">Creative note:</span> {review.creative_mismatch}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Re-aimed copy
            </p>
            <div className="rounded-lg border p-3 space-y-2 bg-background">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Headline</p>
                <p className="font-medium">{review.rewritten.headline}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Primary</p>
                <p className="whitespace-pre-wrap">{review.rewritten.primary}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Description</p>
                <p>{review.rewritten.description}</p>
              </div>
              {review.rewritten.repels_note && (
                <div className="pt-1 text-xs text-muted-foreground italic">
                  Repel line: {review.rewritten.repels_note}
                </div>
              )}
            </div>
          </div>

          {review.creative_changes && (
            <div className="rounded-lg border bg-muted/40 p-3 text-xs">
              <span className="font-semibold">If you re-shoot or swap creative: </span>
              {review.creative_changes}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleOpenCreative} disabled={saving}>
            Open creative flow
          </Button>
          <Button onClick={handleUseCopy} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            Use this copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
