import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, Sparkles, Home, Target, Palette, BarChart3, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  targetSelector?: string;
  highlight?: "bottom-nav" | "fab" | "header" | "content";
}

const defaultTourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Your Ad Assistant!",
    description: "Let's take a quick tour to help you get started with creating amazing Meta ads.",
    icon: <Sparkles className="h-6 w-6" />,
    highlight: "content",
  },
  {
    id: "dashboard",
    title: "Your Dashboard",
    description: "This is your home base. See your campaigns, performance, and quick actions all in one place.",
    icon: <Home className="h-6 w-6" />,
    targetSelector: "[data-tour='dashboard']",
    highlight: "bottom-nav",
  },
  {
    id: "planning",
    title: "Plan Your Campaign",
    description: "Start here to set your goals, choose your offer, and let Lumi guide your strategy.",
    icon: <Target className="h-6 w-6" />,
    targetSelector: "[data-tour='planning']",
    highlight: "bottom-nav",
  },
  {
    id: "creative",
    title: "Create Your Ads",
    description: "Get AI-powered scripts, copy, and creative direction tailored to your audience.",
    icon: <Palette className="h-6 w-6" />,
    targetSelector: "[data-tour='creative']",
    highlight: "bottom-nav",
  },
  {
    id: "insights",
    title: "Track Results",
    description: "See how your ads are performing with clear metrics and Lumi's recommendations.",
    icon: <BarChart3 className="h-6 w-6" />,
    targetSelector: "[data-tour='insights']",
    highlight: "bottom-nav",
  },
  {
    id: "new-campaign",
    title: "Start a New Campaign",
    description: "Tap this button anytime to create a new ad campaign with step-by-step guidance.",
    icon: <Sparkles className="h-6 w-6" />,
    targetSelector: "[data-tour='new-campaign']",
    highlight: "fab",
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
  const isMobile = useIsMobile();

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Haptic feedback
  const triggerHaptic = useCallback(() => {
    if ("vibrate" in navigator) {
      navigator.vibrate(15);
    }
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
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
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

  // Swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    const minSwipe = 50;

    if (diff > minSwipe) {
      goToNext();
    } else if (diff < -minSwipe) {
      goToPrevious();
    }
  };

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Get highlight position
  const getHighlightStyle = () => {
    switch (step.highlight) {
      case "bottom-nav":
        return "bottom-20 left-4 right-4";
      case "fab":
        return "bottom-28 left-4 right-4";
      case "header":
        return "top-20 left-4 right-4";
      default:
        return "top-1/2 left-4 right-4 -translate-y-1/2";
    }
  };

  if (!isMobile) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[200] transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Spotlight overlay for specific highlights */}
      {step.highlight === "bottom-nav" && (
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-primary/20 to-transparent pointer-events-none animate-pulse" />
      )}
      {step.highlight === "fab" && (
        <div className="absolute bottom-16 right-4 w-16 h-16 rounded-full border-4 border-primary shadow-[0_0_30px_hsl(var(--primary)/0.5)] pointer-events-none animate-pulse" />
      )}

      {/* Tour Card */}
      <div
        className={cn(
          "absolute transition-all duration-300 ease-out",
          getHighlightStyle(),
          isVisible ? "scale-100" : "scale-95"
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="bg-card rounded-2xl shadow-2xl border-2 border-primary/20 overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
                  {step.icon}
                </div>
                <div>
                  <p className="text-xs text-white/80 font-medium">
                    Step {currentStep + 1} of {steps.length}
                  </p>
                  <h3 className="text-lg font-bold text-white">{step.title}</h3>
                </div>
              </div>
              <button
                onClick={handleSkip}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-5">
            <p className="text-muted-foreground text-sm leading-relaxed">
              {step.description}
            </p>

            {/* Progress dots */}
            <div className="flex justify-center gap-2 my-4">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    triggerHaptic();
                    setCurrentStep(idx);
                  }}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    idx === currentStep
                      ? "w-6 bg-primary"
                      : idx < currentStep
                      ? "bg-primary/50"
                      : "bg-muted"
                  )}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex gap-3">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  onClick={goToPrevious}
                  className="flex-1 h-12 rounded-xl touch-target"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <Button
                onClick={goToNext}
                className={cn(
                  "flex-1 h-12 rounded-xl touch-target font-semibold",
                  isLastStep &&
                    "bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 hover:opacity-90"
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

            {/* Swipe hint */}
            <p className="text-center text-xs text-muted-foreground mt-3">
              Swipe left or right to navigate
            </p>
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

  const startTour = useCallback(() => {
    setShowTour(true);
  }, []);

  const completeTour = useCallback(() => {
    setShowTour(false);
    setHasSeenTour(true);
    localStorage.setItem("mobile-tour-completed", "true");
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem("mobile-tour-completed");
    setHasSeenTour(false);
  }, []);

  return {
    showTour,
    hasSeenTour,
    startTour,
    completeTour,
    resetTour,
  };
}
