import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lumiKPIConfig, defaultLumiKPIConfig, getLumiKPIConfig } from '@/lib/lumi-kpi-config';
import { cn } from '@/lib/utils';

// ============================================================================
// RetrospectiveSetupDialog (Patch #24)
//
// Pre-flight modal that runs before generating a retrospective. Two jobs:
//   1. Confirm or set the GOAL (KPI + threshold + direction). Pre-fills from
//      campaign_goals if a row exists for the workspace; otherwise suggests
//      defaults from the campaign's Meta objective.
//   2. Confirm the DATE RANGE. Default lifetime; user can scope to a window.
//
// Inline realism check: shows a warning when the configured goal looks
// unreachable given the spend that's already happened.
// ============================================================================

export interface RetroSetupResult {
  goalOverride: {
    primary_kpi: string;
    primary_kpi_label: string;
    primary_kpi_threshold: number;
    primary_kpi_goal_type: 'less_than' | 'greater_than';
  } | null;
  dateRange: { start: string; end: string } | null; // null = lifetime
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The Meta campaign info from the tray. */
  campaign: {
    metaCampaignId: string;
    name: string;
    objective: string | null;
    spend: number;
    results: number;
  };
  /** Workspace ID if one exists for this Meta campaign — used to pre-fill the goal. */
  workspaceId?: string | null;
  brandId: string;
  onConfirm: (result: RetroSetupResult) => void;
}

