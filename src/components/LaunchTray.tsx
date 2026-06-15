import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, CheckCircle2, AlertTriangle, Sparkles, XCircle } from "lucide-react";
import { useCampaignDraft } from "@/contexts/CampaignDraftContext";
import { cn } from "@/lib/utils";

const MIN_CONCEPTS = 4;

/**
 * LaunchTray — pinned summary above the Creative tabs.
 *
 * Empty state is a neutral nudge (not an error). The red "pick at
 * least N" warning only appears if the user actually clicks
 * "Continue to launch" with too few selected.
 */
export function LaunchTray() {
  const navigate = useNavigate();
  const { draft } = useCampaignDraft();
  const [showBelowMinError, setShowBelowMinError] = useState(false);

  const selected = draft.concepts ?? [];
  const count = selected.length;
  const distinctAngles = useMemo(() => {
    const set = new Set<string>();
    for (const c of selected) {
      if (c.angle) set.add(c.angle);
    }
    return set.size;
  }, [selected]);

  const belowMin = count < MIN_CONCEPTS;

  const health =
    showBelowMinError && belowMin
      ? {
          tone: "red" as const,
          icon: XCircle,
          label: count === 0 ? "Nothing selected" : "Not enough concepts",
          message: `Pick at least ${MIN_CONCEPTS} concepts to launch.`,
        }
      : count >= MIN_CONCEPTS
        ? {
            tone: "green" as const,
            icon: CheckCircle2,
            label: "Healthy test",
            message: "Meta has enough to find a winner.",
          }
        : count >= 1
          ? {
              tone: "amber" as const,
              icon: AlertTriangle,
              label: "Thin test",
              message: "Add a few more so Meta can compare.",
            }
          : {
              tone: "neutral" as const,
              icon: Sparkles,
              label: "Build your launch set",
              message:
                "Pick concepts in Angles & copy, or add a design here, to start your test.",
            };

  const HealthIcon = health.icon;

  const handleContinue = () => {
    if (belowMin) {
      setShowBelowMinError(true);
      return;
    }
    navigate("/launch");
  };

  return (
    <Card
      className={cn(
        "p-4 mb-4 border rounded-2xl",
        health.tone === "green" &&
          "bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900",
        health.tone === "amber" &&
          "bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900",
        health.tone === "red" &&
          "bg-rose-50/60 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900",
        health.tone === "neutral" &&
          "bg-muted/40 border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
              health.tone === "green" &&
                "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
              health.tone === "amber" &&
                "bg-amber-500/15 text-amber-700 dark:text-amber-300",
              health.tone === "red" &&
                "bg-rose-500/15 text-rose-700 dark:text-rose-300",
              health.tone === "neutral" &&
                "bg-foreground/5 text-muted-foreground",
            )}
          >
            <HealthIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{health.label}</span>
              <span className="text-xs text-muted-foreground">
                {health.message}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {count} {count === 1 ? "concept" : "concepts"} selected
              </Badge>
              <Badge variant="outline" className="text-xs">
                {distinctAngles}{" "}
                {distinctAngles === 1 ? "angle" : "angles"}
              </Badge>
            </div>
          </div>
        </div>

        <Button onClick={handleContinue} className="gap-2">
          <Rocket className="h-4 w-4" />
          Continue to launch
        </Button>
      </div>
    </Card>
  );
}

export default LaunchTray;
