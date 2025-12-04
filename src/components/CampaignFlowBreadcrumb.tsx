import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CampaignFlowBreadcrumbProps {
  currentStep: "planning" | "creative" | "production" | "data";
  campaignId?: string;
  progressStatus?: string;
  offerName?: string;
  className?: string;
}

interface Step {
  id: string;
  label: string;
  route: string;
  status: "completed" | "current" | "upcoming" | "disabled";
}

export function CampaignFlowBreadcrumb({
  currentStep,
  campaignId,
  progressStatus = "draft",
  offerName,
  className
}: CampaignFlowBreadcrumbProps) {
  const navigate = useNavigate();

  // Determine step status based on progress_status
  const getStepStatus = (stepId: string): "completed" | "current" | "upcoming" | "disabled" => {
    const statusMap: Record<string, number> = {
      draft: 1,
      creative_in_progress: 2,
      waiting_for_assets: 3,
      ready_to_publish: 3,
      publishing_to_meta: 4,
      live: 4,
      completed: 4,
    };

    const stepOrder: Record<string, number> = {
      planning: 1,
      creative: 2,
      production: 3,
      data: 4,
    };

    const currentProgress = statusMap[progressStatus] || 1;
    const stepPosition = stepOrder[stepId] || 1;

    if (stepId === currentStep) return "current";
    if (stepPosition < currentProgress) return "completed";
    if (stepPosition === currentProgress && stepId !== currentStep) return "completed";
    if (!campaignId && stepId !== "planning") return "disabled";
    
    return "upcoming";
  };

  const steps: Step[] = [
    {
      id: "planning",
      label: "Planning",
      route: "/planning",
      status: getStepStatus("planning"),
    },
    {
      id: "creative",
      label: "Creative",
      route: "/creative",
      status: getStepStatus("creative"),
    },
    {
      id: "production",
      label: "Production",
      route: "/production",
      status: getStepStatus("production"),
    },
    {
      id: "data",
      label: "Data",
      route: "/data",
      status: getStepStatus("data"),
    },
  ];

  const handleStepClick = (step: Step) => {
    if (step.status === "disabled") return;
    navigate(step.route);
  };

  return (
    <div className={cn("sticky top-0 z-40", className)}>
      {/* Offer name bar */}
      {offerName && (
        <div className="bg-muted/50 border-b border-border/50 py-1.5 px-4">
          <p className="text-xs text-muted-foreground text-center">
            <span className="font-medium text-foreground/70">{offerName}</span>
          </p>
        </div>
      )}
      
      {/* Progress announcement bar */}
      <nav
        aria-label="Campaign progress"
        className="bg-background/95 backdrop-blur-sm border-b border-border shadow-sm"
      >
        <div className="container mx-auto px-4 py-2">
          <ol className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
            {steps.map((step, index) => {
              const isCompleted = step.status === "completed";
              const isCurrent = step.status === "current";
              const isDisabled = step.status === "disabled";
              const isLast = index === steps.length - 1;

              return (
                <li key={step.id} className="flex items-center gap-1 sm:gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStepClick(step)}
                    disabled={isDisabled}
                    className={cn(
                      "flex items-center gap-1.5 h-auto py-1.5 px-2 sm:px-3 transition-all rounded-full",
                      isCurrent && "bg-primary/15 text-primary font-semibold shadow-sm",
                      isCompleted && "text-muted-foreground hover:text-foreground",
                      isDisabled && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    ) : (
                      <Circle
                        className={cn(
                          "h-3.5 w-3.5",
                          isCurrent && "fill-primary text-primary",
                          !isCurrent && !isCompleted && "text-muted-foreground"
                        )}
                      />
                    )}
                    <span className="text-xs sm:text-sm">{step.label}</span>
                  </Button>

                  {!isLast && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
    </div>
  );
}