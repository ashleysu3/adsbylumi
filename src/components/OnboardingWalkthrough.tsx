import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action?: string;
  route?: string;
  targetSelector?: string;
  tourTitle?: string;
  tourDescription?: string;
}

interface OnboardingWalkthroughProps {
  steps: OnboardingStep[];
  onClose: () => void;
  onActionClick: (route?: string, targetSelector?: string, tourTitle?: string, tourDescription?: string) => void;
}

export function OnboardingWalkthrough({ steps, onClose, onActionClick }: OnboardingWalkthroughProps) {
  const [visibleSteps, setVisibleSteps] = useState<number>(0);
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);

  useEffect(() => {
    // Animate steps appearing one by one
    const interval = setInterval(() => {
      setVisibleSteps((prev) => {
        if (prev < steps.length) {
          return prev + 1;
        }
        clearInterval(interval);
        return prev;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [steps.length]);

  const completedCount = steps.filter(s => s.completed).length;
  const progressPercentage = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-2xl bg-gradient-to-br from-background via-background to-primary/5 border-2 shadow-2xl animate-scale-in">
        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-2 animate-pulse">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Your Campaign Journey
            </h2>
            <p className="text-muted-foreground">
              Here's your personalized roadmap to launch successful Meta ads
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Progress</span>
              <span className="text-muted-foreground">{completedCount} of {steps.length} complete</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Steps List */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {steps.slice(0, visibleSteps).map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "group relative p-4 rounded-lg border-2 transition-all duration-300",
                  "animate-fade-in",
                  step.completed 
                    ? "bg-primary/5 border-primary/20" 
                    : "bg-card border-border hover:border-primary/50 hover:shadow-md",
                  hoveredStep === step.id && "scale-[1.02]"
                )}
                style={{ animationDelay: `${index * 100}ms` }}
                onMouseEnter={() => setHoveredStep(step.id)}
                onMouseLeave={() => setHoveredStep(null)}
              >
                <div className="flex items-start gap-4">
                  {/* Step Icon */}
                  <div className={cn(
                    "flex-shrink-0 mt-1 transition-all duration-300",
                    step.completed && "animate-scale-in"
                  )}>
                    {step.completed ? (
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 space-y-1">
                    <h3 className={cn(
                      "font-semibold transition-colors",
                      step.completed ? "text-primary" : "text-foreground"
                    )}>
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                    
                    {/* Action Button */}
                    {!step.completed && step.action && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onActionClick(step.route, step.targetSelector, step.tourTitle, step.tourDescription)}
                        className="mt-2 h-8 px-3 text-xs font-medium hover:bg-primary/10 group/btn"
                      >
                        {step.action}
                        <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover/btn:translate-x-1" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Completion Badge */}
                {step.completed && (
                  <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-scale-in">
                    ✓ Done
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {completedCount === steps.length 
                ? "🎉 You're all set! Time to launch your campaign."
                : "Take it one step at a time - you've got this!"}
            </p>
            <Button onClick={onClose} variant="outline" className="hover-scale">
              Got it
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}