import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Eye, 
  Sparkles, 
  Calendar,
  Package,
  Loader2,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { 
  getLumiKPIConfig, 
  getLumiKPIStatus,
  getLumiStatusDot,
  getObjectiveMetrics,
} from '@/lib/lumi-kpi-config';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BudgetAdjustmentPanel } from './BudgetAdjustmentPanel';
import { DateRangePicker } from './DateRangePicker';
import { StatusFilter } from './StatusFilter';
import { AccountOverview } from './AccountOverview';
import { LinkOfferModal } from './LinkOfferModal';
import { UnlinkedCampaignsBanner } from './UnlinkedCampaignsBanner';
import { LumiRecommendations } from './LumiRecommendations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CampaignMetrics {
  cpl?: number;
  cpp?: number;
  roas?: number | null;
  cpc?: number;
  cpm?: number;
  spend?: number;
  impressions?: number;
  clicks?: number;
  leads?: number;
  purchases?: number;
  linkClicks?: number;
  videoViews?: number;
  videoThruPlays?: number;
  profileVisits?: number;
  costPerThruPlay?: number;
  [key: string]: number | null | undefined;
}

interface Campaign {
  id: string;
  name: string;
  templateName: string | null;
  objective: string | null;
  metrics: CampaignMetrics | null;
  previousMetrics?: CampaignMetrics | null;
  userGoal?: number | null;
  status?: string;
  offerId?: string | null;
  offerName?: string | null;
  brandId?: string;
  dailyBudget?: number;
  trackingVerified?: boolean;
}

interface AccountMetrics {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  purchases: number;
  roas: number | null;
}

interface InsightsHomeProps {
  campaigns: Campaign[];
  dateRange: string;
  customDateRange?: { from: Date; to: Date } | null;
  onDateRangeChange: (range: string) => void;
  onCustomDateRangeChange?: (range: { from: Date; to: Date } | null) => void;
  onViewInsights: (campaignId: string) => void;
  onUpdateGoal: (campaignId: string, goal: number) => void;
  isLoading: boolean;
  accountMetrics?: AccountMetrics | null;
  accountMetricsLoading?: boolean;
}

function getPrimaryKPIValue(metrics: CampaignMetrics | null, primaryKey: string): number | null {
  if (!metrics) return null;
  if (primaryKey in metrics && metrics[primaryKey] !== undefined) {
    return metrics[primaryKey] as number;
  }
  if (primaryKey === 'costPerThruPlay' && metrics.spend && metrics.videoThruPlays) {
    return metrics.videoThruPlays > 0 ? metrics.spend / metrics.videoThruPlays : null;
  }
  return null;
}

function hasLiveConversions(campaign: Campaign): boolean {
  if (!campaign.metrics) return false;
  const name = (campaign.name || '').toLowerCase();
  const obj = (campaign.objective || '').toLowerCase();
  const isLeadCampaign = obj.includes('lead') || name.includes('lead');
  const isSalesCampaign = obj.includes('sale') || obj.includes('purchase') || name.includes('sale');
  if (isLeadCampaign && (campaign.metrics.leads ?? 0) > 0) return true;
  if (isSalesCampaign && (campaign.metrics.purchases ?? 0) > 0) return true;
  if (!isLeadCampaign && !isSalesCampaign && ((campaign.metrics.leads ?? 0) > 0 || (campaign.metrics.purchases ?? 0) > 0)) return true;
  return false;
}

function getVerdict(status: string): { label: string; colorClass: string } {
  switch (status) {
    case 'healthy': return { label: 'Above benchmark', colorClass: 'text-green-700' };
    case 'attention': return { label: 'Right at benchmark', colorClass: 'text-amber-700' };
    case 'critical': return { label: 'Below benchmark', colorClass: 'text-red-700' };
    default: return { label: 'Gathering data', colorClass: 'text-muted-foreground' };
  }
}

function getActionRecommendation(status: string): string {
  switch (status) {
    case 'healthy': return 'Increase budget';
    case 'attention': return 'Keep spend the same';
    case 'critical': return 'Refresh creative or pause';
    default: return 'Wait for more data';
  }
}

function isBudgetAction(action: string): boolean {
  return action === 'Increase budget' || action === 'Keep spend the same';
}

