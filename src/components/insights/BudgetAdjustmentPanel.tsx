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
  const suggestedBudget = Math.round(liveEffectiveBudget * (1 + recommendation.percentage / 100));

  const handleApplyRecommendation = () => {
    setNewBudget(suggestedBudget);
  };

  const handleSaveBudget = async () => {
    setUpdating(true);
    setErrorState(null);
    try {
      // We call the function via fetch (instead of supabase.functions.invoke)
      // so we can read the response body even on a non-2xx status — the
      // ambiguous-ABO case returns 400 with the adSets[] payload we need
      // to render an inline picker.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const supabaseUrl = (supabase as any).supabaseUrl ||
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;

      const resp = await fetch(`${supabaseUrl}/functions/v1/update-meta-budget`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
        },
        body: JSON.stringify({
          workspaceId,
          newBudget,
          ...(activeTarget ? { adSetId: activeTarget.id } : {}),
        }),
      });

      let data: any = null;
      try { data = await resp.json(); } catch { /* ignore body parse */ }

      if (!resp.ok || !data?.success) {
        // Preserve the ad-set list from the server (if any) so we can
        // render a picker right inside the panel.
        setErrorState({
          message: data?.error || `Couldn't update budget on Meta (${resp.status}).`,
          adSets: Array.isArray(data?.adSets) ? data.adSets : undefined,
        });
        return;
      }

      // Mirror the change locally so UI reflects the new budget without
      // waiting for the next Meta sync.
      const { data: existing } = await supabase
        .from("campaign_workspaces")
        .select("campaign_builder_answers")
        .eq("id", workspaceId)
        .maybeSingle();

      const existingAnswers = (existing?.campaign_builder_answers as Record<string, any>) || {};
      const updatedAnswers: Record<string, any> = { ...existingAnswers };
      if (activeTarget && Array.isArray(existingAnswers.adSets)) {
        updatedAnswers.adSets = existingAnswers.adSets.map((a: any) =>
          a.id === activeTarget.id ? { ...a, dailyBudget: newBudget } : a,
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
      setErrorState({
        message: error?.message || "We couldn't reach Meta to update this budget. Please try again.",
      });
    } finally {
      setUpdating(false);
    }
  };

  // User picked a specific ad set from the inline picker — make it the
  // active target and reset the budget slider to that set's current value.
  const handlePickAdSet = (set: AdSetOption) => {
    if (set.dailyBudget == null) {
      setErrorState({
        message: `We don't have a current daily budget for "${set.name}" yet. Try resyncing this campaign or update the budget directly in Meta Ads Manager.`,
      });
      return;
    }
    setActiveTarget({ id: set.id, name: set.name, currentBudget: set.dailyBudget });
    setNewBudget(set.dailyBudget);
    setErrorState(null);
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
          {activeTarget ? `Scale "${activeTarget.name}"` : 'Lumi Budget Recommendation'}
        </CardTitle>
        {activeTarget && (
          <p className="text-xs text-muted-foreground pt-1">
            Changes land on this ad set only — not the whole campaign.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inline error block — never silent. Shows server's reason and,
            when applicable, an ad-set picker so the user can recover
            without leaving the panel. */}
        {errorState && (
          <div className="p-3 rounded-lg border border-red-200 bg-red-50 space-y-3">
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-900">
                  We couldn't update this budget on Meta
                </p>
                <p className="text-xs text-red-800 mt-1">{errorState.message}</p>
              </div>
            </div>
            {errorState.adSets && errorState.adSets.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-red-900">
                  Pick which ad set to update:
                </p>
                <div className="space-y-1">
                  {errorState.adSets.map((set) => (
                    <button
                      key={set.id}
                      type="button"
                      onClick={() => handlePickAdSet(set)}
                      className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-red-200 bg-white hover:bg-red-100 transition-colors"
                    >
                      <span className="text-xs font-medium truncate">{set.name}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {set.dailyBudget != null ? `$${set.dailyBudget}/day` : 'budget unknown'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Current Budget */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {targetAdSet ? 'Ad set budget' : 'Current budget'}
          </span>
          <span className="font-semibold">${liveEffectiveBudget}/day</span>
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
            max={Math.max(500, liveEffectiveBudget * 2)}
            step={5}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>$5/day</span>
            <span>${Math.max(500, liveEffectiveBudget * 2)}/day</span>
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
            disabled={updating || newBudget === liveEffectiveBudget}
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
