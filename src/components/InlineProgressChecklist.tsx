import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Building2, Target, Brain, Package, Link } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressStep {
  id: string;
  label: string;
  completed: boolean;
  section: string;
  icon: React.ElementType;
  detail?: string;
}

interface InlineProgressChecklistProps {
  brand: any;
  offers: any[];
  onScrollToSection: (section: string) => void;
}

export function InlineProgressChecklist({ brand, offers, onScrollToSection }: InlineProgressChecklistProps) {
  const steps: ProgressStep[] = [
    {
      id: "brand-basics",
      label: "Brand Basics",
      completed: !!(brand?.name && brand?.website_url && brand?.industry),
      section: "brand-details",
      icon: Building2,
    },
    {
      id: "positioning",
      label: "Positioning",
      completed: !!(brand?.value_proposition && brand?.target_audience),
      section: "brand-details",
      icon: Target,
    },
    {
      id: "brand-brain",
      label: "Brain",
      completed: brand?.psychology_status === "approved" && brand?.use_emojis !== undefined,
      section: "brand-brain",
      icon: Brain,
    },
    {
      id: "offers",
      label: "Offers",
      completed: offers.length > 0,
      section: "offers",
      icon: Package,
    },
    {
      id: "meta",
      label: "Meta",
      completed: !!brand?.meta_account_id,
      section: "meta-account",
      icon: Link,
      detail: brand?.page_name || (brand?.meta_account_id ? `Act ${brand.meta_account_id}` : undefined),
    },
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const percentage = Math.round((completedCount / steps.length) * 100);
  const isComplete = percentage === 100;

  if (isComplete) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      {/* Header with progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Profile Setup</span>
          <span className="text-muted-foreground">{completedCount} of {steps.length} complete</span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between gap-1">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              onClick={() => onScrollToSection(step.section)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                step.completed 
                  ? "text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/10 cursor-pointer" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
              )}
            >
              <div className={cn(
                "relative w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                step.completed 
                  ? "bg-green-100 dark:bg-green-900/30" 
                  : "bg-muted"
              )}>
                {step.completed ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span className={cn(
                "text-[10px] sm:text-xs font-medium text-center leading-tight",
                step.completed 
                  ? "text-green-600 dark:text-green-400" 
                  : "hover:underline"
              )}>
                {step.label}
              </span>
              {step.completed && step.detail && (
                <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight truncate max-w-[80px]">
                  {step.detail}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Next step hint */}
      {!isComplete && (
        <div className="text-xs text-muted-foreground text-center pt-1 border-t">
          {steps.find(s => !s.completed) && (
            <>
              Next: <button 
                onClick={() => onScrollToSection(steps.find(s => !s.completed)!.section)}
                className="text-primary hover:underline font-medium"
              >
                {steps.find(s => !s.completed)!.label}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}