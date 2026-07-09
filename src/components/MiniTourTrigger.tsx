import { useState } from "react";
import { Compass } from "lucide-react";
import { GuidedTour, type TourStep } from "@/components/GuidedTour";
import { cn } from "@/lib/utils";

interface MiniTourTriggerProps {
  steps: TourStep[];
  className?: string;
}

// Compact "Show me what to do" trigger for a single section — same
// gradient-shimmer treatment as the page-level trigger in CreativeStudio,
// sized to sit in the corner slot AutoSaveIndicator used to occupy alone.
// Renders nothing if there's no step to show, same as AutoSaveIndicator did
// for its idle state.
export function MiniTourTrigger({ steps, className }: MiniTourTriggerProps) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "relative overflow-hidden inline-flex items-center gap-1 text-[11px] font-medium text-white bg-gradient-lumi rounded-full px-2.5 py-1 shadow-lumi hover:shadow-glow transition-shadow shrink-0",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-shimmer",
          className,
        )}
      >
        <Compass className="h-3 w-3" />
        Show me what to do
      </button>
      {open && <GuidedTour steps={steps} onClose={() => setOpen(false)} />}
    </>
  );
}
