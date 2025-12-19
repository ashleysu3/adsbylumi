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
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BudgetAdjustmentPanelProps {
  workspaceId: string;
  workspaceName: string;
  currentBudget: number;
  metrics: {
    roas?: number | null;
    cpl?: number | null;
    cpp?: number | null;
    ctr?: number | null;
    frequency?: number | null;
    spend?: number;
  } | null;
  onBudgetUpdate?: (newBudget: number) => void;
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
}: BudgetAdjustmentPanelProps) {
  const [newBudget, setNewBudget] = useState(currentBudget);
  const [updating, setUpdating] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

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
  const suggestedBudget = Math.round(currentBudget * (1 + recommendation.percentage / 100));

  const handleApplyRecommendation = () => {
    setNewBudget(suggestedBudget);
  };

  const handleSaveBudget = async () => {
    setUpdating(true);
    try {
      // Update workspace with new budget
      const { error } = await supabase
        .from("campaign_workspaces")
        .update({
          campaign_builder_answers: {
            budget: newBudget,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspaceId);

      if (error) throw error;

      toast.success(`Budget updated to $${newBudget}/day`);
      onBudgetUpdate?.(newBudget);
      setShowPanel(false);
    } catch (error: any) {
      console.error("Error updating budget:", error);
      toast.error("Failed to update budget");
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

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Lumi Budget Recommendation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Budget */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Current budget</span>
          <span className="font-semibold">${currentBudget}/day</span>
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
            max={Math.max(500, currentBudget * 2)}
            step={5}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>$5/day</span>
            <span>${Math.max(500, currentBudget * 2)}/day</span>
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
            disabled={updating || newBudget === currentBudget}
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
          Changes apply to your Meta campaign
        </p>
      </CardContent>
    </Card>
  );
}
