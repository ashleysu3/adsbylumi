import { ReactNode, useState, useRef, TouchEvent } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AutoSaveIndicator, SaveStatus } from "./AutoSaveIndicator";

interface MobileStepWizardProps {
  currentStep: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  nextLabel?: string;
  completeLabel?: string;
  canProceed?: boolean;
  isLoading?: boolean;
  showBackOnFirstStep?: boolean;
  enableSwipe?: boolean;
  saveStatus?: SaveStatus;
}

export function MobileStepWizard({
  currentStep,
  totalSteps,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  onComplete,
  nextLabel = "Continue",
  completeLabel = "Complete",
  canProceed = true,
  isLoading = false,
  showBackOnFirstStep = false,
  enableSwipe = true,
  saveStatus,
}: MobileStepWizardProps) {
  const isLastStep = currentStep === totalSteps;
  const showBack = currentStep > 1 || showBackOnFirstStep;
  
  // Swipe handling
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const minSwipeDistance = 50;

  // Haptic feedback helper
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if ('vibrate' in navigator) {
      const patterns = {
        light: 10,
        medium: 25,
        heavy: 50,
      };
      navigator.vibrate(patterns[type]);
    }
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (!enableSwipe) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!enableSwipe) return;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!enableSwipe) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isSwipeLeft = distance > minSwipeDistance;
    const isSwipeRight = distance < -minSwipeDistance;

    if (isSwipeLeft && canProceed && !isLoading) {
      // Swipe left = next step - trigger haptic feedback
      triggerHaptic('medium');
      if (isLastStep) {
        onComplete?.();
      } else {
        onNext?.();
      }
    } else if (isSwipeRight && showBack && !isLoading) {
      // Swipe right = previous step - trigger haptic feedback
      triggerHaptic('light');
      onBack?.();
    }

    // Reset
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex-shrink-0 pb-4">
        {/* Progress indicator */}
        <div className="step-indicator mb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "step-dot",
                i + 1 === currentStep && "active",
                i + 1 < currentStep && "completed"
              )}
            />
          ))}
        </div>

        {/* Step info */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <p className="text-xs text-muted-foreground">
              Step {currentStep} of {totalSteps}
            </p>
            {saveStatus && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <AutoSaveIndicator status={saveStatus} size="sm" />
              </>
            )}
          </div>
          <h2 className="text-xl font-display font-bold">{title}</h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Content - scrollable with swipe */}
      <div 
        className="flex-1 overflow-y-auto py-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>

      {/* Footer - sticky */}
      <div className="flex-shrink-0 pt-4 pb-2 bg-background border-t border-border -mx-4 px-4 sticky bottom-0">
        <div className="flex gap-3">
          {showBack && onBack && (
            <Button
              variant="outline"
              onClick={onBack}
              disabled={isLoading}
              className="flex-shrink-0 h-12 w-12 p-0 touch-target"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          
          <Button
            onClick={isLastStep ? onComplete : onNext}
            disabled={!canProceed || isLoading}
            className={cn(
              "flex-1 h-12 font-semibold text-base touch-target",
              isLastStep && "bg-gradient-to-r from-lumi-orange-1 via-lumi-pink-1 to-lumi-purple-1 hover:opacity-90"
            )}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              isLastStep ? completeLabel : nextLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface StepOptionProps {
  selected: boolean;
  onSelect: () => void;
  icon?: ReactNode;
  title: string;
  description?: string;
  badge?: string;
  recommended?: boolean;
}

export function StepOption({
  selected,
  onSelect,
  icon,
  title,
  description,
  badge,
  recommended,
}: StepOptionProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-xl border-2 text-left transition-all touch-target",
        "active:scale-[0.98]",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/50"
      )}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div className={cn(
            "flex-shrink-0 p-2 rounded-lg",
            selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {icon}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-semibold",
              selected && "text-primary"
            )}>
              {title}
            </span>
            {recommended && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-gradient-to-r from-lumi-orange-1/20 to-lumi-pink-1/20 text-lumi-pink-1">
                Recommended
              </span>
            )}
            {badge && !recommended && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
              {description}
            </p>
          )}
        </div>

        {/* Selection indicator */}
        <div className={cn(
          "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center",
          selected ? "border-primary bg-primary" : "border-muted-foreground/30"
        )}>
          {selected && (
            <div className="w-2 h-2 rounded-full bg-white" />
          )}
        </div>
      </div>
    </button>
  );
}

interface StepSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  formatValue?: (value: number) => string;
  presets?: { value: number; label: string }[];
}

export function StepSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  formatValue = (v) => `$${v}`,
  presets,
}: StepSliderProps) {
  return (
    <div className="space-y-4">
      {/* Current value display */}
      <div className="text-center">
        <div className="text-4xl font-bold font-display text-gradient-lumi">
          {formatValue(value)}
        </div>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-3 bg-muted rounded-full appearance-none cursor-pointer touch-target
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-6
          [&::-webkit-slider-thumb]:h-6
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-gradient-to-r
          [&::-webkit-slider-thumb]:from-lumi-orange-1
          [&::-webkit-slider-thumb]:to-lumi-pink-1
          [&::-webkit-slider-thumb]:shadow-lg
          [&::-webkit-slider-thumb]:shadow-lumi-pink-1/30
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-6
          [&::-moz-range-thumb]:h-6
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-gradient-to-r
          [&::-moz-range-thumb]:from-lumi-orange-1
          [&::-moz-range-thumb]:to-lumi-pink-1
          [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:cursor-pointer"
      />

      {/* Presets */}
      {presets && (
        <div className="flex justify-between gap-2">
          {presets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => onChange(preset.value)}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all touch-target",
                value === preset.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
