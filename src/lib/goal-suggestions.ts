// Shared KPI options + goal suggestion logic.
// Used by both GoalSetupModal (insights) and PostLaunchWalkthrough.

export const KPI_OPTIONS = [
  { value: 'cplpv', label: 'Cost per Landing Page View (CPLPV)', goalType: 'less_than' as const },
  { value: 'cpc', label: 'Cost per Click (CPC)', goalType: 'less_than' as const },
  { value: 'cpl', label: 'Cost per Lead (CPL)', goalType: 'less_than' as const },
  { value: 'cppv', label: 'Cost per Profile Visit (CPPV)', goalType: 'less_than' as const },
  { value: 'cp2sc', label: 'Cost per 2-Sec View (CP2SC)', goalType: 'less_than' as const },
  { value: 'roas', label: 'Return on Ad Spend (ROAS)', goalType: 'greater_than' as const },
  { value: 'ctr', label: 'Click-Through Rate (CTR)', goalType: 'greater_than' as const },
  { value: 'cpm', label: 'Cost per 1,000 Impressions (CPM)', goalType: 'less_than' as const },
  { value: 'purchases', label: 'Purchases (weekly count)', goalType: 'greater_than' as const },
];

export type GoalType = 'less_than' | 'greater_than';

export interface GoalSuggestion {
  primary: { kpi: string; threshold: number; label: string; goalType: GoalType };
  secondary: { kpi: string; threshold: number; label: string; goalType: GoalType } | null;
  note: string;
}

export function suggestGoals(offerPrice: string | null, templateSlug: string | null): GoalSuggestion {
  const price = parseFloat((offerPrice || '0').replace(/[^0-9.]/g, ''));
  const slug = templateSlug || '';

  if (slug.includes('video-views')) return {
    primary: { kpi: 'cp2sc', threshold: 0.01, label: 'Cost per 2-Sec View', goalType: 'less_than' },
    secondary: null,
    note: 'Video view campaigns are about reach and warm-up. Keep cost per view low.'
  };
  if (slug.includes('webinar') || slug.includes('challenge')) return {
    primary: { kpi: 'cpl', threshold: 18, label: 'Cost per Lead', goalType: 'less_than' },
    secondary: null,
    note: 'Multi-day challenges and webinars have a higher ask — CPL naturally runs higher.'
  };
  if (slug.includes('discovery') || slug.includes('booking')) return {
    primary: { kpi: 'cpl', threshold: 50, label: 'Cost per Lead', goalType: 'less_than' },
    secondary: null,
    note: 'Discovery call campaigns vary. Set CPL at roughly 10–20% of your offer value.'
  };
  if (slug.includes('lead') && price === 0) return {
    primary: { kpi: 'cpl', threshold: 5, label: 'Cost per Lead', goalType: 'less_than' },
    secondary: null,
    note: 'Free lead magnets typically convert well. If CPL climbs above $8, investigate your creative.'
  };
  if (price > 0 && price <= 50) return {
    primary: { kpi: 'cpl', threshold: Math.round(price * 0.3), label: 'Cost per Lead', goalType: 'less_than' },
    secondary: { kpi: 'roas', threshold: 1.5, label: 'ROAS', goalType: 'greater_than' },
    note: `For a $${price} offer, aim for CPL under $${Math.round(price * 0.3)} and ROAS above 1.5x.`
  };
  if (price > 50 && price <= 500) return {
    primary: { kpi: 'cpl', threshold: Math.round(price * 0.15), label: 'Cost per Lead', goalType: 'less_than' },
    secondary: { kpi: 'roas', threshold: 2, label: 'ROAS', goalType: 'greater_than' },
    note: `For a $${price} offer, CPL under $${Math.round(price * 0.15)} keeps acquisition cost healthy.`
  };
  if (price > 500) return {
    primary: { kpi: 'cpl', threshold: Math.round(price * 0.10), label: 'Cost per Lead', goalType: 'less_than' },
    secondary: { kpi: 'roas', threshold: 2, label: 'ROAS', goalType: 'greater_than' },
    note: `High-ticket offers can sustain higher CPL. Up to $${Math.round(price * 0.10)} per lead can still be profitable.`
  };
  return {
    primary: { kpi: 'cpl', threshold: 20, label: 'Cost per Lead', goalType: 'less_than' },
    secondary: null,
    note: 'Starting point suggestion — adjust based on your actual margins and conversion rates.'
  };
}

export function getThresholdPrefix(kpi: string): string {
  if (kpi === 'roas') return '';
  if (kpi === 'ctr') return '';
  if (kpi === 'purchases') return '';
  return '$';
}

export function getThresholdSuffix(kpi: string): string {
  if (kpi === 'roas') return 'x';
  if (kpi === 'ctr') return '%';
  return '';
}
