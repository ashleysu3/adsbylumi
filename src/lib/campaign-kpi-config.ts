// Campaign KPI Configuration by Objective
// Maps campaign objectives to their priority KPIs

export interface KPIConfig {
  primary: string;
  primaryLabel: string;
  secondary: string[];
  irrelevant: string[];
  benchmarks: {
    [key: string]: { min: number; max: number; unit: string };
  };
}

export const campaignKPIConfig: Record<string, KPIConfig> = {
  // Traffic campaigns - goal is clicks and visits
  'Traffic': {
    primary: 'cpc',
    primaryLabel: 'Cost Per Click',
    secondary: ['ctr', 'cpm', 'linkClicks'],
    irrelevant: ['cpl_cpp', 'roas'],
    benchmarks: {
      cpc: { min: 0.15, max: 0.50, unit: '$' },
      ctr: { min: 1.5, max: 4.0, unit: '%' },
      cpm: { min: 5, max: 15, unit: '$' },
    },
  },
  
  // Lead generation campaigns - goal is lead acquisition
  'Leads': {
    primary: 'cpl_cpp',
    primaryLabel: 'Cost Per Lead',
    secondary: ['ctr', 'cpc'],
    irrelevant: ['roas'],
    benchmarks: {
      cpl_cpp: { min: 5, max: 50, unit: '$' },
      ctr: { min: 1.0, max: 3.0, unit: '%' },
      cpc: { min: 0.50, max: 2.00, unit: '$' },
    },
  },
  
  // Sales campaigns - goal is purchases and ROAS
  'Sales': {
    primary: 'roas',
    primaryLabel: 'Return on Ad Spend',
    secondary: ['cpl_cpp', 'ctr', 'cpc'],
    irrelevant: [],
    benchmarks: {
      roas: { min: 2.0, max: 5.0, unit: 'x' },
      cpl_cpp: { min: 10, max: 100, unit: '$' },
      ctr: { min: 1.0, max: 3.0, unit: '%' },
    },
  },
  
  // Engagement campaigns - goal is video views and interactions
  'Engagement': {
    primary: 'cpm',
    primaryLabel: 'Cost Per 1000 Impressions',
    secondary: ['ctr', 'frequency', 'videoViews'],
    irrelevant: ['cpl_cpp', 'roas'],
    benchmarks: {
      cpm: { min: 3, max: 10, unit: '$' },
      ctr: { min: 2.0, max: 5.0, unit: '%' },
      frequency: { min: 1.0, max: 3.0, unit: '' },
    },
  },
};

// Default config for unknown campaign types
export const defaultKPIConfig: KPIConfig = {
  primary: 'ctr',
  primaryLabel: 'Click-Through Rate',
  secondary: ['cpc', 'cpm', 'frequency'],
  irrelevant: [],
  benchmarks: {
    ctr: { min: 1.0, max: 3.0, unit: '%' },
    cpc: { min: 0.30, max: 1.00, unit: '$' },
    cpm: { min: 5, max: 15, unit: '$' },
  },
};

export function getKPIConfigForObjective(objective: string | null | undefined): KPIConfig {
  if (!objective) return defaultKPIConfig;
  return campaignKPIConfig[objective] || defaultKPIConfig;
}

export function getKPIPriority(objective: string | null | undefined, kpiKey: string): 'primary' | 'secondary' | 'irrelevant' | 'other' {
  const config = getKPIConfigForObjective(objective);
  
  if (config.primary === kpiKey) return 'primary';
  if (config.secondary.includes(kpiKey)) return 'secondary';
  if (config.irrelevant.includes(kpiKey)) return 'irrelevant';
  return 'other';
}

export function formatKPIValue(value: number | null | undefined, kpiKey: string): string {
  if (value === null || value === undefined) return 'N/A';
  
  const currencyKPIs = ['cpc', 'cpm', 'cpl_cpp'];
  const percentKPIs = ['ctr'];
  const multiplierKPIs = ['roas'];
  
  if (currencyKPIs.includes(kpiKey)) {
    return `$${value.toFixed(2)}`;
  }
  if (percentKPIs.includes(kpiKey)) {
    return `${value.toFixed(2)}%`;
  }
  if (multiplierKPIs.includes(kpiKey)) {
    return `${value.toFixed(2)}x`;
  }
  return value.toFixed(2);
}

export function getGoalDescription(objective: string | null | undefined): string {
  const descriptions: Record<string, string> = {
    'Traffic': 'Drive visitors to your content at the lowest cost per click',
    'Leads': 'Generate leads and signups at the lowest cost per lead',
    'Sales': 'Maximize purchases and return on ad spend',
    'Engagement': 'Increase video views and engagement at scale',
  };
  return descriptions[objective || ''] || 'Optimize campaign performance';
}

export function getKPILabel(kpiKey: string): string {
  const labels: Record<string, string> = {
    ctr: 'Click Rate',
    cpc: 'Cost Per Click',
    cpm: 'Cost Per 1,000 Views',
    frequency: 'Times Shown Per Person',
    cpl_cpp: 'Cost Per Result',
    roas: 'Return on Spend',
    linkClicks: 'Link Clicks',
    videoViews: 'Video Views',
  };
  return labels[kpiKey] || kpiKey.toUpperCase();
}
