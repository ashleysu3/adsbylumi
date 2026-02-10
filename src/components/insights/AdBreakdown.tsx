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
}

interface AdBreakdownProps {
  workspaceId: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}

function getAdRecommendation(ad: AdMetrics): { label: string; color: string; action: string } | null {
  const reach = ad.reach || ad.impressions || 0;
  const age = ad.created_time 
    ? Math.floor((Date.now() - new Date(ad.created_time).getTime()) / (1000 * 60 * 60 * 24))
    : 7; // assume 7 days if unknown

  if (reach < 1000 || age < 3) {
    return { label: 'Still learning', color: 'bg-muted text-muted-foreground', action: '' };
  }

  if (ad.ctr < 0.8) {
    return { label: 'Consider pausing', color: 'bg-red-50 text-red-700 border-red-200', action: 'Low engagement — creative may need a refresh' };
  }

  if (ad.ctr >= 1.5 || (ad.roas && ad.roas >= 3)) {
    return { label: 'Consider scaling', color: 'bg-green-50 text-green-700 border-green-200', action: 'Strong performance — increase budget' };
  }

  return { label: 'Keep running', color: 'bg-green-50 text-green-700 border-green-200', action: 'On track' };
}

export function AdBreakdown({ workspaceId, dateRangeStart, dateRangeEnd }: AdBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<AdMetrics[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [togglingAd, setTogglingAd] = useState<string | null>(null);

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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);

  const formatNumber = (value: number) => value.toLocaleString();

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
                  const recommendation = getAdRecommendation(ad);
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

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground">Spend</p>
                            <p className="font-semibold text-sm">{formatCurrency(ad.spend)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Clicks</p>
                            <p className="font-semibold text-sm">{formatNumber(ad.clicks)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">CTR</p>
                            <p className="font-semibold text-sm">{ad.ctr.toFixed(2)}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">CPC</p>
                            <p className="font-semibold text-sm">{formatCurrency(ad.cpc)}</p>
                          </div>
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
