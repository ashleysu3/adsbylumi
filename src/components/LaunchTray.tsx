import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useCampaignDraft } from "@/contexts/CampaignDraftContext";
import { cn } from "@/lib/utils";

/**
 * LaunchTray — pinned summary above the Creative tabs.
 *
 * Reads the user's currently-selected ad concepts from CampaignDraftContext
 * (the same place Strategy wrote its plan). It surfaces:
 *   - how many concepts are picked
 *   - how many distinct angles they span
 *   - a "test health" readout so creators know if Meta has enough variation
 *     to find a winner
 *   - a "Continue to launch" CTA
 */
export function LaunchTray() {
  const navigate = useNavigate();
  const { draft } = useCampaignDraft();

  const selected = draft.concepts ?? [];
  const count = selected.length;
  const distinctAngles = useMemo(() => {
    const set = new Set<string>();
    for (const c of selected) {
      if (c.angle) set.add(c.angle);
    }
    return set.size;
  }, [selected]);

  const health =
    count >= 4
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
            tone: "red" as const,
            icon: XCircle,
            label: "Nothing selected",
            message: "Pick at least 4 concepts to launch.",
          };

  const HealthIcon = health.icon;

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

        <Button
          onClick={() => navigate("/launch")}
          disabled={count < 1}
          className="gap-2"
        >
          <Rocket className="h-4 w-4" />
          Continue to launch
        </Button>
      </div>
    </Card>
  );
}

export default LaunchTray;
