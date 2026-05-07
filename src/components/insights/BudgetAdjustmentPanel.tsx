import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Shape returned by update-meta-budget when it refuses to act on an
// ambiguous ABO campaign (multiple active ad sets, no adSetId given).
type AdSetOption = {
  id: string;
  name: string;
  status?: string;
  dailyBudget?: number | null;
};

interface BudgetAdjustmentPanelProps {
  workspaceId: string;
  workspaceName: string;
  /**
   * The campaign's actual daily budget pulled from Meta. May be null/undefined
   * if Meta hasn't returned a value yet — in that case we DO NOT guess a number.
   * The panel will show a "budget unknown" state instead.
   */
  currentBudget: number | null | undefined;
  metrics: {
    roas?: number | null;
    cpl?: number | null;
    cpp?: number | null;
    ctr?: number | null;
    frequency?: number | null;
    spend?: number;
  } | null;
  onBudgetUpdate?: (newBudget: number) => void;
  /** When true, panel renders open immediately without the toggle button */
  inline?: boolean;
  /**
   * Optional: when the calling surface has detected that this campaign has
   * a Testing + Scaling structure, it can point the budget change at the
   * Scaling ad set specifically.
   */
  targetAdSet?: {
    id: string;
    name: string;
    currentBudget: number;
  } | null;
}

type Recommendation = {
  action: "scale" | "maintain" | "reduce" | "pause";
  percentage: number;
  reason: string;
  confidence: "high" | "medium" | "low";
};

