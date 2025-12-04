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
  'Discovery Call / Application': {
    primary: 'cpl',
    primaryLabel: 'Cost Per Lead',
    benchmark: { min: 20, max: 100, unit: '$' },
    friendlyName: 'Discovery Call',
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
  
  // Discovery Call → CPL
  'discovery-call': {
    primary: 'cpl',
    primaryLabel: 'Cost Per Booked Call',
    benchmark: { min: 20, max: 100, unit: '$' },
    friendlyName: 'Discovery Call',
  },
  
  // IG Traffic → Cost per Click
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
  
  // Video Views → Cost per ThruPlay
  'video-views': {
    primary: 'costPerThruPlay',
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
  
  if (nameLower.includes('traffic')) return 'Traffic';
  if (nameLower.includes('lead') || nameLower.includes('leads')) return 'Leads';
  if (nameLower.includes('discovery') || nameLower.includes('application') || nameLower.includes('call')) return 'Leads';
  if (nameLower.includes('webinar')) return 'webinar';
  if (nameLower.includes('sales') || nameLower.includes('purchase') || nameLower.includes('product')) return 'Sales';
  if (nameLower.includes('video') || nameLower.includes('views')) return 'video-views';
  if (nameLower.includes('engagement')) return 'Engagement';
  
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
  
  // For costs, lower is better
  if (value <= benchmark.min) return 'healthy';
  if (value <= benchmark.max) return 'attention';
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
