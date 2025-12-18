import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronUp, Layers, TrendingUp, TrendingDown } from 'lucide-react';
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
}

interface AdBreakdownProps {
  workspaceId: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}

export function AdBreakdown({ workspaceId, dateRangeStart, dateRangeEnd }: AdBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<AdMetrics[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">Active</Badge>;
      case 'PAUSED':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-xs">Paused</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  // Identify best and worst performers
  const topPerformer = ads.length > 0 ? ads[0] : null;
  const worstPerformer = ads.length > 1 ? ads[ads.length - 1] : null;

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
              <div className="space-y-3">
                {/* Summary */}
                <div className="flex items-center gap-4 mb-4 text-sm">
                  <span className="text-muted-foreground">{ads.length} ads total</span>
                  {topPerformer && (
                    <div className="flex items-center gap-1 text-green-600">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>Top: {topPerformer.name.substring(0, 20)}...</span>
                    </div>
                  )}
                </div>

                {/* Ad List */}
                <div className="space-y-2">
                  {ads.map((ad, index) => {
                    const isTop = index === 0 && ads.length > 1;
                    const isBottom = index === ads.length - 1 && ads.length > 1;

                    return (
                      <div
                        key={ad.id}
                        className={`p-4 rounded-xl border transition-colors ${
                          isTop ? 'bg-green-50/50 border-green-200' :
                          isBottom ? 'bg-red-50/30 border-red-100' :
                          'bg-muted/30 border-muted'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          {/* Ad Name & Status */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {isTop && <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />}
                              {isBottom && <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />}
                              <p className="font-medium text-sm truncate">{ad.name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(ad.status)}
                              {isTop && <Badge className="bg-green-600 text-xs">Top Performer</Badge>}
                            </div>
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
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