export function BudgetAdjustmentPanel({
  workspaceId,
  workspaceName,
  currentBudget,
  metrics,
  onBudgetUpdate,
  inline = false,
  targetAdSet = null,
}: BudgetAdjustmentPanelProps) {
  // When targeting a specific ad set (e.g. "Scaling"), use that set's budget
  // as the starting point — not the campaign-wide aggregate. Keeps the
  // percentage math honest. If we don't actually know the budget, do NOT
  // make one up — render a clear "unknown" state instead.
  const knownBudget: number | null = targetAdSet
    ? targetAdSet.currentBudget
    : (typeof currentBudget === 'number' && currentBudget > 0 ? currentBudget : null);
  const [activeTarget, setActiveTarget] = useState<typeof targetAdSet>(targetAdSet);
  // Re-resolve effective budget any time the user picks a different ad set.
  const liveKnownBudget: number | null = activeTarget
    ? activeTarget.currentBudget
    : knownBudget;
  const liveEffectiveBudget = liveKnownBudget ?? 0;
  const [newBudget, setNewBudget] = useState(liveEffectiveBudget);
  const [updating, setUpdating] = useState(false);
  const [showPanel, setShowPanel] = useState(inline);

  // Inline error state — replaces the silent "panel closes" failure mode.
  // When set, the panel stays open and renders the error block. If Meta
  // returned an `adSets` payload (ambiguous ABO case), we render a picker.
  const [errorState, setErrorState] = useState<{
    message: string;
    adSets?: AdSetOption[];
  } | null>(null);

  // Generate Lumi recommendation based on metrics
  const getRecommendation = (): Recommendation => {
    if (!metrics) {
      return {
        action: "maintain",
        percentage: 0,
        reason: "Not enough data yet. Keep current budget while we gather insights.",
        confidence: "low",
      };
    }

    const { roas, cpl, cpp, ctr, frequency } = metrics;

    // Check for fatigue first
    if (frequency && frequency >= 4) {
      return {
        action: "reduce",
        percentage: -30,
        reason: "High frequency (${frequency.toFixed(1)}) suggests audience fatigue. Reduce spend and refresh creative.",
        confidence: "high",
      };
    }

    // Check ROAS performance
    if (roas !== null && roas !== undefined) {
      if (roas >= 4) {
        return {
          action: "scale",
          percentage: 30,
          reason: `ROAS of ${roas.toFixed(1)}x is excellent! Scale up to capture more conversions.`,
          confidence: "high",
        };
      }
      if (roas >= 2.5) {
        return {
          action: "scale",
          percentage: 15,
          reason: `Solid ${roas.toFixed(1)}x ROAS. Consider a modest increase.`,
          confidence: "medium",
        };
      }
      if (roas < 1) {
        return {
          action: "reduce",
          percentage: -40,
          reason: `${roas.toFixed(1)}x ROAS is below breakeven. Reduce spend and optimize.`,
          confidence: "high",
        };
      }
    }

    // Check CTR
    if (ctr && ctr < 0.8) {
      return {
        action: "reduce",
        percentage: -20,
        reason: `Low CTR (${ctr.toFixed(2)}%) indicates weak creative. Fix before scaling.`,
        confidence: "medium",
      };
    }

    // Default: maintain
    return {
      action: "maintain",
      percentage: 0,
      reason: "Performance is stable. Monitor for a few more days before adjusting.",
      confidence: "medium",
    };
  };

  const recommendation = getRecommendation();
  const suggestedBudget = Math.round(effectiveCurrentBudget * (1 + recommendation.percentage / 100));

  const handleApplyRecommendation = () => {
    setNewBudget(suggestedBudget);
  };

  const handleSaveBudget = async () => {
    setUpdating(true);
    try {
      // When we have a specific target ad set, route the Meta change to it.
      // Otherwise keep the old campaign-level / distributed behavior.
      const { data, error } = await supabase.functions.invoke("update-meta-budget", {
        body: {
          workspaceId,
          newBudget,
          ...(targetAdSet ? { adSetId: targetAdSet.id } : {}),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to update budget on Meta");

      // Mirror the change in campaign_builder_answers so the UI reflects
      // the new budget without waiting for the next sync. If we targeted a
      // specific ad set, update that entry in the adSets array; otherwise
      // update the aggregate `budget` field as before.
      const { data: existing } = await supabase
        .from("campaign_workspaces")
        .select("campaign_builder_answers")
        .eq("id", workspaceId)
        .single();

      const existingAnswers = (existing?.campaign_builder_answers as Record<string, any>) || {};

      const updatedAnswers: Record<string, any> = { ...existingAnswers };
      if (targetAdSet && Array.isArray(existingAnswers.adSets)) {
        updatedAnswers.adSets = existingAnswers.adSets.map((a: any) =>
          a.id === targetAdSet.id ? { ...a, dailyBudget: newBudget } : a,
        );
      } else {
        updatedAnswers.budget = newBudget;
      }

      await supabase
        .from("campaign_workspaces")
        .update({
          campaign_builder_answers: updatedAnswers,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspaceId);

      toast.success(data.message || `Budget updated to $${newBudget}/day on Meta`);
      onBudgetUpdate?.(newBudget);
      setShowPanel(false);
    } catch (error: any) {
      console.error("Error updating budget:", error);
      toast.error(error.message || "Failed to update budget on Meta. Try changing it directly in Meta Ads Manager.");
    } finally {
      setUpdating(false);
    }
  };

  const getActionIcon = () => {
    switch (recommendation.action) {
      case "scale":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "reduce":
        return <TrendingDown className="h-4 w-4 text-amber-500" />;
      case "pause":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
    }
  };

  const getActionColor = () => {
    switch (recommendation.action) {
      case "scale": return "bg-green-50 text-green-700 border-green-200";
      case "reduce": return "bg-amber-50 text-amber-700 border-amber-200";
      case "pause": return "bg-red-50 text-red-700 border-red-200";
      default: return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  if (!showPanel) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowPanel(true)}
        className="gap-2"
      >
        <DollarSign className="h-4 w-4" />
        Adjust Budget
      </Button>
    );
  }

  // If we don't actually know the current budget, refuse to guess.
  if (knownBudget === null) {
    return (
      <Card className="border-2 border-amber-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Budget unavailable
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            We couldn't read this campaign's current daily budget from Meta yet, so we won't guess a number.
            Re-sync this campaign or update the budget directly in Meta Ads Manager.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPanel(false)}
            className="w-full"
          >
            Close
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {targetAdSet ? `Scale "${targetAdSet.name}"` : 'Lumi Budget Recommendation'}
        </CardTitle>
        {targetAdSet && (
          <p className="text-xs text-muted-foreground pt-1">
            Changes land on this ad set only — not the whole campaign.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Budget */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {targetAdSet ? 'Ad set budget' : 'Current budget'}
          </span>
          <span className="font-semibold">${effectiveCurrentBudget}/day</span>
        </div>

        {/* Recommendation */}
        <div className={`p-3 rounded-lg border ${getActionColor()}`}>
          <div className="flex items-start gap-2">
            {getActionIcon()}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm capitalize">
                  {recommendation.action === "scale" ? "Scale Up" : 
                   recommendation.action === "reduce" ? "Scale Down" : 
                   recommendation.action === "pause" ? "Consider Pausing" : "Maintain"}
                </span>
                <Badge variant="outline" className="text-xs">
                  {recommendation.confidence} confidence
                </Badge>
              </div>
              <p className="text-xs opacity-90">{recommendation.reason}</p>
            </div>
          </div>
        </div>

        {/* Suggested Budget */}
        {recommendation.action !== "maintain" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleApplyRecommendation}
            className="w-full gap-2"
          >
            Apply suggestion: ${suggestedBudget}/day
            <span className="text-xs text-muted-foreground">
              ({recommendation.percentage > 0 ? "+" : ""}{recommendation.percentage}%)
            </span>
          </Button>
        )}

        {/* Budget Slider */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">New budget</span>
            <span className="font-bold text-lg">${newBudget}/day</span>
          </div>
          <Slider
            value={[newBudget]}
            onValueChange={(v) => setNewBudget(v[0])}
            min={5}
            max={Math.max(500, effectiveCurrentBudget * 2)}
            step={5}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>$5/day</span>
            <span>${Math.max(500, effectiveCurrentBudget * 2)}/day</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPanel(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSaveBudget}
            disabled={updating || newBudget === effectiveCurrentBudget}
            className="flex-1 gap-2"
          >
            {updating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save Budget
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          {targetAdSet
            ? `Budget will be updated on "${targetAdSet.name}" in Meta`
            : 'Budget will be updated directly on your Meta campaign'}
        </p>
      </CardContent>
    </Card>
  );
}
