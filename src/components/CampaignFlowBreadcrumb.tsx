import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CampaignFlowBreadcrumbProps {
  currentStep: "planning" | "creative" | "production" | "data";
  campaignId?: string;
  progressStatus?: string;
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
    <nav
      aria-label="Campaign progress"
      className={cn("border-b border-border bg-background/95 backdrop-blur-sm", className)}
    >
      <div className="container mx-auto px-4 py-3">
        <ol className="flex items-center justify-center gap-2 flex-wrap">
          {steps.map((step, index) => {
            const isCompleted = step.status === "completed";
            const isCurrent = step.status === "current";
            const isDisabled = step.status === "disabled";
            const isLast = index === steps.length - 1;

            return (
              <li key={step.id} className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStepClick(step)}
                  disabled={isDisabled}
                  className={cn(
                    "flex items-center gap-2 h-auto py-2 px-3 transition-colors",
                    isCurrent && "bg-primary/10 text-primary font-semibold",
                    isCompleted && "text-muted-foreground hover:text-foreground",
                    isDisabled && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Circle
                      className={cn(
                        "h-4 w-4",
                        isCurrent && "fill-primary text-primary",
                        !isCurrent && !isCompleted && "text-muted-foreground"
                      )}
                    />
                  )}
                  <span className="text-sm">{step.label}</span>
                </Button>

                {!isLast && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
