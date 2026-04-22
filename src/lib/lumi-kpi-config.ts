// Lumi Primary KPI Configuration by Campaign Type
// Maps campaign types to their most important metric

export interface LumiKPIConfig {
  primary: string;
  primaryLabel: string;
  benchmark: { min: number; max: number; unit: string };
  friendlyName: string;
}

// Primary KPI by campaign/template type
export const lumiKPIConfig: Record<string, LumiKPIConfig> = {
  // Lead Gen campaigns → CPL
  'lead-gen': {
    primary: 'cpl',
    primaryLabel: 'Cost Per Lead',
    benchmark: { min: 5, max: 35, unit: '$' },
    friendlyName: 'Lead Generation',
  },
  'Leads': {
    primary: 'cpl',
    primaryLabel: 'Cost Per Lead',
    benchmark: { min: 5, max: 35, unit: '$' },
    friendlyName: 'Lead Generation',
  },
  'LEAD_GENERATION': {
    primary: 'cpl',
    primaryLabel: 'Cost Per Lead',
    benchmark: { min: 5, max: 35, unit: '$' },
    friendlyName: 'Lead Generation',
  },
  'Discovery Call / Application': {
    primary: 'cpl',
    primaryLabel: 'Cost Per Lead',
    benchmark: { min: 20, max: 100, unit: '$' },
    friendlyName: 'Discovery Call',
  },
  'Email Capture': {
    primary: 'cpl',
    primaryLabel: 'Cost Per Lead',
    benchmark: { min: 3, max: 20, unit: '$' },
    friendlyName: 'Email Capture',
  },
  // Keep legacy mapping for existing campaigns
  'Lead Magnet Downloads': {
    primary: 'cpl',
    primaryLabel: 'Cost Per Lead',
    benchmark: { min: 3, max: 20, unit: '$' },
    friendlyName: 'Email Capture',
  },
  
  // Webinar campaigns → CPL
  'webinar': {
    primary: 'cpl',
    primaryLabel: 'Cost Per Lead',
    benchmark: { min: 8, max: 40, unit: '$' },
    friendlyName: 'Webinar Registration',
  },
  'Webinar Registration': {
    primary: 'cpl',
    primaryLabel: 'Cost Per Lead',
    benchmark: { min: 8, max: 40, unit: '$' },
    friendlyName: 'Webinar Registration',
  },
  'Webinar Sign Ups': {
    primary: 'cpl',
    primaryLabel: 'Cost Per Lead',
    benchmark: { min: 8, max: 40, unit: '$' },
    friendlyName: 'Webinar Registration',
  },
  
  // Low Ticket / Sales → CPP or ROAS
  'low-ticket': {
    primary: 'cpp',
    primaryLabel: 'Cost Per Purchase',
    benchmark: { min: 10, max: 50, unit: '$' },
    friendlyName: 'Low Ticket Sale',
  },
  'Low Ticket Product Sales': {
    primary: 'cpp',
    primaryLabel: 'Cost Per Purchase',
    benchmark: { min: 10, max: 50, unit: '$' },
    friendlyName: 'Low Ticket Sale',
  },
  'Sales': {
    primary: 'roas',
    primaryLabel: 'Return on Ad Spend',
    benchmark: { min: 2.0, max: 5.0, unit: 'x' },
    friendlyName: 'Sales',
  },
  'CONVERSIONS': {
    primary: 'roas',
    primaryLabel: 'Return on Ad Spend',
    benchmark: { min: 2.0, max: 5.0, unit: 'x' },
    friendlyName: 'Conversions',
  },
  
  // Discovery Call → CPL
  'discovery-call': {
    primary: 'cpl',
    primaryLabel: 'Cost Per Booked Call',
    benchmark: { min: 20, max: 100, unit: '$' },
    friendlyName: 'Discovery Call',
  },
  
  // Traffic campaigns → CPC
  'ig-traffic': {
    primary: 'cpc',
    primaryLabel: 'Cost Per Click',
    benchmark: { min: 0.15, max: 0.50, unit: '$' },
    friendlyName: 'Instagram Traffic',
  },
  'Traffic': {
    primary: 'cpc',
    primaryLabel: 'Cost Per Click',
    benchmark: { min: 0.15, max: 0.50, unit: '$' },
    friendlyName: 'Traffic',
  },
  'LINK_CLICKS': {
    primary: 'cpc',
    primaryLabel: 'Cost Per Click',
    benchmark: { min: 0.15, max: 0.50, unit: '$' },
    friendlyName: 'Traffic',
  },
  'Traffic to Instagram/Facebook': {
    primary: 'cpc',
    primaryLabel: 'Cost Per Click',
    benchmark: { min: 0.15, max: 0.50, unit: '$' },
    friendlyName: 'Social Traffic',
  },
  'Traffic to Instagram': {
    primary: 'cpc',
    primaryLabel: 'Cost Per Click',
    benchmark: { min: 0.15, max: 0.50, unit: '$' },
    friendlyName: 'Instagram Traffic',
  },
  'Traffic to Facebook': {
    primary: 'cpc',
    primaryLabel: 'Cost Per Click',
    benchmark: { min: 0.15, max: 0.50, unit: '$' },
    friendlyName: 'Facebook Traffic',
  },
  
  // Video Views → Cost per ThruPlay
  'video-views': {
    primary: 'costPerThruPlay',
    primaryLabel: 'Cost Per ThruPlay',
    benchmark: { min: 0.02, max: 0.08, unit: '$' },
    friendlyName: 'Video Views',
  },
  'VIDEO_VIEWS': {
    primary: 'costPerThruPlay',
    primaryLabel: 'Cost Per ThruPlay',
    benchmark: { min: 0.02, max: 0.08, unit: '$' },
    friendlyName: 'Video Views',
  },
  'ThruPlay Video Views': {
    primary: 'costPerThruPlay',
    primaryLabel: 'Cost Per ThruPlay',
    benchmark: { min: 0.02, max: 0.08, unit: '$' },
    friendlyName: 'Video Views',
  },
  
  // Engagement → CPM
  'Engagement': {
    primary: 'cpm',
    primaryLabel: 'Cost Per 1000 Views',
    benchmark: { min: 3, max: 10, unit: '$' },
    friendlyName: 'Engagement',
  },
  'ENGAGEMENT': {
    primary: 'cpm',
    primaryLabel: 'Cost Per 1000 Views',
    benchmark: { min: 3, max: 10, unit: '$' },
    friendlyName: 'Engagement',
  },
  
  // Awareness → CPM
  'REACH': {
    primary: 'cpm',
    primaryLabel: 'Cost Per 1000 Impressions',
    benchmark: { min: 2, max: 8, unit: '$' },
    friendlyName: 'Reach',
  },
  'BRAND_AWARENESS': {
    primary: 'cpm',
    primaryLabel: 'Cost Per 1000 Impressions',
    benchmark: { min: 3, max: 12, unit: '$' },
    friendlyName: 'Brand Awareness',
  },
};

