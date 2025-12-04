// Lumi Primary KPI Configuration by Campaign Type
// Each campaign type has ONE primary KPI that Lumi focuses on

export interface LumiKPIConfig {
  primaryKPI: string;
  primaryKPILabel: string;
  benchmark: { min: number; max: number; unit: string };
  friendlyDescription: string;
}

// Map campaign templates to their primary KPI
export const lumiKPIByType: Record<string, LumiKPIConfig> = {
  // Lead Gen campaigns
  'Lead Gen': {
    primaryKPI: 'cpl',
    primaryKPILabel: 'Cost Per Lead',
    benchmark: { min: 5, max: 50, unit: '$' },
    friendlyDescription: 'How much you pay for each new lead',
  },
  'Leads': {
    primaryKPI: 'cpl',
    primaryKPILabel: 'Cost Per Lead',
    benchmark: { min: 5, max: 50, unit: '$' },
    friendlyDescription: 'How much you pay for each new lead',
  },
  
  // Webinar campaigns
  'Webinar': {
    primaryKPI: 'cpl',
    primaryKPILabel: 'Cost Per Registration',
    benchmark: { min: 3, max: 25, unit: '$' },
    friendlyDescription: 'How much you pay for each webinar signup',
  },
  'Webinar Registration': {
    primaryKPI: 'cpl',
    primaryKPILabel: 'Cost Per Registration',
    benchmark: { min: 3, max: 25, unit: '$' },
    friendlyDescription: 'How much you pay for each webinar signup',
  },
  
  // Low Ticket / Sales campaigns
  'Low Ticket': {
    primaryKPI: 'roas',
    primaryKPILabel: 'Return on Ad Spend',
    benchmark: { min: 2.0, max: 5.0, unit: 'x' },
    friendlyDescription: 'How much revenue you get back for every dollar spent',
  },
  'Sales': {
    primaryKPI: 'roas',
    primaryKPILabel: 'Return on Ad Spend',
    benchmark: { min: 2.0, max: 5.0, unit: 'x' },
    friendlyDescription: 'How much revenue you get back for every dollar spent',
  },
  'Product Sale': {
    primaryKPI: 'cpp',
    primaryKPILabel: 'Cost Per Purchase',
    benchmark: { min: 10, max: 100, unit: '$' },
    friendlyDescription: 'How much you pay for each sale',
  },
  
  // Discovery Call campaigns
  'Discovery Call': {
    primaryKPI: 'cpl',
    primaryKPILabel: 'Cost Per Booking',
    benchmark: { min: 20, max: 150, unit: '$' },
    friendlyDescription: 'How much you pay for each call booking',
  },
  'Call Booking': {
    primaryKPI: 'cpl',
    primaryKPILabel: 'Cost Per Booking',
    benchmark: { min: 20, max: 150, unit: '$' },
    friendlyDescription: 'How much you pay for each call booking',
  },
  
  // IG Traffic campaigns
  'IG Traffic': {
    primaryKPI: 'cpc',
    primaryKPILabel: 'Cost Per Profile Visit',
    benchmark: { min: 0.10, max: 0.50, unit: '$' },
    friendlyDescription: 'How much you pay for each profile visit',
  },
  'Traffic': {
    primaryKPI: 'cpc',
    primaryKPILabel: 'Cost Per Click',
    benchmark: { min: 0.15, max: 0.50, unit: '$' },
    friendlyDescription: 'How much you pay for each click',
  },
  
  // Video Views campaigns
  'Video Views': {
    primaryKPI: 'cpv',
    primaryKPILabel: 'Cost Per ThruPlay',
    benchmark: { min: 0.01, max: 0.10, unit: '$' },
    friendlyDescription: 'How much you pay for each video view',
  },
  'Engagement': {
    primaryKPI: 'cpm',
    primaryKPILabel: 'Cost Per 1000 Impressions',
    benchmark: { min: 3, max: 10, unit: '$' },
    friendlyDescription: 'How much you pay to reach 1000 people',
  },
};

// Default config for unknown campaign types
export const defaultLumiKPI: LumiKPIConfig = {
  primaryKPI: 'cpc',
  primaryKPILabel: 'Cost Per Click',
  benchmark: { min: 0.30, max: 1.00, unit: '$' },
  friendlyDescription: 'How much you pay for each click',
};

export function getLumiKPIConfig(campaignType: string | null | undefined): LumiKPIConfig {
  if (!campaignType) return defaultLumiKPI;
  return lumiKPIByType[campaignType] || defaultLumiKPI;
}

// Get status based on value vs benchmark
export function getLumiStatus(value: number, benchmark: { min: number; max: number }, isLowerBetter = true): 'healthy' | 'attention' | 'critical' {
  if (isLowerBetter) {
    if (value <= benchmark.min) return 'healthy';
    if (value <= benchmark.max) return 'attention';
    return 'critical';
  } else {
    // For ROAS, higher is better
    if (value >= benchmark.max) return 'healthy';
    if (value >= benchmark.min) return 'attention';
    return 'critical';
  }
}

// Format KPI value for display
export function formatLumiKPIValue(value: number | null | undefined, kpiKey: string): string {
  if (value === null || value === undefined) return '—';
  
  const currencyKPIs = ['cpc', 'cpm', 'cpl', 'cpp', 'cpv'];
  const multiplierKPIs = ['roas'];
  const percentKPIs = ['ctr'];
  
  if (currencyKPIs.includes(kpiKey)) {
    return `$${value.toFixed(2)}`;
  }
  if (multiplierKPIs.includes(kpiKey)) {
    return `${value.toFixed(2)}x`;
  }
  if (percentKPIs.includes(kpiKey)) {
    return `${value.toFixed(2)}%`;
  }
  return value.toFixed(2);
}

// Get benchmark display string
export function formatBenchmark(benchmark: { min: number; max: number; unit: string }): string {
  if (benchmark.unit === 'x') {
    return `${benchmark.min}x - ${benchmark.max}x`;
  }
  return `${benchmark.unit}${benchmark.min} - ${benchmark.unit}${benchmark.max}`;
}
