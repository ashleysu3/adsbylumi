// Confirm step before any "execute" rec on the Insights surfaces. Real
// money moves the moment we hit Meta — pause, resume, swap, promote — so
// every one of those should pass through a confirm with the exact change
// shown. Mirrors the gating Performance.tsx's TaskExecuteDialog provides
// for the task tray.
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Pause, Play, RefreshCw, Rocket } from "lucide-react";
import type { Recommendation } from "@/hooks/useRecommendationActions";

interface Props {
  rec: Recommendation | null;
  open: boolean;
  submitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

function iconFor(type?: string) {
  switch (type) {
    case "pause_ad":
      return <Pause className="h-4 w-4" />;
    case "resume_ad":
      return <Play className="h-4 w-4" />;
    case "swap_creative":
      return <RefreshCw className="h-4 w-4" />;
    case "promote_to_scaling":
      return <Rocket className="h-4 w-4" />;
    default:
      return null;
  }
}

function confirmLabel(type?: string) {
  switch (type) {
    case "pause_ad":
      return "Pause it in Meta";
    case "resume_ad":
      return "Resume it in Meta";
    case "swap_creative":
      return "Swap in Meta";
    case "promote_to_scaling":
      return "Promote in Meta";
    default:
      return "Apply in Meta";
  }
}

function bodyFor(rec: Recommendation) {
  switch (rec.type) {
    case "pause_ad":
      return "This will stop spending on this ad in Meta immediately. You can resume it any time from the campaign view.";
    case "resume_ad":
      return "This will set this ad back to ACTIVE in Meta. Spend will resume on its current ad set budget.";
    case "swap_creative":
      return "This pauses the fatigued ad and activates the selected bench creative in Meta. If the pause fails, the bench ad will NOT be activated.";
    case "promote_to_scaling":
      return "This duplicates the ad into the Scaling ad set and pauses the original in Testing. Real spend will start on the duplicated ad immediately.";
    default:
      return rec.description || "This change will be applied directly in Meta.";
  }
}

export function ConfirmRecExecuteDialog({
  rec,
  open,
  submitting,
  onOpenChange,
  onConfirm,
}: Props) {
  if (!rec) return null;
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => !submitting && onOpenChange(o)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {iconFor(rec.type)} {rec.title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 pt-2">
              <p className="text-sm">{bodyFor(rec)}</p>
              {rec.impact ? (
                <p className="text-xs text-muted-foreground">
                  Expected impact: {rec.impact}
                </p>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={!!submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={!!submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Working…
              </>
            ) : (
              confirmLabel(rec.type)
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
