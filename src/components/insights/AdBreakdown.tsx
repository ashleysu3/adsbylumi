import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronUp, Layers, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AdMetrics {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  purchases: number;
  cpl: number;
  cpp: number;
  roas: number | null;
  reach?: number;
  created_time?: string;
  linkClicks?: number;
}

interface AdBreakdownProps {
  workspaceId: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  objective?: string | null;
  primaryKPI?: string;
}

interface MetricColumn {
  key: string;
  label: string;
  format: (ad: AdMetrics) => string;
}

function getMetricColumns(objective: string | null | undefined, primaryKPI?: string): MetricColumn[] {
  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
  const num = (v: number) => v.toLocaleString();

  const obj = (objective || '').toLowerCase();

  // Lead gen campaigns
  if (obj.includes('lead') || primaryKPI === 'cpl') {
    return [
      { key: 'spend', label: 'Spend', format: (ad) => fmt(ad.spend) },
      { key: 'leads', label: 'Leads', format: (ad) => num(ad.leads) },
      { key: 'cpl', label: 'CPL', format: (ad) => ad.leads > 0 ? fmt(ad.cpl) : '—' },
      { key: 'ctr', label: 'CTR', format: (ad) => `${ad.ctr.toFixed(2)}%` },
    ];
  }

  // Sales campaigns
  if (obj.includes('sale') || obj.includes('purchase') || obj.includes('conversion') || primaryKPI === 'roas' || primaryKPI === 'cpp') {
    return [
      { key: 'spend', label: 'Spend', format: (ad) => fmt(ad.spend) },
      { key: 'purchases', label: 'Purchases', format: (ad) => num(ad.purchases) },
      { key: 'roas', label: 'ROAS', format: (ad) => ad.roas != null ? `${ad.roas.toFixed(2)}x` : '—' },
      { key: 'cpc', label: 'CPC', format: (ad) => fmt(ad.cpc) },
    ];
  }

  // Traffic campaigns
  if (obj.includes('traffic') || obj.includes('link_click') || primaryKPI === 'cpc') {
    return [
      { key: 'spend', label: 'Spend', format: (ad) => fmt(ad.spend) },
      { key: 'clicks', label: 'Clicks', format: (ad) => num(ad.linkClicks || ad.clicks) },
      { key: 'cpc', label: 'CPC', format: (ad) => fmt(ad.cpc) },
      { key: 'ctr', label: 'CTR', format: (ad) => `${ad.ctr.toFixed(2)}%` },
    ];
  }

  // Default
  return [
    { key: 'spend', label: 'Spend', format: (ad) => fmt(ad.spend) },
    { key: 'clicks', label: 'Clicks', format: (ad) => num(ad.clicks) },
    { key: 'ctr', label: 'CTR', format: (ad) => `${ad.ctr.toFixed(2)}%` },
    { key: 'cpc', label: 'CPC', format: (ad) => fmt(ad.cpc) },
  ];
}

function getAdRecommendation(ad: AdMetrics, primaryKPI?: string): { label: string; color: string; action: string } | null {
  const reach = ad.reach || ad.impressions || 0;
  const age = ad.created_time 
    ? Math.floor((Date.now() - new Date(ad.created_time).getTime()) / (1000 * 60 * 60 * 24))
    : 7;

  if (reach < 1000 || age < 3) {
    return { label: 'Still learning', color: 'bg-muted text-muted-foreground', action: '' };
  }

  // Check primary KPI first
  if (primaryKPI === 'cpl' || primaryKPI === 'cpp') {
    const costPerResult = primaryKPI === 'cpl' ? ad.cpl : ad.cpp;
    if (ad.leads === 0 && ad.purchases === 0 && ad.spend > 20) {
      return { label: 'Consider pausing', color: 'bg-red-50 text-red-700 border-red-200', action: 'No results yet — creative may need a refresh' };
    }
    if (costPerResult > 0 && ad.ctr >= 1.0) {
      return { label: 'Keep running', color: 'bg-green-50 text-green-700 border-green-200', action: 'Generating results' };
    }
  }

  if (primaryKPI === 'roas') {
    if (ad.roas && ad.roas >= 3) {
      return { label: 'Consider scaling', color: 'bg-green-50 text-green-700 border-green-200', action: 'Strong return — increase budget' };
    }
    if (ad.roas != null && ad.roas < 1 && ad.spend > 20) {
      return { label: 'Consider pausing', color: 'bg-red-50 text-red-700 border-red-200', action: 'Spending more than earning' };
    }
  }

  // Fallback to CTR check
  if (ad.ctr < 0.8) {
    return { label: 'Consider pausing', color: 'bg-red-50 text-red-700 border-red-200', action: 'Low engagement — creative may need a refresh' };
  }

  if (ad.ctr >= 1.5) {
    return { label: 'Consider scaling', color: 'bg-green-50 text-green-700 border-green-200', action: 'Strong performance — increase budget' };
  }

  return { label: 'Keep running', color: 'bg-green-50 text-green-700 border-green-200', action: 'On track' };
}

