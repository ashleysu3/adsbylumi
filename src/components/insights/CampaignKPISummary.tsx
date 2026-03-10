import { cn } from '@/lib/utils';
import {
  LumiKPIConfig,
  getLumiKPIStatus,
  formatLumiKPIValue,
} from '@/lib/lumi-kpi-config';

interface CampaignGoal {
  primary_kpi: string;
  primary_kpi_label: string;
  primary_kpi_threshold: number;
  primary_kpi_goal_type: string;
  secondary_kpi?: string | null;
  secondary_kpi_label?: string | null;
  secondary_kpi_threshold?: number | null;
  secondary_kpi_goal_type?: string | null;
  frequency_threshold?: number | null;
}

interface KPICell {
  key: string;
  label: string;
  value: number | null;
  goal: number | null;
  goalLabel: string;
  status: 'healthy' | 'attention' | 'critical' | 'no-data';
}

interface CampaignKPISummaryProps {
  metrics: Record<string, number | null | undefined> | null;
  kpiConfig: LumiKPIConfig;
  goals?: CampaignGoal | null;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  healthy: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
  attention: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
  critical: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
  'no-data': 'bg-muted border-border',
};

const STATUS_VALUE_COLORS: Record<string, string> = {
  healthy: 'text-green-700 dark:text-green-400',
  attention: 'text-amber-700 dark:text-amber-400',
  critical: 'text-red-700 dark:text-red-400',
  'no-data': 'text-muted-foreground',
};

function getGoalStatus(
  value: number | null | undefined,
  threshold: number,
  goalType: string,
  kpiKey: string
): 'healthy' | 'attention' | 'critical' | 'no-data' {
  if (value === null || value === undefined || isNaN(value)) return 'no-data';
  if (value === 0 && ['cpl', 'cpp', 'roas', 'costPerThruPlay'].includes(kpiKey)) return 'no-data';

  const isHigherBetter = goalType === 'greater_than';

  if (isHigherBetter) {
    if (value >= threshold) return 'healthy';
    if (value >= threshold * 0.7) return 'attention';
    return 'critical';
  } else {
    if (value <= threshold) return 'healthy';
    if (value <= threshold * 1.3) return 'attention';
    return 'critical';
  }
}

function getMetricValue(metrics: Record<string, number | null | undefined> | null, key: string): number | null {
  if (!metrics) return null;
  // Direct match
  if (key in metrics && metrics[key] != null) return metrics[key] as number;
  // Computed CTR
  if (key === 'ctr') {
    const impressions = metrics.impressions || 0;
    const clicks = metrics.clicks || metrics.linkClicks || 0;
    return impressions > 0 ? (clicks / impressions) * 100 : null;
  }
  // Computed costPerThruPlay
  if (key === 'costPerThruPlay' && metrics.spend && metrics.videoThruPlays) {
    return metrics.videoThruPlays > 0 ? metrics.spend / metrics.videoThruPlays : null;
  }
  return null;
}

function formatGoal(value: number, kpiKey: string): string {
  const currencyKPIs = ['cpc', 'cpm', 'cpl', 'cpp', 'costPerThruPlay'];
  if (currencyKPIs.includes(kpiKey)) return `$${value.toFixed(2)}`;
  if (kpiKey === 'roas') return `${value.toFixed(1)}x`;
  if (kpiKey === 'ctr') return `${value.toFixed(1)}%`;
  if (kpiKey === 'frequency') return value.toFixed(1);
  return value.toFixed(2);
}

export function CampaignKPISummary({ metrics, kpiConfig, goals, className }: CampaignKPISummaryProps) {
  const cells: KPICell[] = [];

  // 1. Primary KPI from goals or kpiConfig
  if (goals?.primary_kpi) {
    const val = getMetricValue(metrics, goals.primary_kpi);
    cells.push({
      key: goals.primary_kpi,
      label: goals.primary_kpi_label,
      value: val,
      goal: goals.primary_kpi_threshold,
      goalLabel: `Goal: ${formatGoal(goals.primary_kpi_threshold, goals.primary_kpi)}`,
      status: getGoalStatus(val, goals.primary_kpi_threshold, goals.primary_kpi_goal_type, goals.primary_kpi),
    });
  } else {
    const val = getMetricValue(metrics, kpiConfig.primary);
    cells.push({
      key: kpiConfig.primary,
      label: kpiConfig.primaryLabel,
      value: val,
      goal: null,
      goalLabel: `Benchmark: ${kpiConfig.benchmark.unit === 'x' ? `${kpiConfig.benchmark.min.toFixed(1)}x–${kpiConfig.benchmark.max.toFixed(1)}x` : `$${kpiConfig.benchmark.min.toFixed(2)}–$${kpiConfig.benchmark.max.toFixed(2)}`}`,
      status: getLumiKPIStatus(val, kpiConfig.benchmark, kpiConfig.primary),
    });
  }

  // 2. Secondary KPI from goals
  if (goals?.secondary_kpi && goals.secondary_kpi_label && goals.secondary_kpi_threshold != null) {
    const val = getMetricValue(metrics, goals.secondary_kpi);
    cells.push({
      key: goals.secondary_kpi,
      label: goals.secondary_kpi_label,
      value: val,
      goal: goals.secondary_kpi_threshold,
      goalLabel: `Goal: ${formatGoal(goals.secondary_kpi_threshold, goals.secondary_kpi)}`,
      status: getGoalStatus(val, goals.secondary_kpi_threshold, goals.secondary_kpi_goal_type || 'less_than', goals.secondary_kpi),
    });
  }

  // 3. Fill remaining slots with CTR then Frequency (up to 3 total)
  const usedKeys = new Set(cells.map(c => c.key));

  if (cells.length < 3 && !usedKeys.has('ctr')) {
    const ctrVal = getMetricValue(metrics, 'ctr');
    cells.push({
      key: 'ctr',
      label: 'CTR',
      value: ctrVal,
      goal: null,
      goalLabel: 'Benchmark: 1.0%+',
      status: ctrVal === null ? 'no-data' : ctrVal >= 1.0 ? 'healthy' : ctrVal >= 0.7 ? 'attention' : 'critical',
    });
  }

  if (cells.length < 3 && !usedKeys.has('frequency')) {
    const freqVal = getMetricValue(metrics, 'frequency');
    const freqThreshold = goals?.frequency_threshold || 4;
    cells.push({
      key: 'frequency',
      label: 'Frequency',
      value: freqVal,
      goal: freqThreshold,
      goalLabel: `Goal: < ${freqThreshold}`,
      status: freqVal === null ? 'no-data' : freqVal <= freqThreshold ? 'healthy' : freqVal <= freqThreshold * 1.25 ? 'attention' : 'critical',
    });
  }

  return (
    <div className={cn('grid grid-cols-3 gap-2 pl-5', className)}>
      {cells.slice(0, 3).map((cell) => (
        <div
          key={cell.key}
          className={cn(
            'rounded-xl border px-3 py-2 space-y-0.5 transition-colors',
            STATUS_STYLES[cell.status]
          )}
        >
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">
            {cell.label}
          </div>
          <div className={cn('text-sm font-bold tabular-nums', STATUS_VALUE_COLORS[cell.status])}>
            {cell.key === 'ctr'
              ? (cell.value != null ? `${cell.value.toFixed(1)}%` : '—')
              : cell.key === 'frequency'
              ? (cell.value != null ? cell.value.toFixed(1) : '—')
              : formatLumiKPIValue(cell.value ?? null, cell.key)}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            {cell.goalLabel}
          </div>
        </div>
      ))}
    </div>
  );
}
