import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ArrowDown, ArrowUp, ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TourStep {
  /** CSS selector for the element this step points at. */
  targetSelector: string;
  title: string;
  description: string;
  /** Which side of the target the callout card sits on. Defaults to "bottom". */
  position?: "top" | "bottom" | "left" | "right";
}

interface GuidedTourProps {
  steps: TourStep[];
  onClose: () => void;
}

// Walks through `steps` one at a time: dims the rest of the screen, draws a
// highlight ring around the real target element (wherever it actually is —
// no corner-icon placement guesswork), and shows a callout with Next/Back.
// If a step's target can't be found (e.g. a button that only renders once
// some precondition is met), that step is skipped automatically rather than
// leaving the tour stuck.
export function GuidedTour({ steps, onClose }: GuidedTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const retryRef = useRef<NodeJS.Timeout>();

  const step = steps[stepIndex];
  const isLastStep = stepIndex >= steps.length - 1;

  useEffect(() => {
    if (!step) return;
    setIsVisible(false);
    setTargetRect(null);

    let cleanupClass: (() => void) | undefined;

    const findAndHighlight = (isRetry: boolean) => {
      const element = document.querySelector(step.targetSelector);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("animate-pulse");
        cleanupClass = () => element.classList.remove("animate-pulse");

        timeoutRef.current = setTimeout(() => setIsVisible(true), 800);
        return true;
      }
      if (isRetry) {
        // Target genuinely isn't on the page for this step — skip it
        // instead of leaving the tour stuck with nothing to point at.
        console.warn(`[GuidedTour] target not found, skipping step: ${step.targetSelector}`);
        if (isLastStep) {
          onClose();
        } else {
          setStepIndex((i) => i + 1);
        }
      }
      return false;
    };

    findAndHighlight(false);
    retryRef.current = setTimeout(() => findAndHighlight(true), 600);

    return () => {
      clearTimeout(retryRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      cleanupClass?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, step?.targetSelector]);

  const advance = (dir: 1 | -1) => {
    setIsVisible(false);
    setTimeout(() => setStepIndex((i) => i + dir), 200);
  };

  const handleNext = () => {
    if (isLastStep) {
      handleClose();
    } else {
      advance(1);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  if (!step || !targetRect || !isVisible) return null;

  const getTooltipPosition = () => {
    const padding = 20;
    switch (step.position || "bottom") {
      case "top":
        return { left: targetRect.left + targetRect.width / 2, top: targetRect.top - padding, transform: "translate(-50%, -100%)" };
      case "bottom":
        return { left: targetRect.left + targetRect.width / 2, top: targetRect.bottom + padding, transform: "translate(-50%, 0)" };
      case "left":
        return { left: targetRect.left - padding, top: targetRect.top + targetRect.height / 2, transform: "translate(-100%, -50%)" };
      case "right":
        return { left: targetRect.right + padding, top: targetRect.top + targetRect.height / 2, transform: "translate(0, -50%)" };
    }
  };

  const getArrowIcon = () => {
    switch (step.position || "bottom") {
      case "top": return ArrowDown;
      case "bottom": return ArrowUp;
      case "left": return ArrowRight;
      case "right": return ArrowLeft;
    }
  };

  const ArrowIcon = getArrowIcon();
  const tooltipPosition = getTooltipPosition();

  return createPortal(
    <>
      {/* Overlay with spotlight effect */}
      <div
        className="fixed inset-0 z-[100] animate-fade-in"
        style={{
          background: `radial-gradient(
            circle at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px,
            transparent ${Math.max(targetRect.width, targetRect.height)}px,
            rgba(0, 0, 0, 0.7) ${Math.max(targetRect.width, targetRect.height) + 100}px
          )`,
        }}
        onClick={handleClose}
      />

      {/* Highlight border around target */}
      <div
        className="fixed z-[101] pointer-events-none animate-scale-in"
        style={{
          left: targetRect.left - 8,
          top: targetRect.top - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16,
          border: "3px solid hsl(var(--primary))",
          borderRadius: "12px",
          boxShadow: "0 0 0 4px hsl(var(--primary) / 0.2), 0 0 40px hsl(var(--primary) / 0.5)",
          transition: "all 0.3s ease-out",
        }}
      />

      {/* Tooltip Card */}
      <Card
        className="fixed z-[102] max-w-sm shadow-2xl border-2 animate-scale-in"
        style={{ left: tooltipPosition!.left, top: tooltipPosition!.top, transform: tooltipPosition!.transform }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <ArrowIcon className="h-5 w-5 animate-bounce" />
              <span className="text-sm font-semibold">Action needed here</span>
            </div>
            {steps.length > 1 && (
              <span className="text-xs text-muted-foreground font-medium">
                {stepIndex + 1} of {steps.length}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-lg">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <Button onClick={() => advance(-1)} variant="ghost" size="sm">
                  Back
                </Button>
              )}
              <Button onClick={handleNext} variant={isLastStep ? "outline" : "default"} size="sm" className="gap-1">
                {isLastStep ? (
                  <><X className="h-4 w-4" /> Got it</>
                ) : (
                  <>Next <ChevronRight className="h-4 w-4" /></>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Pulsing indicator dots */}
        <div
          className="absolute w-3 h-3 bg-primary rounded-full animate-ping"
          style={{
            [(step.position || "bottom") === "top" ? "bottom" : (step.position || "bottom") === "bottom" ? "top" : (step.position || "bottom") === "left" ? "right" : "left"]: "-6px",
            [(step.position || "bottom") === "left" || (step.position || "bottom") === "right" ? "top" : "left"]: "50%",
            transform: (step.position || "bottom") === "left" || (step.position || "bottom") === "right" ? "translateY(-50%)" : "translateX(-50%)",
          }}
        />
      </Card>
    </>,
    document.body,
  );
}