// Default config for unknown campaign types (CPC is safest default)
export const defaultLumiKPIConfig: LumiKPIConfig = {
  primary: 'cpc',
  primaryLabel: 'Cost Per Click',
  benchmark: { min: 0.20, max: 0.80, unit: '$' },
  friendlyName: 'Campaign',
};

// Helper to detect campaign type from name when no template
function detectCampaignTypeFromName(name: string): string | null {
  const nameLower = name.toLowerCase();
  
  // Check for specific campaign types
  if (nameLower.includes('ig traffic') || nameLower.includes('instagram traffic')) return 'ig-traffic';
  if (nameLower.includes('traffic')) return 'Traffic';
  if (nameLower.includes('lead magnet')) return 'Lead Magnet Downloads';
  if (nameLower.includes('lead') || nameLower.includes('leads')) return 'Leads';
  if (nameLower.includes('discovery') || nameLower.includes('application') || nameLower.includes('call')) return 'Leads';
  if (nameLower.includes('webinar')) return 'webinar';
  if (nameLower.includes('sales') || nameLower.includes('purchase') || nameLower.includes('product')) return 'Sales';
  if (nameLower.includes('video') || nameLower.includes('views') || nameLower.includes('thruplay')) return 'video-views';
  if (nameLower.includes('engagement')) return 'Engagement';
  if (nameLower.includes('awareness') || nameLower.includes('reach')) return 'REACH';
  
  return null;
}

