import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ScreenHelpProps {
  /** Short label for what this screen is */
  title: string;
  /** Plain-English "what do I do here?" explanation */
  description: string;
  /**
   * CSS selector (scoped to document, so keep it specific — e.g.
   * '[data-help-target="angles-generate"]') for the button(s) this screen
   * wants the user to take next. Spotlighted (scaled + glowing) for as
   * long as the tooltip is open.
   */
  targetSelector?: string;
  /** Corner to anchor in — defaults to top-right */
  position?: "top-right" | "top-left";
  className?: string;
}

// Corner "?" affordance for a screen — explains what the screen is for and
// spotlights the button(s) the user actually needs to click next, instead
// of just describing them. Positioned absolute; the nearest ancestor with
// `position: relative` (e.g. a Card) is the anchor.
export function ScreenHelp({
  title,
  description,
  targetSelector,
  position = "top-right",
  className,
}: ScreenHelpProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!targetSelector) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>(targetSelector));
    els.forEach((el) => el.classList.toggle("screen-help-spotlight", open));
    return () => {
      els.forEach((el) => el.classList.remove("screen-help-spotlight"));
    };
  }, [open, targetSelector]);

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen} delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            className={cn(
              "absolute z-20 flex h-6 w-6 items-center justify-center rounded-full",
              "border border-border bg-background/90 text-muted-foreground backdrop-blur-sm",
              "hover:text-primary hover:border-primary transition-colors",
              position === "top-right" ? "top-3 right-3" : "top-3 left-3",
              className,
            )}
            aria-label="What do I do here?"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={position === "top-right" ? "left" : "right"}
          className="max-w-[260px] p-3 space-y-1"
        >
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
