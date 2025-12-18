import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ClipboardList, Sparkles, Target, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowPhase {
  id: "strategy" | "creative" | "production";
  label: string;
  icon: typeof Target;
  completed: boolean;
  active: boolean;
  route: string;
}

interface WorkflowHeaderProps {
  offerName?: string;
  offerDescription?: string;
  workspaceId?: string;
  workspaceName?: string;
  hasStrategy?: boolean;
  hasCreative?: boolean;
  hasProduction?: boolean;
  currentPhase: "strategy" | "creative" | "production";
  className?: string;
}

export function WorkflowHeader({
  offerName,
  offerDescription,
  workspaceId,
  workspaceName,
  hasStrategy = false,
  hasCreative = false,
  hasProduction = false,
  currentPhase,
  className,
}: WorkflowHeaderProps) {
  const navigate = useNavigate();

  const phases: WorkflowPhase[] = [
    {
      id: "strategy",
      label: "Strategy",
      icon: Target,
      completed: hasStrategy,
      active: currentPhase === "strategy",
      route: `/planning${workspaceId ? `?workspace=${workspaceId}` : ""}`,
    },
    {
      id: "creative",
      label: "Creative",
      icon: Sparkles,
      completed: hasCreative,
      active: currentPhase === "creative",
      route: `/creative${workspaceId ? `?workspace=${workspaceId}` : ""}`,
    },
    {
      id: "production",
      label: "Production",
      icon: ClipboardList,
      completed: hasProduction,
      active: currentPhase === "production",
      route: `/production${workspaceId ? `?workspace=${workspaceId}` : ""}`,
    },
  ];

  const handlePhaseClick = (phase: WorkflowPhase) => {
    // Only navigate if the phase has content or is the current phase
    if (phase.completed || phase.active) {
      navigate(phase.route);
    }
  };

  return (
    <Card
      variant="gradient"
      className={cn(
        "p-4 border-b rounded-none border-x-0 border-t-0",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Offer Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-lg truncate">
              {offerName || workspaceName || "Campaign"}
            </h2>
            {offerDescription && (
              <p className="text-sm text-muted-foreground truncate max-w-md">
                {offerDescription}
              </p>
            )}
          </div>
        </div>

        {/* Phase Navigation */}
        <div className="flex items-center gap-1 sm:gap-2">
          {phases.map((phase, index) => {
            const Icon = phase.icon;
            const isClickable = phase.completed || phase.active;
            const StatusIcon = phase.completed ? CheckCircle2 : Circle;

            return (
              <div key={phase.id} className="flex items-center">
                <Button
                  variant={phase.active ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => handlePhaseClick(phase)}
                  disabled={!isClickable}
                  className={cn(
                    "gap-1.5 h-9 px-3 transition-all",
                    phase.active && "bg-primary/10 text-primary border border-primary/20",
                    phase.completed && !phase.active && "text-muted-foreground hover:text-foreground",
                    !isClickable && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <StatusIcon
                    className={cn(
                      "h-3.5 w-3.5",
                      phase.completed ? "text-green-500" : "text-muted-foreground"
                    )}
                  />
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline text-sm">{phase.label}</span>
                </Button>
                {index < phases.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 mx-1" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
