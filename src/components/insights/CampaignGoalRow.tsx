import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Target, Pencil, AlertTriangle, Check, X } from 'lucide-react';
import { LumiKPIConfig, formatLumiKPIValue } from '@/lib/lumi-kpi-config';

interface CampaignGoalRowProps {
  kpiConfig: LumiKPIConfig;
  currentValue: number | null;
  userGoal: number | null;
  onUpdateGoal: (goal: number) => void;
}

function getRecommendedGoal(kpiConfig: LumiKPIConfig): number {
  // For ROAS (higher is better), recommend the minimum benchmark
  if (kpiConfig.primary === 'roas') {
    return kpiConfig.benchmark.min;
  }
  // For cost metrics (lower is better), recommend the max of the range (realistic target)
  return kpiConfig.benchmark.max;
}

function isGoalUnrealistic(goal: number, kpiConfig: LumiKPIConfig): boolean {
  if (kpiConfig.primary === 'roas') {
    // For ROAS, unrealistic if > 3x the max benchmark
    return goal > kpiConfig.benchmark.max * 3;
  }
  // For cost metrics, unrealistic if < 30% of the min benchmark
  return goal < kpiConfig.benchmark.min * 0.3;
}

function getVariance(current: number | null, goal: number): { abs: string; pct: string; isGood: boolean } | null {
  if (current === null || current === 0) return null;
  const diff = current - goal;
  const pctDiff = ((diff / goal) * 100);
  
  // For cost metrics, being under goal is good. We'll handle ROAS inversion at render.
  return {
    abs: `${diff >= 0 ? '+' : ''}${formatAbsValue(diff)}`,
    pct: `${pctDiff >= 0 ? '+' : ''}${pctDiff.toFixed(0)}%`,
    isGood: diff <= 0, // Under budget = good for cost metrics (inverted for ROAS at render)
  };
}

function formatAbsValue(value: number): string {
  return `$${Math.abs(value).toFixed(2)}`;
}

export function CampaignGoalRow({ kpiConfig, currentValue, userGoal, onUpdateGoal }: CampaignGoalRowProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [pendingGoal, setPendingGoal] = useState<number | null>(null);

  const recommended = getRecommendedGoal(kpiConfig);
  const activeGoal = userGoal ?? recommended;
  const isRoas = kpiConfig.primary === 'roas';
  const unit = kpiConfig.benchmark.unit;

  const variance = currentValue !== null && currentValue !== 0
    ? (() => {
        const diff = currentValue - activeGoal;
        const pctDiff = ((diff / activeGoal) * 100);
        const isGood = isRoas ? diff >= 0 : diff <= 0;
        const absStr = isRoas
          ? `${diff >= 0 ? '+' : ''}${Math.abs(diff).toFixed(2)}x`
          : `${diff >= 0 ? '+' : '-'}$${Math.abs(diff).toFixed(2)}`;
        return {
          abs: absStr,
          pct: `${pctDiff >= 0 ? '+' : ''}${pctDiff.toFixed(0)}%`,
          isGood,
        };
      })()
    : null;

  const handleOpenEdit = () => {
    setInputValue(String(activeGoal));
    setEditing(true);
    setShowWarning(false);
    setPendingGoal(null);
  };

  const handleSave = () => {
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed) || parsed <= 0) return;

    if (isGoalUnrealistic(parsed, kpiConfig)) {
      setPendingGoal(parsed);
      setShowWarning(true);
      return;
    }

    onUpdateGoal(parsed);
    setEditing(false);
    setShowWarning(false);
  };

  const handleConfirmUnrealistic = () => {
    if (pendingGoal !== null) {
      onUpdateGoal(pendingGoal);
    }
    setEditing(false);
    setShowWarning(false);
    setPendingGoal(null);
  };

  const handleCancel = () => {
    setEditing(false);
    setShowWarning(false);
    setPendingGoal(null);
  };

  const formatGoalDisplay = (value: number) => {
    if (isRoas) return `${value.toFixed(1)}x`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="flex items-center gap-2 pl-5 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Target className="h-3 w-3" />
        <span className="font-medium">{kpiConfig.primaryLabel} Goal:</span>
      </div>

      {!editing ? (
        <>
          <Badge variant="outline" className="text-xs rounded-full gap-1">
            {formatGoalDisplay(activeGoal)}
            {!userGoal && (
              <span className="text-muted-foreground/70 ml-0.5">(Lumi's rec)</span>
            )}
          </Badge>

          {variance && (
            <Badge
              variant="outline"
              className={`text-xs rounded-full ${
                variance.isGood
                  ? 'text-green-700 border-green-500/30 bg-green-50 dark:bg-green-950/20'
                  : 'text-red-700 border-red-500/30 bg-red-50 dark:bg-red-950/20'
              }`}
            >
              {variance.abs} ({variance.pct})
            </Badge>
          )}

          <Popover open={editing} onOpenChange={(open) => open ? handleOpenEdit() : handleCancel()}>
            <PopoverTrigger asChild>
              <button
                onClick={handleOpenEdit}
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            </PopoverTrigger>
          </Popover>
        </>
      ) : (
        <Popover open={editing} onOpenChange={(open) => { if (!open) handleCancel(); }}>
          <PopoverTrigger asChild>
            <span />
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4" align="start">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground">
                  Set your {kpiConfig.primaryLabel} target
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lumi recommends {formatGoalDisplay(recommended)} based on industry benchmarks
                  ({kpiConfig.benchmark.unit === 'x'
                    ? `${kpiConfig.benchmark.min.toFixed(1)}x – ${kpiConfig.benchmark.max.toFixed(1)}x`
                    : `$${kpiConfig.benchmark.min.toFixed(2)} – $${kpiConfig.benchmark.max.toFixed(2)}`
                  })
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{isRoas ? '' : '$'}</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={inputValue}
                  onChange={(e) => { setInputValue(e.target.value); setShowWarning(false); }}
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') handleCancel();
                  }}
                />
                {isRoas && <span className="text-sm text-muted-foreground">x</span>}
              </div>

              {showWarning && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      That's a pretty ambitious goal!
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                      {isRoas
                        ? `Most campaigns in this category achieve ${kpiConfig.benchmark.min.toFixed(1)}x – ${kpiConfig.benchmark.max.toFixed(1)}x ROAS. Setting expectations too high may lead to unnecessary stress.`
                        : `Industry benchmarks for this type sit around $${kpiConfig.benchmark.min.toFixed(2)} – $${kpiConfig.benchmark.max.toFixed(2)}. Going much lower may not be realistic.`
                      }
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-xs"
                      onClick={handleConfirmUnrealistic}
                    >
                      Set anyway
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setInputValue(String(recommended));
                    setShowWarning(false);
                  }}
                >
                  Use Lumi's rec
                </Button>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCancel}>
                    <X className="h-3 w-3" />
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
                    <Check className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
