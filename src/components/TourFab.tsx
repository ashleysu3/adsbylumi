import { useState } from "react";
import { createPortal } from "react-dom";
import { Compass } from "lucide-react";
import { GuidedTour, type TourStep } from "@/components/GuidedTour";
import { cn } from "@/lib/utils";

interface TourFabProps {
  steps: TourStep[];
  /** Override the default `bottom-4 right-4` position — e.g. to clear a sticky footer. */
  className?: string;
}

// Floating "Show me what to do" pill, fixed to the bottom-right corner of the
// viewport — the exact spot the old idle "Auto-save on" badge used to sit.
// Portals to document.body so it stays viewport-fixed even when rendered
// from inside a transformed/centered Dialog.
export function TourFab({ steps, className }: TourFabProps) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;

  return createPortal(
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-4 right-4 z-[60] flex items-center gap-1.5 rounded-full bg-gradient-lumi px-4 py-2.5 text-sm font-medium text-white shadow-lumi hover:shadow-glow transition-shadow relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-shimmer",
          className,
        )}
      >
        <Compass className="h-4 w-4" />
        Show me what to do
      </button>
      {open && <GuidedTour steps={steps} onClose={() => setOpen(false)} />}
    </>,
    document.body,
  );
}
