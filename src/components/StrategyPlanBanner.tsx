import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { loadStrategyPlan } from "@/pages/StrategyPlan";

export function StrategyPlanBanner() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState(() => loadStrategyPlan());

  useEffect(() => {
    const onStorage = () => setPlan(loadStrategyPlan());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!plan) return null;
  const total = plan.campaigns.length;
  const done = plan.statuses.filter((s) => s === "done").length;
  const activeIdx = plan.activeIndex;
  const activeCampaign =
    typeof activeIdx === "number" ? plan.campaigns[activeIdx] : null;

  return (
    <Card className="mb-4 p-4 border-lumi-pink-1/30 bg-gradient-to-r from-lumi-pink-1/5 to-lumi-purple-1/5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-lumi-pink-1 to-lumi-purple-1 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-lumi-pink-1 font-semibold">
                Strategy plan · {done} of {total} built
              </p>
              <p className="font-semibold truncate">
                {activeCampaign
                  ? `Building: ${activeCampaign.name ?? `Campaign ${(activeIdx ?? 0) + 1}`}`
                  : plan.name}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/strategy-plan")}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to plan
            </Button>
          </div>
          <Progress
            value={total === 0 ? 0 : (done / total) * 100}
            className="mt-3 h-1.5"
          />
        </div>
      </div>
    </Card>
  );
}
