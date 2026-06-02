import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calculator, Target, DollarSign, TrendingUp, Info } from "lucide-react";

type ObjectiveKind = "sales" | "leads" | "traffic" | "awareness";

interface BudgetCalculatorProps {
  /** Campaign objective (any Meta-style value). */
  objective?: string;
  /** Average order value / offer price (e.g. workspace.offer_price). */
  offerPrice?: string | number | null;
  /** Optional goal CPA the user already set (cost-per-purchase or cost-per-lead). */
  goalCpa?: number | null;
  /** Called when the user clicks "Use this daily budget". */
  onApply: (dailyBudget: number) => void;
}

/** Meta's learning-phase exit benchmark. Source of truth for "good" data per week. */
const LEARNING_PHASE_TARGET = 50;

function normalizeObjective(o?: string): ObjectiveKind {
  if (!o) return "sales";
  const v = o.toLowerCase();
  if (v.includes("lead")) return "leads";
  if (v.includes("traffic") || v.includes("link_click")) return "traffic";
  if (v.includes("aware") || v.includes("reach")) return "awareness";
  return "sales";
}

/** Reasonable defaults when the user hasn't set goals yet. */
function defaultCpa(objective: ObjectiveKind, aov: number): number {
  switch (objective) {
    case "leads":
      return 8; // typical $5–$15 CPL for coaches/creators
    case "traffic":
      return 0.5; // CPC-ish proxy for "cost per outcome"
    case "awareness":
      return 0.01; // per impression — calculator hides conversions for this
    case "sales":
    default:
      // Aim for ~25–35% of AOV as CPA for healthy ROAS ~3x
      return aov > 0 ? Math.max(5, Math.round(aov * 0.3)) : 35;
  }
}