export function AdBreakdown({ workspaceId, dateRangeStart, dateRangeEnd, objective, primaryKPI }: AdBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<AdMetrics[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [togglingAd, setTogglingAd] = useState<string | null>(null);

  const metricColumns = getMetricColumns(objective, primaryKPI);

  useEffect(() => {
    if (isOpen && !hasFetched) {
      fetchAdBreakdown();
    }
  }, [isOpen, workspaceId, dateRangeStart, dateRangeEnd]);

  const fetchAdBreakdown = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('fetch-ad-breakdown', {
        body: { workspaceId, dateRangeStart, dateRangeEnd },
      });
      if (fetchError || !data?.success) {
        throw new Error(data?.error || fetchError?.message || 'Failed to fetch ad breakdown');
      }
      setAds(data.ads || []);
      setHasFetched(true);
    } catch (err: any) {
      console.error('Error fetching ad breakdown:', err);
      setError(err.message);
      if (err.message.includes('Meta access token')) {
        toast.error('Please reconnect your Meta account');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleAdStatus = async (ad: AdMetrics) => {
    const newAction = ad.status === 'ACTIVE' ? 'pause' : 'unpause';
    setTogglingAd(ad.id);
    try {
      const { data, error } = await supabase.functions.invoke('check-campaign-status', {
        body: { workspaceId, action: newAction, entityId: ad.id, entityType: 'ad' },
      });
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || `Failed to ${newAction} ad`);
      }
      setAds(prev => prev.map(a => 
        a.id === ad.id ? { ...a, status: data.newStatus } : a
      ));
      toast.success(`Ad ${newAction === 'pause' ? 'paused' : 'resumed'}`);
    } catch (err: any) {
      console.error('Error toggling ad:', err);
      toast.error(err.message);
    } finally {
      setTogglingAd(null);
    }
  };

  return (
    <Card className="rounded-2xl border-muted">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-2xl">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-5 w-5 text-primary" />
                Ad-Level Performance
              </CardTitle>
              <Button variant="ghost" size="sm" className="gap-1">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {isOpen ? 'Hide' : 'Show'} Ads
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-6">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchAdBreakdown} className="mt-3">
                  Try Again
                </Button>
              </div>
            ) : ads.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No ad-level data available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ads.map((ad, index) => {
                  const recommendation = getAdRecommendation(ad, primaryKPI);
                  const isTop = index === 0 && ads.length > 1;
                  const isBottom = index === ads.length - 1 && ads.length > 1;
                  const isToggling = togglingAd === ad.id;

                  return (
                    <div
                      key={ad.id}
                      className={`p-4 rounded-xl border transition-colors ${
                        isTop ? 'bg-green-50/50 border-green-200' :
                        isBottom ? 'bg-red-50/30 border-red-100' :
                        'bg-muted/30 border-muted'
                      }`}
                    >
                      <div className="flex flex-col gap-3">
                        {/* Ad Name, Status, Toggle */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {isTop && <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />}
                            {isBottom && <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />}
                            <p className="font-medium text-sm truncate">{ad.name}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isToggling ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <Switch
                                checked={ad.status === 'ACTIVE'}
                                onCheckedChange={() => toggleAdStatus(ad)}
                                aria-label={`Toggle ${ad.name}`}
                              />
                            )}
                          </div>
                        </div>

                        {/* Recommendation Badge */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {isTop && <Badge className="bg-green-600 text-xs">Top Performer</Badge>}
                          {recommendation && (
                            <Badge variant="outline" className={`text-xs ${recommendation.color}`}>
                              {recommendation.label}
                            </Badge>
                          )}
                          {recommendation?.action && (
                            <span className="text-xs text-muted-foreground">{recommendation.action}</span>
                          )}
                        </div>

                        {/* Dynamic Metrics Grid */}
                        <div className="grid grid-cols-4 gap-4 text-center">
                          {metricColumns.map((col) => (
                            <div key={col.key}>
                              <p className="text-xs text-muted-foreground">{col.label}</p>
                              <p className="font-semibold text-sm">{col.format(ad)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
