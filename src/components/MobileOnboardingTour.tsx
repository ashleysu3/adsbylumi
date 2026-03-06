import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, Sparkles, Home, Palette, BarChart3, CheckCircle2, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  targetSelector?: string;
  position?: "top" | "bottom" | "center";
}

const defaultTourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to LUMI!",
    description: "Let's take a quick tour so you know where everything lives. It'll only take a moment.",
    icon: <Sparkles className="h-6 w-6" />,
    position: "center",
  },
  {
    id: "start",
    title: "Start Here",
    description: "This is your home base. You'll see your progress, next steps, and quick actions here.",
    icon: <Home className="h-6 w-6" />,
    targetSelector: "[data-tour='start']",
    position: "top",
  },
  {
    id: "campaigns",
    title: "My Campaigns",
    description: "All your ad campaigns live here. Track progress and manage everything in one place.",
    icon: <FolderKanban className="h-6 w-6" />,
    targetSelector: "[data-tour='campaigns']",
    position: "top",
  },
  {
    id: "creative",
    title: "Creative Studio",
    description: "This is where you build your ads — scripts, copy, hooks, and creative direction.",
    icon: <Palette className="h-6 w-6" />,
    targetSelector: "[data-tour='creative']",
    position: "top",
  },
  {
    id: "results",
    title: "Ad Performance",
    description: "Once your ads are running, check how they're doing with clear metrics and recommendations.",
    icon: <BarChart3 className="h-6 w-6" />,
    targetSelector: "[data-tour='results']",
    position: "top",
  },
  {
    id: "done",
    title: "You're all set!",
    description: "Start by adding your brand details and your first offer — LUMI will guide you from there.",
    icon: <CheckCircle2 className="h-6 w-6" />,
    position: "center",
  },
];

interface MobileOnboardingTourProps {
  steps?: TourStep[];
  onComplete: () => void;
  onSkip?: () => void;
}

export function MobileOnboardingTour({
  steps = defaultTourSteps,
  onComplete,
  onSkip,
}: MobileOnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Find and highlight target element
  useEffect(() => {
    const step = steps[currentStep];
    if (step.targetSelector) {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }
  }, [currentStep, steps]);

  const triggerHaptic = useCallback(() => {
    if ("vibrate" in navigator) navigator.vibrate(15);
  }, []);

  const goToNext = useCallback(() => {
    triggerHaptic();
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, steps.length, triggerHaptic]);

  const goToPrevious = useCallback(() => {
    triggerHaptic();
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  }, [currentStep, triggerHaptic]);

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(onComplete, 300);
  };

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(() => {
      onSkip?.();
      onComplete();
    }, 300);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (diff > 50) goToNext();
    else if (diff < -50) goToPrevious();
  };

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Card position: if we have a target, show card above or below it
  const getCardPosition = (): string => {
    if (targetRect) {
      // Target is in the bottom nav area — show card above
      if (targetRect.top > window.innerHeight / 2) {
        return "bottom-24 left-4 right-4";
      }
      return "top-20 left-4 right-4";
    }
    if (step.position === "top") return "bottom-24 left-4 right-4";
    return "top-1/2 left-4 right-4 -translate-y-1/2";
  };

  if (!isMobile) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[200] transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Backdrop with cutout for target */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Highlight ring around target element */}
      {targetRect && (
        <div
          className="absolute z-[201] rounded-xl border-2 border-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)] pointer-events-none animate-pulse transition-all duration-300"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}

      {/* Arrow pointing to target */}
      {targetRect && (
        <div
          className="absolute z-[202] pointer-events-none"
          style={{
            top: targetRect.top - 12,
            left: targetRect.left + targetRect.width / 2 - 8,
          }}
        >
          <div className="w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-primary/60" 
            style={{ transform: targetRect.top > window.innerHeight / 2 ? "rotate(180deg)" : "rotate(0deg)", transformOrigin: "center" }}
          />
        </div>
      )}

      {/* Tour Card */}
      <div
        className={cn(
          "absolute z-[203] transition-all duration-300 ease-out",
          getCardPosition(),
          isVisible ? "scale-100" : "scale-95"
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white">
                  {step.icon}
                </div>
                <div>
                  <p className="text-[11px] text-white/80 font-medium">
                    Step {currentStep + 1} of {steps.length}
                  </p>
                  <h3 className="text-base font-bold text-white leading-tight">{step.title}</h3>
                </div>
              </div>
              <button
                onClick={handleSkip}
                className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              {step.description}
            </p>

            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 my-3">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => { triggerHaptic(); setCurrentStep(idx); }}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    idx === currentStep
                      ? "w-5 bg-primary"
                      : idx < currentStep
                      ? "w-1.5 bg-primary/50"
                      : "w-1.5 bg-muted"
                  )}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex gap-2">
              {!isFirstStep && (
                <Button variant="outline" onClick={goToPrevious} className="flex-1 h-11 rounded-xl touch-target">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <Button
                onClick={goToNext}
                className={cn(
                  "flex-1 h-11 rounded-xl touch-target font-semibold",
                  isLastStep && "bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 hover:opacity-90"
                )}
              >
                {isLastStep ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Get Started
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Hook to manage tour state
export function useMobileOnboardingTour() {
  const [showTour, setShowTour] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(() => {
    return localStorage.getItem("mobile-tour-completed") === "true";
  });

  const startTour = useCallback(() => setShowTour(true), []);

  const completeTour = useCallback(() => {
    setShowTour(false);
    setHasSeenTour(true);
    localStorage.setItem("mobile-tour-completed", "true");
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem("mobile-tour-completed");
    setHasSeenTour(false);
  }, []);

  return { showTour, hasSeenTour, startTour, completeTour, resetTour };
}