function parsePrice(p?: string | number | null): number {
  if (p == null) return 0;
  if (typeof p === "number") return p;
  const cleaned = String(p).replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function BudgetCalculator({
  objective,
  offerPrice,
  goalCpa,
  onApply,
}: BudgetCalculatorProps) {
  const obj = normalizeObjective(objective);
  const aov = parsePrice(offerPrice);

  // User-editable assumptions
  const [cpa, setCpa] = useState<number>(goalCpa && goalCpa > 0 ? goalCpa : defaultCpa(obj, aov));
  const [aovEdit, setAovEdit] = useState<number>(aov || 0);

  // Forward inputs
  const [dailySpend, setDailySpend] = useState<number>(30);
  // Goal-conversions mode
  const [goalConversions, setGoalConversions] = useState<number>(LEARNING_PHASE_TARGET);
  // Goal-revenue mode
  const [goalRevenue, setGoalRevenue] = useState<number>(2500);

  const conversionLabel = obj === "leads" ? "leads" : obj === "traffic" ? "clicks" : "purchases";

  const forward = useMemo(() => {
    const weeklySpend = dailySpend * 7;
    const conversions = cpa > 0 ? weeklySpend / cpa : 0;
    const revenue = obj === "sales" ? conversions * aovEdit : 0;
    return { weeklySpend, conversions, revenue };
  }, [dailySpend, cpa, aovEdit, obj]);

  const fromConversions = useMemo(() => {
    const weeklySpend = goalConversions * cpa;
    const daily = Math.max(5, Math.round(weeklySpend / 7));
    const revenue = obj === "sales" ? goalConversions * aovEdit : 0;
    return { daily, weeklySpend, revenue };
  }, [goalConversions, cpa, aovEdit, obj]);

  const fromRevenue = useMemo(() => {
    const conversions = aovEdit > 0 ? goalRevenue / aovEdit : 0;
    const weeklySpend = conversions * cpa;
    const daily = Math.max(5, Math.round(weeklySpend / 7));
    return { conversions, weeklySpend, daily };
  }, [goalRevenue, aovEdit, cpa]);

  const learningPhaseDaily = useMemo(() => {
    const weekly = LEARNING_PHASE_TARGET * cpa;
    return Math.max(5, Math.round(weekly / 7));
  }, [cpa]);

  return (
    <Card className="border-primary/20">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Calculator className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm">Budget calculator</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Meta needs ~{LEARNING_PHASE_TARGET} {conversionLabel}/week to exit the learning phase. Plan from a
              goal — or set a budget and see what to expect.
            </p>
          </div>
        </div>

        {/* Assumptions row — used by all modes */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
          <div className="space-y-1">
            <Label className="text-[11px] uppercase text-muted-foreground">
              Expected cost per {conversionLabel.replace(/s$/, "")}
            </Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                min={0.1}
                step={0.5}
                value={cpa}
                onChange={(e) => setCpa(Math.max(0.1, parseFloat(e.target.value) || 0))}
                className="pl-5 h-8 text-sm"
              />
            </div>
          </div>
          {obj === "sales" && (
            <div className="space-y-1">
              <Label className="text-[11px] uppercase text-muted-foreground">Avg order value</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={aovEdit}
                  onChange={(e) => setAovEdit(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="pl-5 h-8 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <Tabs defaultValue="goalConversions" className="w-full">
          <TabsList className="grid grid-cols-3 w-full h-auto">
            <TabsTrigger value="goalConversions" className="text-[11px] py-1.5 gap-1">
              <Target className="h-3 w-3" /> Goal {conversionLabel}
            </TabsTrigger>
            {obj === "sales" && (
              <TabsTrigger value="goalRevenue" className="text-[11px] py-1.5 gap-1">
                <TrendingUp className="h-3 w-3" /> Goal revenue
              </TabsTrigger>
            )}
            <TabsTrigger value="setSpend" className="text-[11px] py-1.5 gap-1">
              <DollarSign className="h-3 w-3" /> Set spend
            </TabsTrigger>
          </TabsList>

          {/* MODE 1: Goal conversions → daily spend */}
          <TabsContent value="goalConversions" className="space-y-3 pt-3">
            <div className="space-y-1">
              <Label className="text-xs">Target {conversionLabel} per week</Label>
              <Input
                type="number"
                min={1}
                value={goalConversions}
                onChange={(e) => setGoalConversions(Math.max(1, parseInt(e.target.value) || 0))}
                className="h-9"
              />
              {goalConversions < LEARNING_PHASE_TARGET && (
                <p className="text-[11px] text-amber-600 flex items-start gap-1 mt-1">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  Meta typically needs {LEARNING_PHASE_TARGET}/week to optimize well. Below that, results stay
                  unpredictable.
                </p>
              )}
            </div>
            <ResultRow
              daily={fromConversions.daily}
              weekly={fromConversions.weeklySpend}
              revenue={obj === "sales" ? fromConversions.revenue : undefined}
              onApply={() => onApply(fromConversions.daily)}
            />
          </TabsContent>

          {/* MODE 2: Goal revenue → daily spend */}
          {obj === "sales" && (
            <TabsContent value="goalRevenue" className="space-y-3 pt-3">
              <div className="space-y-1">
                <Label className="text-xs">Target revenue per week</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min={0}
                    step={50}
                    value={goalRevenue}
                    onChange={(e) => setGoalRevenue(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="pl-7 h-9"
                  />
                </div>
                {aovEdit <= 0 && (
                  <p className="text-[11px] text-destructive mt-1">
                    Add an Avg order value above to calculate.
                  </p>
                )}
              </div>
              <ResultRow
                daily={fromRevenue.daily}
                weekly={fromRevenue.weeklySpend}
                conversions={fromRevenue.conversions}
                conversionLabel={conversionLabel}
                onApply={() => onApply(fromRevenue.daily)}
                disabled={aovEdit <= 0}
              />
            </TabsContent>
          )}

          {/* MODE 3: Set spend → projected results */}
          <TabsContent value="setSpend" className="space-y-3 pt-3">
            <div className="space-y-1">
              <Label className="text-xs">Daily ad spend</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={dailySpend}
                  onChange={(e) => setDailySpend(Math.max(5, parseFloat(e.target.value) || 0))}
                  className="pl-7 h-9"
                />
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-1.5 text-sm">
              <Stat label={`Projected ${conversionLabel} / week`} value={forward.conversions.toFixed(1)} />
              <Stat label="Weekly spend" value={`$${forward.weeklySpend.toFixed(0)}`} />
              {obj === "sales" && (
                <Stat label="Projected revenue / week" value={`$${forward.revenue.toFixed(0)}`} />
              )}
              {forward.conversions < LEARNING_PHASE_TARGET && (
                <p className="text-[11px] text-amber-600 flex items-start gap-1 pt-1">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  At this spend you'll get ~{forward.conversions.toFixed(0)}/week — below Meta's{" "}
                  {LEARNING_PHASE_TARGET}/week threshold. ~${learningPhaseDaily}/day would get you there.
                </p>
              )}
            </div>
            <Button size="sm" className="w-full" onClick={() => onApply(Math.round(dailySpend))}>
              Use ${Math.round(dailySpend)}/day
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-semibold text-sm">{value}</span>
    </div>
  );
}

function ResultRow({
  daily,
  weekly,
  revenue,
  conversions,
  conversionLabel,
  onApply,
  disabled,
}: {
  daily: number;
  weekly: number;
  revenue?: number;
  conversions?: number;
  conversionLabel?: string;
  onApply: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Recommended daily budget</span>
          <span className="text-2xl font-bold text-primary">${daily}</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          ≈ ${weekly.toFixed(0)}/week · ${(daily * 30).toLocaleString()}/month
          {conversions != null && conversionLabel ? ` · ~${conversions.toFixed(1)} ${conversionLabel}/week` : ""}
          {revenue != null && revenue > 0 ? ` · ~$${revenue.toFixed(0)} revenue/week` : ""}
        </div>
      </div>
      <Button size="sm" className="w-full" onClick={onApply} disabled={disabled}>
        Use ${daily}/day
      </Button>
    </div>
  );
}