export function getLumiKPIConfig(
  campaignType: string | null | undefined,
  templateName?: string | null,
  campaignName?: string | null
): LumiKPIConfig {
  // Try direct campaign type/objective first
  if (campaignType && lumiKPIConfig[campaignType]) {
    return lumiKPIConfig[campaignType];
  }
  
  // Try template name
  if (templateName && lumiKPIConfig[templateName]) {
    return lumiKPIConfig[templateName];
  }
  
  // Try to detect from campaign name
  if (campaignName) {
    const detectedType = detectCampaignTypeFromName(campaignName);
    if (detectedType && lumiKPIConfig[detectedType]) {
      return lumiKPIConfig[detectedType];
    }
  }
  
  return defaultLumiKPIConfig;
}

export function formatLumiKPIValue(value: number | null | undefined, kpiKey: string): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  
  // Treat 0 as "no data" for conversion-based KPIs
  if (value === 0 && ['cpl', 'cpp', 'roas', 'costPerThruPlay'].includes(kpiKey)) {
    return '—';
  }
  
  const currencyKPIs = ['cpc', 'cpm', 'cpl', 'cpp', 'costPerThruPlay'];
  const multiplierKPIs = ['roas'];
  
  if (currencyKPIs.includes(kpiKey)) {
    return `$${value.toFixed(2)}`;
  }
  if (multiplierKPIs.includes(kpiKey)) {
    return `${value.toFixed(2)}x`;
  }
  return value.toFixed(2);
}

// FIX: Format benchmark range with correct unit placement
export function formatBenchmarkRange(benchmark: { min: number; max: number; unit: string }): string {
  if (benchmark.unit === 'x') {
    // For multiplier units (ROAS), put unit after the number
    return `${benchmark.min.toFixed(2)}x – ${benchmark.max.toFixed(2)}x`;
  }
  // For currency, put unit before
  return `${benchmark.unit}${benchmark.min.toFixed(2)} – ${benchmark.unit}${benchmark.max.toFixed(2)}`;
}

export function getLumiKPIStatus(
  value: number | null | undefined, 
  benchmark: { min: number; max: number; unit: string },
  kpiKey: string
): 'healthy' | 'attention' | 'critical' | 'no-data' {
  // No data cases
  if (value === null || value === undefined || isNaN(value)) return 'no-data';
  
  // Treat 0 as "no data" for conversion-based KPIs
  if (value === 0 && ['cpl', 'cpp', 'roas', 'costPerThruPlay'].includes(kpiKey)) {
    return 'no-data';
  }
  
  // For ROAS, higher is better
  if (kpiKey === 'roas') {
    if (value >= benchmark.min) return 'healthy';
    if (value >= benchmark.min * 0.7) return 'attention';
    return 'critical';
  }
  
  // For cost-based KPIs (CPC, CPL, CPP, etc.), lower is better
  // Being within or below the benchmark range is healthy
  if (value <= benchmark.max) return 'healthy';
  // Slightly above max but within 30% is attention
  if (value <= benchmark.max * 1.3) return 'attention';
  return 'critical';
}

