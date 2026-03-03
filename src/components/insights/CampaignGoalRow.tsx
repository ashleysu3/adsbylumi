import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LumiTooltip } from '@/components/LumiTooltip';
import { Target, Pencil, AlertTriangle, Check, X } from 'lucide-react';
import { LumiKPIConfig } from '@/lib/lumi-kpi-config';

interface CampaignGoalRowProps {
  kpiConfig: LumiKPIConfig;
  currentValue: number | null;
  userGoal: number | null;
  onUpdateGoal: (goal: number) => void;
}

function getRecommendedGoal(kpiConfig: LumiKPIConfig): number {
  if (kpiConfig.primary === 'roas') {
    return kpiConfig.benchmark.min;
  }
  const range = kpiConfig.benchmark.max - kpiConfig.benchmark.min;
  return Math.round((kpiConfig.benchmark.min + range / 3) * 100) / 100;
}

function isGoalUnrealistic(goal: number, kpiConfig: LumiKPIConfig): boolean {
  if (kpiConfig.primary === 'roas') {
    return goal > kpiConfig.benchmark.max * 3;
  }
  return goal < kpiConfig.benchmark.min * 0.3;
}

type GoalStatus = 'great' | 'close' | 'behind' | null;

function getGoalStatus(currentValue: number | null, goal: number, isRoas: boolean): GoalStatus {
  if (currentValue === null || currentValue === 0) return null;
  const pct = ((currentValue - goal) / goal) * 100;
  if (isRoas) {
    // Higher is better
    if (pct >= 0) return 'great';
    if (pct >= -20) return 'close';
    return 'behind';
  }
  // Lower is better (cost metrics)
  if (pct <= 0) return 'great';
  if (pct <= 20) return 'close';
  return 'behind';
}

const STATUS_DOT_CLASSES: Record<string, string> = {
  great: 'bg-green-500',
  close: 'bg-amber-500',
  behind: 'bg-red-500',
};

function getStatusMessage(status: GoalStatus, goalDisplay: string): string {
  switch (status) {
    case 'great':
      return `Your ads are beating your goal of ${goalDisplay} — great job! 🎉`;
    case 'close':
      return `Your ads are close to your goal of ${goalDisplay}. Keep an eye on it.`;
    case 'behind':
      return `Your ads aren't meeting your goal of ${goalDisplay}. Check Lumi's recommendations for next steps.`;
    default:
      return '';
  }
}

export function CampaignGoalRow({ kpiConfig, currentValue, userGoal, onUpdateGoal }: CampaignGoalRowProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [pendingGoal, setPendingGoal] = useState<number | null>(null);

  const recommended = getRecommendedGoal(kpiConfig);
  const activeGoal = userGoal ?? recommended;
  const isRoas = kpiConfig.primary === 'roas';

  const formatGoalDisplay = (value: number) => {
    if (isRoas) return `${value.toFixed(1)}x`;
    return `$${value.toFixed(2)}`;
  };

  const status = getGoalStatus(currentValue, activeGoal, isRoas);

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
    if (pendingGoal !== null) onUpdateGoal(pendingGoal);
    setEditing(false);
    setShowWarning(false);
    setPendingGoal(null);
  };

  const handleCancel = () => {
    setEditing(false);
    setShowWarning(false);
    setPendingGoal(null);
  };

  return (
    <div className="flex items-center gap-2 pl-5 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Target className="h-3 w-3" />
        <span className="font-medium">{kpiConfig.primaryLabel} Goal:</span>
      </div>

      {status && (
        <LumiTooltip content={getStatusMessage(status, formatGoalDisplay(activeGoal))} side="top">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT_CLASSES[status]} shrink-0 cursor-default`} />
        </LumiTooltip>
      )}

      {!editing ? (
        <>
          <Badge variant="outline" className="text-xs rounded-full gap-1">
            {formatGoalDisplay(activeGoal)}
            {!userGoal && (
              <span className="text-muted-foreground/70 ml-0.5">(Lumi's rec)</span>
            )}
          </Badge>

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
                        ? `Most campaigns achieve ${kpiConfig.benchmark.min.toFixed(1)}x – ${kpiConfig.benchmark.max.toFixed(1)}x ROAS.`
                        : `Industry benchmarks sit around $${kpiConfig.benchmark.min.toFixed(2)} – $${kpiConfig.benchmark.max.toFixed(2)}.`
                      }
                    </p>
                    <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={handleConfirmUnrealistic}>
                      Set anyway
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setInputValue(String(recommended)); setShowWarning(false); }}>
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