export function InsightsHome({ 
  campaigns, 
  dateRange, 
  customDateRange,
  onDateRangeChange, 
  onCustomDateRangeChange,
  onViewInsights,
  onUpdateGoal,
  isLoading,
  accountMetrics,
  accountMetricsLoading,
}: InsightsHomeProps) {
  const navigate = useNavigate();
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['active', 'live', 'paused', 'imported']);
  const [togglingCampaign, setTogglingCampaign] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  
  const [linkOfferModal, setLinkOfferModal] = useState<{
    open: boolean;
    campaign: Campaign | null;
  }>({ open: false, campaign: null });

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    campaigns.forEach((c) => {
      const status = c.status || 'live';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    if (selectedStatuses.length === 0) return campaigns;
    return campaigns.filter((c) => {
      const status = c.status || 'live';
      return selectedStatuses.includes(status);
    });
  }, [campaigns, selectedStatuses]);

  const toggleCampaignStatus = async (campaign: Campaign) => {
    const isActive = campaign.status === 'active' || campaign.status === 'live';
    const action = isActive ? 'pause' : 'unpause';
    setTogglingCampaign(campaign.id);
    try {
      const { data, error } = await supabase.functions.invoke('check-campaign-status', {
        body: { workspaceId: campaign.id, action },
      });
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || `Failed to ${action} campaign`);
      }
      toast.success(`Campaign ${action === 'pause' ? 'paused' : 'resumed'}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTogglingCampaign(null);
    }
  };

  const handleOfferLinked = (campaign: Campaign) => {
    navigate(`/creative?workspace=${campaign.id}&addCreative=true`);
  };

  // Fetch recommendations for campaigns with metrics
  const fetchRecommendations = async () => {
    const campaignsWithMetrics = campaigns.filter(c => c.metrics);
    if (campaignsWithMetrics.length === 0) return;
    
    setRecsLoading(true);
    try {
      const allRecs: any[] = [];
      for (const campaign of campaignsWithMetrics.slice(0, 5)) {
        const { data, error } = await supabase.functions.invoke('generate-recommendations', {
          body: {
            workspaceId: campaign.id,
            brandId: campaign.brandId,
            metrics: { ...campaign.metrics, dailyBudget: campaign.dailyBudget },
          },
        });
        if (!error && data?.recommendations) {
          allRecs.push(...data.recommendations.map((r: any) => ({
            ...r,
            campaignName: campaign.name,
            campaignId: campaign.id,
          })));
        }
      }
      setRecommendations(allRecs);
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    } finally {
      setRecsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && campaigns.some(c => c.metrics)) {
      fetchRecommendations();
    }
  }, [isLoading, campaigns.length]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-lumi-orange-1/10 via-lumi-pink-1/10 to-lumi-purple-1/10 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary animate-sparkle-pulse" />
          <span className="text-sm font-medium text-gradient-lumi">Lumi Insights</span>
        </div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          Let's keep this <span className="text-gradient-lumi">simple</span>.
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Here's the clearest signal for each of your campaigns.
        </p>
      </div>

      {/* Account Overview */}
      {(accountMetrics || accountMetricsLoading) && (
        <AccountOverview metrics={accountMetrics || null} isLoading={accountMetricsLoading || false} />
      )}

      {/* Unlinked Campaigns Banner */}
      <UnlinkedCampaignsBanner
        campaigns={campaigns}
        onLinkOffer={(campaign) => setLinkOfferModal({ open: true, campaign })}
      />
      <Card variant="glow" className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Viewing data for:</span>
            </div>
            <DateRangePicker
              dateRange={dateRange}
              customDateRange={customDateRange}
              onDateRangeChange={onDateRangeChange}
              onCustomDateRangeChange={onCustomDateRangeChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Status Filter */}
      {campaigns.length > 0 && (
        <StatusFilter
          selectedStatuses={selectedStatuses}
          onStatusChange={setSelectedStatuses}
          statusCounts={statusCounts}
        />
      )}

      {/* Lumi Recommendations — overview level */}
      {(recommendations.length > 0 || recsLoading) && (
        <LumiRecommendations
          recommendations={recommendations}
          loading={recsLoading}
          onRefresh={fetchRecommendations}
          onRecommendationExecuted={fetchRecommendations}
          compact
          maxItems={4}
        />
      )}

      {/* Campaign Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="rounded-2xl animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded-xl" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <Card variant="gradient" className="rounded-2xl border-dashed border-2">
          <CardContent className="p-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary/30 animate-sparkle-pulse" />
            <h3 className="text-lg font-medium mb-2 text-gradient-lumi">
              {campaigns.length === 0 ? 'No campaigns yet' : 'No campaigns match filter'}
            </h3>
            <p className="text-muted-foreground">
              {campaigns.length === 0 
                ? 'Build and publish a campaign to see your insights here.'
                : 'Try adjusting the status filter to see more campaigns.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCampaigns.map(campaign => {
            const kpiConfig = getLumiKPIConfig(campaign.objective, campaign.templateName, campaign.name);
            const primaryValue = getPrimaryKPIValue(campaign.metrics, kpiConfig.primary);
            const status = getLumiKPIStatus(primaryValue, kpiConfig.benchmark, kpiConfig.primary);
            const statusDot = getLumiStatusDot(status);
            const verdict = getVerdict(status);
            const actionRec = getActionRecommendation(status);
            const isActive = campaign.status === 'active' || campaign.status === 'live';
            const isToggling = togglingCampaign === campaign.id;
            const objMetrics = getObjectiveMetrics(campaign.metrics, kpiConfig);

            return (
              <Card 
                key={campaign.id} 
                variant="glow"
                className="rounded-2xl transition-all duration-300 hover:scale-[1.005]"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3">
                    {/* Row 1: Name + status dot + Live/Paused label + toggle */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot}`} />
                        <h3 className="font-display font-semibold text-sm sm:text-base truncate">{campaign.name}</h3>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-medium ${isActive ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {isActive ? 'Live' : 'Paused'}
                        </span>
                        {isToggling ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => toggleCampaignStatus(campaign)}
                            aria-label={`Toggle ${campaign.name}`}
                          />
                        )}
                      </div>
                    </div>

                    {/* Row 2: Budget + Spend + Objective KPIs */}
                    <div className="flex flex-wrap items-center gap-2 pl-5">
                      {campaign.dailyBudget != null && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          <DollarSign className="h-3 w-3" />
                          ${campaign.dailyBudget}/day
                        </span>
                      )}
                      {campaign.metrics?.spend != null && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          ${Number(campaign.metrics.spend).toFixed(2)} spent
                        </span>
                      )}
                      {objMetrics.map((m, i) => (
                        <span key={i} className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {m.value} {m.label}
                        </span>
                      ))}
                    </div>

                    {/* Row 3: Verdict + Action */}
                    <div className="flex items-center justify-between gap-2 pl-5">
                      <span className={`text-sm font-medium ${verdict.colorClass}`}>
                        {verdict.label}
                      </span>
                      {isBudgetAction(actionRec) ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Badge 
                              variant="outline" 
                              className="text-xs rounded-full cursor-pointer hover:bg-primary/10 transition-colors"
                            >
                              {actionRec}
                            </Badge>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-0" align="end">
                            <BudgetAdjustmentPanel
                              workspaceId={campaign.id}
                              workspaceName={campaign.name}
                              currentBudget={campaign.dailyBudget || 25}
                              metrics={{
                                roas: campaign.metrics?.roas,
                                cpl: campaign.metrics?.cpl,
                                cpp: campaign.metrics?.cpp,
                                ctr: campaign.metrics?.cpc ? undefined : undefined,
                                frequency: undefined,
                                spend: campaign.metrics?.spend,
                              }}
                              inline
                            />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Badge 
                          variant="outline" 
                          className="text-xs rounded-full cursor-pointer hover:bg-primary/10 transition-colors"
                          onClick={() => onViewInsights(campaign.id)}
                        >
                          {actionRec}
                        </Badge>
                      )}
                    </div>

                    {/* Row 4: View button */}
                    <div className="flex items-center gap-2 pt-1 pl-5">
                      <Button
                        onClick={() => onViewInsights(campaign.id)}
                        variant="lumi"
                        size="sm"
                        className="rounded-xl text-xs"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View Details
                      </Button>
                      {!campaign.offerId && (
                        <Button
                          onClick={() => setLinkOfferModal({ open: true, campaign })}
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-xs"
                        >
                          <Package className="h-3.5 w-3.5 mr-1" />
                          Link Offer
                        </Button>
                      )}
                      {campaign.trackingVerified === false && !hasLiveConversions(campaign) && (
                        <Badge variant="outline" className="text-xs rounded-full text-amber-600 border-amber-500/30 gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Tracking not verified
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {campaigns.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          <span className="text-gradient-lumi font-medium">✨ Lumi's got you</span> — focus on the green signals, and we'll alert you when something needs attention.
        </p>
      )}
      
      {linkOfferModal.campaign && (
        <LinkOfferModal
          open={linkOfferModal.open}
          onOpenChange={(open) => setLinkOfferModal({ open, campaign: open ? linkOfferModal.campaign : null })}
          workspaceId={linkOfferModal.campaign.id}
          workspaceName={linkOfferModal.campaign.name}
          brandId={linkOfferModal.campaign.brandId || ''}
          onSuccess={() => handleOfferLinked(linkOfferModal.campaign!)}
        />
      )}
    </div>
  );
}