const RANGE_OPTIONS = [
  { label: 'Lifetime (recommended)', days: null },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

const KPI_OPTIONS = [
  { value: 'cpl', label: 'Cost per lead', unit: '$', defaultDirection: 'less_than' as const },
  { value: 'cpa', label: 'Cost per acquisition', unit: '$', defaultDirection: 'less_than' as const },
  { value: 'roas', label: 'Return on ad spend', unit: 'x', defaultDirection: 'greater_than' as const },
  { value: 'ctr', label: 'Click-through rate', unit: '%', defaultDirection: 'greater_than' as const },
  { value: 'cpc', label: 'Cost per click', unit: '$', defaultDirection: 'less_than' as const },
  { value: 'cpm', label: 'Cost per 1k impressions', unit: '$', defaultDirection: 'less_than' as const },
];

export function RetrospectiveSetupDialog({
  open, onOpenChange, campaign, workspaceId, brandId, onConfirm,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [haveStoredGoal, setHaveStoredGoal] = useState(false);

  const [kpi, setKpi] = useState('cpl');
  const [threshold, setThreshold] = useState<string>('');
  const [direction, setDirection] = useState<'less_than' | 'greater_than'>('less_than');

  const [rangeChoice, setRangeChoice] = useState<string>('lifetime');

  const kpiOption = KPI_OPTIONS.find(k => k.value === kpi) || KPI_OPTIONS[0];

  // Load existing goal (if any) on open + suggest defaults from objective.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Try to find a stored goal for this workspace.
        let storedGoal: any = null;
        if (workspaceId) {
          const { data } = await supabase
            .from('campaign_goals')
            .select('primary_kpi, primary_kpi_label, primary_kpi_threshold, primary_kpi_goal_type')
            .eq('workspace_id', workspaceId)
            .maybeSingle();
          storedGoal = data;
        }
        if (cancelled) return;
        if (storedGoal && storedGoal.primary_kpi && storedGoal.primary_kpi_threshold != null) {
          setHaveStoredGoal(true);
          setKpi(String(storedGoal.primary_kpi));
          setThreshold(String(storedGoal.primary_kpi_threshold));
          setDirection(storedGoal.primary_kpi_goal_type === 'greater_than' ? 'greater_than' : 'less_than');
        } else {
          setHaveStoredGoal(false);
          // Suggest defaults from the Meta objective.
          const cfg = getLumiKPIConfig(campaign.objective || '') || defaultLumiKPIConfig;
          const suggestedKpi = (cfg.primary || 'cpl').toLowerCase();
          const opt = KPI_OPTIONS.find(o => o.value === suggestedKpi) || KPI_OPTIONS[0];
          setKpi(opt.value);
          setDirection(opt.defaultDirection);
          // Suggest threshold near the lower end of the benchmark.
          const range = cfg.benchmark.max - cfg.benchmark.min;
          const suggested = opt.defaultDirection === 'greater_than'
            ? cfg.benchmark.min
            : cfg.benchmark.min + range / 3;
          setThreshold(String(Math.round(suggested * 100) / 100));
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, workspaceId, campaign.objective]);

  // Auto-update direction when KPI changes (CPL = less_than, ROAS = greater_than, etc.).
  useEffect(() => {
    setDirection(kpiOption.defaultDirection);
  }, [kpi]);

  // Realism check: if user's threshold is for a "less than" cost goal, do
  // we have enough spend to even theoretically hit it?
  const realismWarning = (() => {
    const t = parseFloat(threshold);
    if (!isFinite(t) || t <= 0) return null;
    if (kpiOption.unit === '$' && direction === 'less_than' && campaign.spend > 0) {
      const expectedConversions = campaign.spend / t;
      if (expectedConversions < 10) {
        return `At a $${t.toFixed(2)} ${kpiOption.label.toLowerCase()} target, your $${campaign.spend.toFixed(2)} of spend supports at most ${Math.floor(expectedConversions)} conversions — too few to evaluate this goal honestly. Consider lowering the bar or running the retro after more spend.`;
      }
    }
    return null;
  })();

  const handleConfirm = () => {
    const t = parseFloat(threshold);
    const goalOverride = isFinite(t) && t > 0
      ? {
          primary_kpi: kpi,
          primary_kpi_label: kpiOption.label,
          primary_kpi_threshold: t,
          primary_kpi_goal_type: direction,
        }
      : null;

    let dateRange: { start: string; end: string } | null = null;
    if (rangeChoice !== 'lifetime') {
      const days = parseInt(rangeChoice, 10);
      if (isFinite(days)) {
        const today = new Date();
        const start = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        dateRange = { start: fmt(start), end: fmt(today) };
      }
    }

    onConfirm({ goalOverride, dateRange });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Set goal + window for "{campaign.name}"</DialogTitle>
          <DialogDescription>
            Lumi needs to know what success looks like for this campaign. The retro is way more useful with a goal to measure against.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />Loading…
          </div>
        ) : (
          <div className="space-y-5">
            {/* GOAL */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold">Goal</Label>
                {haveStoredGoal && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Pre-filled from this campaign's saved goal. Override if you want to evaluate against something different.
                  </p>
                )}
                {!haveStoredGoal && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Suggested based on the campaign's Meta objective. Adjust to your actual target.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">KPI</Label>
                  <Select value={kpi} onValueChange={setKpi}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KPI_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Direction</Label>
                  <Select value={direction} onValueChange={v => setDirection(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="less_than">Less than (≤)</SelectItem>
                      <SelectItem value="greater_than">Greater than (≥)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Target value ({kpiOption.unit || 'number'})</Label>
                <div className="flex items-center gap-2">
                  {kpiOption.unit === '$' && <span className="text-sm text-muted-foreground">$</span>}
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={threshold}
                    onChange={e => setThreshold(e.target.value)}
                    placeholder="0.00"
                  />
                  {kpiOption.unit === 'x' && <span className="text-sm text-muted-foreground">x</span>}
                  {kpiOption.unit === '%' && <span className="text-sm text-muted-foreground">%</span>}
                </div>
              </div>

              {realismWarning && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 flex gap-2 items-start text-[12px]">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p>{realismWarning}</p>
                </div>
              )}
            </div>

            {/* DATE RANGE */}
            <div className="space-y-2 pt-2 border-t">
              <div>
                <Label className="text-sm font-semibold">Time window</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Lifetime is usually best — the algorithm-learning phase + the steady state are both signal. Use a shorter window when you've meaningfully changed the campaign mid-flight.
                </p>
              </div>
              <Select value={rangeChoice} onValueChange={setRangeChoice}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map(o => (
                    <SelectItem key={o.label} value={o.days == null ? 'lifetime' : String(o.days)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="lumi" onClick={handleConfirm} disabled={loading} className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            Generate retrospective
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
