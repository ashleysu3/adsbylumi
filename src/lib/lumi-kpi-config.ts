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
  
  // Webinar campaigns → CPL
  'webinar': {
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
  'Sales': {
    primary: 'roas',
    primaryLabel: 'Return on Ad Spend',
    benchmark: { min: 2.0, max: 5.0, unit: 'x' },
    friendlyName: 'Sales',
  },
  
  // Discovery Call → CPL
  'discovery-call': {
    primary: 'cpl',
    primaryLabel: 'Cost Per Booked Call',
    benchmark: { min: 20, max: 100, unit: '$' },
    friendlyName: 'Discovery Call',
  },
  
  // IG Traffic → Cost per Profile Visit
  'ig-traffic': {
    primary: 'profile_visit_cost',
    primaryLabel: 'Cost Per Profile Visit',
    benchmark: { min: 0.10, max: 0.50, unit: '$' },
    friendlyName: 'Instagram Traffic',
  },
  'Traffic': {
    primary: 'cpc',
    primaryLabel: 'Cost Per Click',
    benchmark: { min: 0.15, max: 0.50, unit: '$' },
    friendlyName: 'Traffic',
  },
  
  // Video Views → Cost per ThruPlay
  'video-views': {
    primary: 'cost_per_thruplay',
    primaryLabel: 'Cost Per ThruPlay',
    benchmark: { min: 0.02, max: 0.08, unit: '$' },
    friendlyName: 'Video Views',
  },
  'Engagement': {
    primary: 'cpm',
    primaryLabel: 'Cost Per 1000 Views',
    benchmark: { min: 3, max: 10, unit: '$' },
    friendlyName: 'Engagement',
  },
};

// Default config for unknown campaign types
export const defaultLumiKPIConfig: LumiKPIConfig = {
  primary: 'cpl',
  primaryLabel: 'Cost Per Lead',
  benchmark: { min: 10, max: 50, unit: '$' },
  friendlyName: 'Campaign',
};

export function getLumiKPIConfig(campaignType: string | null | undefined): LumiKPIConfig {
  if (!campaignType) return defaultLumiKPIConfig;
  return lumiKPIConfig[campaignType] || defaultLumiKPIConfig;
}

export function formatLumiKPIValue(value: number | null | undefined, kpiKey: string): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  
  const currencyKPIs = ['cpc', 'cpm', 'cpl', 'cpp', 'profile_visit_cost', 'cost_per_thruplay'];
  const multiplierKPIs = ['roas'];
  
  if (currencyKPIs.includes(kpiKey)) {
    return `$${value.toFixed(2)}`;
  }
  if (multiplierKPIs.includes(kpiKey)) {
    return `${value.toFixed(2)}x`;
  }
  return value.toFixed(2);
}

export function getLumiKPIStatus(
  value: number | null | undefined, 
  benchmark: { min: number; max: number; unit: string },
  kpiKey: string
): 'healthy' | 'attention' | 'critical' {
  if (value === null || value === undefined || isNaN(value)) return 'attention';
  
  // For ROAS, higher is better
  if (kpiKey === 'roas') {
    if (value >= benchmark.min) return 'healthy';
    if (value >= benchmark.min * 0.7) return 'attention';
    return 'critical';
  }
  
  // For costs, lower is better
  if (value <= benchmark.min) return 'healthy';
  if (value <= benchmark.max) return 'attention';
  return 'critical';
}

export function getLumiStatusColor(status: 'healthy' | 'attention' | 'critical'): string {
  switch (status) {
    case 'healthy': return 'bg-green-100 text-green-800 border-green-200';
    case 'attention': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
  }
}

export function getLumiStatusDot(status: 'healthy' | 'attention' | 'critical'): string {
  switch (status) {
    case 'healthy': return 'bg-green-500';
    case 'attention': return 'bg-amber-500';
    case 'critical': return 'bg-red-500';
  }
}