export function getLumiStatusColor(status: 'healthy' | 'attention' | 'critical' | 'no-data'): string {
  switch (status) {
    case 'healthy': return 'bg-green-100 text-green-800 border-green-200';
    case 'attention': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    case 'no-data': return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

export function getLumiStatusDot(status: 'healthy' | 'attention' | 'critical' | 'no-data'): string {
  switch (status) {
    case 'healthy': return 'bg-green-500';
    case 'attention': return 'bg-amber-500';
    case 'critical': return 'bg-red-500';
    case 'no-data': return 'bg-gray-400';
  }
}

export function getLumiStatusLabel(status: 'healthy' | 'attention' | 'critical' | 'no-data'): string {
  switch (status) {
    case 'healthy': return 'Healthy';
    case 'attention': return 'Needs Attention';
    case 'critical': return 'Critical';
    case 'no-data': return 'No Data';
  }
}

export interface ObjectiveMetric {
  label: string;
  value: string;
}

export function getObjectiveMetrics(
  metrics: Record<string, number | null | undefined> | null,
  kpiConfig: LumiKPIConfig
): ObjectiveMetric[] {
  if (!metrics) return [];
  const result: ObjectiveMetric[] = [];
  const primary = kpiConfig.primary;

  if (primary === 'cpl') {
    if (metrics.leads != null) result.push({ label: 'Leads', value: String(Math.round(metrics.leads)) });
    if (metrics.cpl != null && metrics.cpl !== 0) result.push({ label: 'CPL', value: `$${Number(metrics.cpl).toFixed(2)}` });
  } else if (primary === 'cpp' || primary === 'roas') {
    if (metrics.purchases != null) result.push({ label: 'Purchases', value: String(Math.round(metrics.purchases)) });
    if (metrics.roas != null && metrics.roas !== 0) result.push({ label: 'ROAS', value: `${Number(metrics.roas).toFixed(1)}x` });
    if (metrics.cpp != null && metrics.cpp !== 0) result.push({ label: 'CPP', value: `$${Number(metrics.cpp).toFixed(2)}` });
  } else if (primary === 'cpc') {
    if (metrics.linkClicks != null || metrics.clicks != null) {
      const clicks = metrics.linkClicks ?? metrics.clicks ?? 0;
      result.push({ label: 'Clicks', value: String(Math.round(clicks)) });
    }
    if (metrics.cpc != null && metrics.cpc !== 0) result.push({ label: 'CPC', value: `$${Number(metrics.cpc).toFixed(2)}` });
  } else if (primary === 'costPerThruPlay') {
    if (metrics.videoThruPlays != null) result.push({ label: 'ThruPlays', value: String(Math.round(metrics.videoThruPlays)) });
    if (metrics.costPerThruPlay != null && metrics.costPerThruPlay !== 0) result.push({ label: 'Cost/ThruPlay', value: `$${Number(metrics.costPerThruPlay).toFixed(3)}` });
  } else if (primary === 'cpm') {
    if (metrics.impressions != null) result.push({ label: 'Impressions', value: Number(metrics.impressions).toLocaleString() });
    if (metrics.cpm != null && metrics.cpm !== 0) result.push({ label: 'CPM', value: `$${Number(metrics.cpm).toFixed(2)}` });
  }

  return result;
}
// ===========================================================================
// APPEND THE FOLLOWING TO THE END OF src/lib/lumi-kpi-config.ts
//
// These are pure additions — no existing exports change. They centralize the
// goal-aware status logic that multiple surfaces need (InsightsHome status
// dot + action-rec pill; CampaignInsightDetail status, budget verdict, and
// What's Not Working line).
// ===========================================================================

// ---------------------------------------------------------------------------
// Goal-aware status helpers
//
// CampaignKPISummary.tsx had local copies of `getMetricValue` and `getGoalStatus`.
// We also need both from InsightsHome.tsx (for the status-badge calculation)
// and from CampaignInsightDetail.tsx (for the budget-verdict + "what's not
// working" logic). Exporting shared versions here instead of duplicating.
// ---------------------------------------------------------------------------

/** Resolve a KPI value from a raw metrics object, computing derived KPIs
 *  (CTR, ROAS, cost-per-thruplay) when the direct field isn't present. */
export function resolveMetricValue(
  metrics: Record<string, number | null | undefined> | null | undefined,
  key: string,
): number | null {
  if (!metrics) return null;
  // Direct match wins.
  if (key in metrics && metrics[key] != null) return metrics[key] as number;

  // Computed ROAS fallback.
  if (key === 'roas') {
    const revenue = (metrics as any).revenue || (metrics as any).purchaseValue || (metrics as any).purchase_roas_value || 0;
    const spend = metrics.spend || 0;
    if (revenue > 0 && spend > 0) return revenue / spend;
    return null;
  }

  // Computed CTR (as a percentage — consistent with the rest of LUMI's display).
  if (key === 'ctr') {
    const impressions = metrics.impressions || 0;
    const clicks = metrics.clicks || (metrics as any).linkClicks || 0;
    return impressions > 0 ? (clicks / impressions) * 100 : null;
  }

  // Computed costPerThruPlay.
  if (key === 'costPerThruPlay' && metrics.spend && (metrics as any).videoThruPlays) {
    const thruplays = (metrics as any).videoThruPlays;
    return thruplays > 0 ? metrics.spend / thruplays : null;
  }

  return null;
}

/** Status vs. a user-set goal threshold. Direction flips for ROAS-like KPIs
 *  where higher is better. Mirrors the logic in CampaignKPISummary.tsx so
 *  every surface that evaluates goals ends up with the same verdict. */
export function getGoalStatus(
  value: number | null | undefined,
  threshold: number,
  goalType: string,
  kpiKey: string,
): 'healthy' | 'attention' | 'critical' | 'no-data' {
  if (value === null || value === undefined || isNaN(value)) return 'no-data';
  // 0 on a cost-per-result KPI means no conversions yet, not "perfect".
  if (value === 0 && ['cpl', 'cpp', 'roas', 'costPerThruPlay'].includes(kpiKey)) return 'no-data';

  const higherIsBetter = goalType === 'greater_than';
  if (higherIsBetter) {
    if (value >= threshold) return 'healthy';
    if (value >= threshold * 0.7) return 'attention';
    return 'critical';
  }
  if (value <= threshold) return 'healthy';
  if (value <= threshold * 1.3) return 'attention';
  return 'critical';
}

/** The one function every surface should call when it needs a status.
 *
 *  Goal-first: if the campaign has a user-set goal (after our silent heal,
 *  that should match the objective-aware kpiConfig), use the goal.
 *  Benchmark-fallback: for campaigns without a goal row, fall back to the
 *  objective's benchmark range.
 *
 *  This is what fixes the "Masterclass CPL is 2x goal but we labeled it
 *  Healthy / suggested Increase spend" bug — previously every surface but
 *  the KPI tile itself was benchmark-only. */
export function getGoalAwareStatus(
  metrics: Record<string, number | null | undefined> | null | undefined,
  kpiConfig: LumiKPIConfig,
  goals?: {
    primary_kpi?: string | null;
    primary_kpi_threshold?: number | null;
    primary_kpi_goal_type?: string | null;
  } | null,
): 'healthy' | 'attention' | 'critical' | 'no-data' {
  if (!metrics) return 'no-data';

  // Goal-first path.
  if (goals?.primary_kpi && goals.primary_kpi_threshold != null) {
    const v = resolveMetricValue(metrics, goals.primary_kpi);
    return getGoalStatus(
      v,
      goals.primary_kpi_threshold,
      goals.primary_kpi_goal_type || 'less_than',
      goals.primary_kpi,
    );
  }

  // Benchmark fallback — behaves exactly like getLumiKPIStatus used to.
  const v = resolveMetricValue(metrics, kpiConfig.primary);
  return getLumiKPIStatus(v, kpiConfig.benchmark, kpiConfig.primary);
}

/** Human-readable "you missed your goal by X" string, for surfaces like the
 *  "What's Not Working" list. Returns null when the goal is being met or
 *  when we don't have enough data to evaluate. */
export function describeGoalMiss(
  metrics: Record<string, number | null | undefined> | null | undefined,
  goals?: {
    primary_kpi?: string | null;
    primary_kpi_label?: string | null;
    primary_kpi_threshold?: number | null;
    primary_kpi_goal_type?: string | null;
  } | null,
): string | null {
  if (!goals?.primary_kpi || goals.primary_kpi_threshold == null) return null;
  const v = resolveMetricValue(metrics || null, goals.primary_kpi);
  if (v === null || v === undefined || isNaN(v)) return null;

  const threshold = goals.primary_kpi_threshold;
  const label = goals.primary_kpi_label || goals.primary_kpi.toUpperCase();
  const goalType = goals.primary_kpi_goal_type || 'less_than';
  const valueStr = formatLumiKPIValue(v, goals.primary_kpi);
  const goalStr = (() => {
    const currencyKPIs = ['cpc', 'cpm', 'cpl', 'cpp', 'costPerThruPlay'];
    if (currencyKPIs.includes(goals.primary_kpi!)) return `$${threshold.toFixed(2)}`;
    if (goals.primary_kpi === 'roas') return `${threshold.toFixed(1)}x`;
    return String(threshold);
  })();

  if (goalType === 'greater_than') {
    if (v >= threshold) return null; // goal met
    const pct = Math.round(((threshold - v) / threshold) * 100);
    return `${label} is ${valueStr} vs your goal of ${goalStr} — ${pct}% under target`;
  }
  // less_than (cost-based KPIs)
  if (v <= threshold) return null; // goal met
  const overMultiplier = v / threshold;
  if (overMultiplier >= 1.5) {
    return `${label} is ${valueStr} vs your goal of ${goalStr} — ${overMultiplier.toFixed(1)}x over target`;
  }
  const pct = Math.round(((v - threshold) / threshold) * 100);
  return `${label} is ${valueStr} vs your goal of ${goalStr} — ${pct}% over target`;
}
