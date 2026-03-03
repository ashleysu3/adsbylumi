import { useState, useMemo, useEffect } from 'react';
import { useBrand } from '@/contexts/BrandContext';
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
  RefreshCw,
  Plus,
  Wand2,
  ArrowRight,
  FileText } from
'lucide-react';
import { ClientReportModal } from './ClientReportModal';
import {
  getLumiKPIConfig,
  getLumiKPIStatus,
  getLumiStatusDot,
  getObjectiveMetrics } from
'@/lib/lumi-kpi-config';
import { CampaignGoalRow } from './CampaignGoalRow';
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
import { useNavigate } from 'react-router-dom';

const AUTOMATABLE_TYPES = new Set(['budget_increase', 'budget_decrease', 'pause_ad', 'resume_ad', 'swap_creative']);

function getActionButton(rec: any, campaignId: string): { label: string; url: string; icon: React.ReactNode } {
  const title = (rec.title || '').toLowerCase();
  if (title.includes('resonat') || title.includes('ctr') || title.includes('click')) {
    return { label: 'Add New Posts', url: `/creative-studio?workspace=${campaignId}&selectPosts=true`, icon: <Plus className="h-3.5 w-3.5" /> };
  }
  if (title.includes('fatigue') || title.includes('cost per purchase') || title.includes('refresh') || title.includes('cpp') || title.includes('below benchmark')) {
    return { label: 'Refresh Creative', url: `/creative-studio?workspace=${campaignId}&refreshCreative=true`, icon: <RefreshCw className="h-3.5 w-3.5" /> };
  }
  return { label: 'Try New Angles', url: `/creative-studio?workspace=${campaignId}`, icon: <Wand2 className="h-3.5 w-3.5" /> };
}

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
  budgetLevel?: 'campaign' | 'adset' | null;
  trackingVerified?: boolean;
  lastSyncedAt?: string | null;
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
  customDateRange?: {from: Date;to: Date;} | null;
  onDateRangeChange: (range: string) => void;
  onCustomDateRangeChange?: (range: {from: Date;to: Date;} | null) => void;
  onViewInsights: (campaignId: string) => void;
  onUpdateGoal: (campaignId: string, goal: number) => void;
  onOfferLinked?: () => void;
  onCampaignStatusChange?: (campaignId: string, newStatus: string) => void;
  isLoading: boolean;
  accountMetrics?: AccountMetrics | null;
  accountMetricsLoading?: boolean;
  brandId?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
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
  const isVideoCampaign = obj.includes('video') || name.includes('video') || name.includes('thruplay') || name.includes('views');
  if (isLeadCampaign && (campaign.metrics.leads ?? 0) > 0) return true;
  if (isSalesCampaign && (campaign.metrics.purchases ?? 0) > 0) return true;
  if (isVideoCampaign && ((campaign.metrics.videoViews ?? 0) > 0 || (campaign.metrics.videoThruPlays ?? 0) > 0)) return true;
  if (!isLeadCampaign && !isSalesCampaign && !isVideoCampaign && ((campaign.metrics.leads ?? 0) > 0 || (campaign.metrics.purchases ?? 0) > 0)) return true;
  return false;
}

function getVerdict(status: string): {label: string;colorClass: string;} {
  switch (status) {
    case 'healthy':return { label: 'Above benchmark', colorClass: 'text-green-700' };
    case 'attention':return { label: 'Right at benchmark', colorClass: 'text-amber-700' };
    case 'critical':return { label: 'Below benchmark', colorClass: 'text-red-700' };
    default:return { label: 'Gathering data', colorClass: 'text-muted-foreground' };
  }
}

function getActionRecommendation(status: string): string {
  switch (status) {
    case 'healthy':return 'Increase budget';
    case 'attention':return 'Keep spend the same';
    case 'critical':return 'Refresh creative or pause';
    default:return 'Wait for more data';
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
  onOfferLinked,
  onCampaignStatusChange,
  isLoading,
  accountMetrics,
  accountMetricsLoading,
  brandId,
  dateRangeStart,
  dateRangeEnd
}: InsightsHomeProps) {
  const navigate = useNavigate();
  const { isAgencyUser } = useBrand();
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['active', 'live']);
  const [togglingCampaign, setTogglingCampaign] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recCountsByWorkspace, setRecCountsByWorkspace] = useState<Record<string, number>>({});
  const [reportModalOpen, setReportModalOpen] = useState(false);

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
      // Step 1: Send the toggle command to Meta
      const { data, error } = await supabase.functions.invoke('check-campaign-status', {
        body: { workspaceId: campaign.id, action }
      });
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || `Failed to ${action} campaign`);
      }

      // Step 2: Wait briefly for Meta to propagate the change
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Re-fetch status from Meta to VERIFY the change actually stuck
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('check-campaign-status', {
        body: { workspaceId: campaign.id }
      });

      const verifiedStatus = verifyData?.status?.effectiveStatus?.toLowerCase() || data.newStatus?.toLowerCase();

      if (verifyError) {
        console.warn('Verification fetch failed, trusting initial response');
      }

      const expectedStatus = action === 'pause' ? 'paused' : 'active';
      const actualStatus = verifiedStatus || expectedStatus;

      // Step 4: Update local state immediately so UI reflects truth
      onCampaignStatusChange?.(campaign.id, actualStatus);

      if (actualStatus !== expectedStatus) {
        toast.warning(`Meta reports campaign is "${actualStatus}" — may take a moment to propagate`);
      } else {
        toast.success(`Campaign ${action === 'pause' ? 'paused' : 'resumed'}`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTogglingCampaign(null);
    }
  };

  const handleOfferLinked = () => {
    setLinkOfferModal({ open: false, campaign: null });
    toast.success('Offer linked successfully!');
    onOfferLinked?.();
  };

  // Fetch recommendations for campaigns with metrics
  const fetchRecommendations = async () => {
    const activeCampaigns = filteredCampaigns.length > 0 ? filteredCampaigns : campaigns.filter((c) => {
      const status = (c.status || '').toLowerCase();
      return status === 'active' || status === 'live';
    });

    const campaignsWithMetrics = activeCampaigns.filter((c) => {
      const normalizedStatus = (c.status || '').toLowerCase();
      const isLiveStatus = normalizedStatus === 'active' || normalizedStatus === 'live';
      const hasMetricsObject = !!c.metrics;
      const hasDelivery = (Number(c.metrics?.spend || 0) > 0) || (Number(c.metrics?.impressions || 0) > 0);
      return isLiveStatus && hasMetricsObject && hasDelivery;
    });

    if (campaignsWithMetrics.length === 0) {
      setRecommendations([]);
      setRecCountsByWorkspace({});
      return;
    }

    setRecsLoading(true);
    try {
      const allRecs: any[] = [];
      for (const campaign of campaignsWithMetrics.slice(0, 5)) {
        const { data, error } = await supabase.functions.invoke('generate-recommendations', {
          body: {
            workspaceId: campaign.id,
            brandId: campaign.brandId,
            metrics: { ...campaign.metrics, dailyBudget: campaign.dailyBudget }
          }
        });

        if (!error && data?.recommendations) {
          allRecs.push(...data.recommendations.map((r: any) => ({
            ...r,
            campaignName: campaign.name,
            campaignId: campaign.id
          })));
        }
      }

      // Add fallback recs for campaigns not already represented
      const representedIds = new Set(allRecs.map((r: any) => r.campaignId));
      for (const campaign of campaignsWithMetrics) {
        if (representedIds.has(campaign.id)) continue;
        const kpiConfig = getLumiKPIConfig(campaign.objective, campaign.templateName, campaign.name);
        const primaryValue = getPrimaryKPIValue(campaign.metrics, kpiConfig.primary);
        const status = getLumiKPIStatus(primaryValue, kpiConfig.benchmark, kpiConfig.primary);

        let fallback: any = null;
        switch (status) {
          case 'healthy':
            fallback = { id: `fallback-${campaign.id}`, type: 'budget_increase', title: 'Strong ad performance — consider scaling', description: 'Your primary ad KPI is above benchmark. This could be a good time to increase ad budget.', impact: 'Capture more results at efficient cost', confidence: 'medium', requiresDoubleApproval: true, actionPayload: { workspaceId: campaign.id, percentageChange: 20, currentBudget: campaign.dailyBudget || 25 }, priority: 50 };
            break;
          case 'attention':
            fallback = { id: `fallback-${campaign.id}`, type: 'keep_running', title: 'Monitor ads closely — performance is borderline', description: 'Your primary ad KPI is near the benchmark threshold. Keep an eye on it.', impact: 'Prevent ad performance from slipping', confidence: 'medium', requiresDoubleApproval: false, actionPayload: {}, priority: 50, userAction: true, actionUrl: `/data` };
            break;
          case 'critical':
            fallback = { id: `fallback-${campaign.id}`, type: 'create_creative', title: 'Ad below benchmark — refresh creative', description: 'Your primary ad KPI is below benchmark. Fresh ad creative angles could help turn things around.', impact: 'Improve ad performance with new creative', confidence: 'high', requiresDoubleApproval: false, actionPayload: {}, priority: 50, userAction: true, actionUrl: `/creative?workspace=${campaign.id}&refreshCreative=true` };
            break;
          default:
            fallback = { id: `fallback-${campaign.id}`, type: 'keep_running', title: 'Still gathering ad data', description: 'Not enough ad delivery data yet to make a confident recommendation. Let it run.', impact: 'Allow the algorithm to optimize', confidence: 'low', requiresDoubleApproval: false, actionPayload: {}, priority: 99, userAction: true, actionUrl: '/data' };
            break;
        }

        if (fallback) {
          fallback.campaignName = campaign.name;
          fallback.campaignId = campaign.id;
          allRecs.push(fallback);
        }
      }

      setRecommendations(allRecs);
      const counts: Record<string, number> = {};
      allRecs.forEach((r) => {
        counts[r.campaignId] = (counts[r.campaignId] || 0) + 1;
      });
      setRecCountsByWorkspace(counts);
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    } finally {
      setRecsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && campaigns.some((c) => c.metrics)) {
      fetchRecommendations();
    }
  }, [isLoading, campaigns, selectedStatuses]);

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
        <p className="text-muted-foreground max-w-md mx-auto text-lg">Track performance and get smart recommendations

        </p>
      </div>

      {/* Subtle date range row + Generate Report */}
      <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>Viewing data for:</span>
          <DateRangePicker
            dateRange={dateRange}
            customDateRange={customDateRange}
            onDateRangeChange={onDateRangeChange}
            onCustomDateRangeChange={onCustomDateRangeChange}
          />
        </div>
        {brandId && campaigns.length > 0 && isAgencyUser && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl text-xs gap-1.5"
            onClick={() => setReportModalOpen(true)}
          >
            <FileText className="h-3.5 w-3.5" />
            Generate Report
          </Button>
        )}
      </div>

      {/* Account Overview */}
      {(accountMetrics || accountMetricsLoading) &&
      <AccountOverview metrics={accountMetrics || null} isLoading={accountMetricsLoading || false} />
      }

      {/* Unlinked Campaigns Banner */}
      <UnlinkedCampaignsBanner
        campaigns={campaigns}
        brandId={campaigns[0]?.brandId}
        onLinkOffer={(campaign) => setLinkOfferModal({ open: true, campaign })} />
      

      {/* Status Filter */}
      {campaigns.length > 0 &&
      <StatusFilter
        selectedStatuses={selectedStatuses}
        onStatusChange={setSelectedStatuses}
        statusCounts={statusCounts} />

      }

      {/* Lumi Recommendations — only automatable actions */}
      {(() => {
        const automatableRecs = recommendations.filter(r => AUTOMATABLE_TYPES.has(r.type));
        if (automatableRecs.length === 0 && !recsLoading) return null;
        return (
          <LumiRecommendations
            recommendations={automatableRecs}
            loading={recsLoading}
            onRefresh={fetchRecommendations}
            onRecommendationExecuted={fetchRecommendations}
            compact
            maxItems={4} />
        );
      })()}

      {/* Campaign Cards */}
      {isLoading ?
      <div className="space-y-4">
          {[1, 2, 3].map((i) =>
        <Card key={i} className="rounded-2xl animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded-xl" />
              </CardContent>
            </Card>
        )}
        </div> :
      filteredCampaigns.length === 0 ?
      <Card variant="gradient" className="rounded-2xl border-dashed border-2">
          <CardContent className="p-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary/30 animate-sparkle-pulse" />
            <h3 className="text-lg font-medium mb-2 text-gradient-lumi">
              {campaigns.length === 0 ? 'No campaigns yet' : 'No campaigns match filter'}
            </h3>
            <p className="text-muted-foreground">
              {campaigns.length === 0 ?
            'Build and publish a campaign to see your insights here.' :
            'Try adjusting the status filter to see more campaigns.'
            }
            </p>
          </CardContent>
        </Card> :

      <div className="space-y-3">
          {filteredCampaigns.map((campaign) => {
          const kpiConfig = getLumiKPIConfig(campaign.objective, campaign.templateName, campaign.name);
          const primaryValue = getPrimaryKPIValue(campaign.metrics, kpiConfig.primary);
          const status = getLumiKPIStatus(primaryValue, kpiConfig.benchmark, kpiConfig.primary);
          const statusDot = getLumiStatusDot(status);
          const verdict = getVerdict(status);
          const actionRec = getActionRecommendation(status);
          const isActive = campaign.status === 'active' || campaign.status === 'live';
          const isToggling = togglingCampaign === campaign.id;
          const objMetrics = getObjectiveMetrics(campaign.metrics, kpiConfig);
          const recCount = recCountsByWorkspace[campaign.id] || 0;

          return (
            <Card
              key={campaign.id}
              variant="glow"
              className="rounded-2xl transition-all duration-300 hover:scale-[1.005]">
              
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3">
                    {/* Row 1: Name + status dot + Live/Paused label + toggle */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot}`} />
                        <h3 className="font-display font-semibold text-sm sm:text-base truncate">{campaign.name}</h3>
                        {recCount > 0 &&
                      <button
                        onClick={(e) => {e.stopPropagation();onViewInsights(campaign.id);}}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-gradient-lumi shrink-0 hover:opacity-90 transition-opacity shadow-glow animate-sparkle-pulse">
                        
                            <Sparkles className="h-3 w-3" />
                            {recCount}
                          </button>
                      }
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-medium ${isActive ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {isActive ? 'Live' : 'Paused'}
                        </span>
                        {isToggling ?
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> :

                      <Switch
                        checked={isActive}
                        onCheckedChange={() => toggleCampaignStatus(campaign)}
                        aria-label={`Toggle ${campaign.name}`} />

                      }
                      </div>
                    </div>

                    {/* Row 2: Budget + Spend + Objective KPIs + Last Synced */}
                    <div className="flex flex-wrap items-center gap-2 pl-5">
                      {campaign.dailyBudget != null && campaign.dailyBudget > 0 ?
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          <DollarSign className="h-3 w-3" />
                          ${campaign.dailyBudget.toFixed(2)}/day
                          {campaign.budgetLevel === 'adset' && <span className="text-[10px] opacity-60">(ad sets)</span>}
                        </span> :
                      campaign.dailyBudget === undefined && campaign.lastSyncedAt ?
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground/50">
                          <DollarSign className="h-3 w-3" />
                          —
                        </span> : null
                    }
                      {campaign.metrics?.spend != null && Number(campaign.metrics.spend) > 0 &&
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          ${Number(campaign.metrics.spend).toFixed(2)} spent
                        </span>
                    }
                      {objMetrics.map((m, i) =>
                    <span key={i} className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {m.value} {m.label}
                        </span>
                    )}
                      {campaign.lastSyncedAt && (() => {
                        const syncAge = Date.now() - new Date(campaign.lastSyncedAt).getTime();
                        const isStale = syncAge > 60 * 60 * 1000; // > 1 hour
                        const syncLabel = syncAge < 60000 ? 'Just now' :
                          syncAge < 3600000 ? `${Math.floor(syncAge / 60000)}m ago` :
                          `${Math.floor(syncAge / 3600000)}h ago`;
                        return (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isStale ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground/60'}`}>
                            {isStale && <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />}
                            Synced {syncLabel}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Row 3: Verdict + Action */}
                    <div className="flex items-center justify-between gap-2 pl-5">
                      <span className={`text-sm font-medium ${verdict.colorClass}`}>
                        {verdict.label}
                      </span>
                      {isBudgetAction(actionRec) ?
                    <Popover>
                          <PopoverTrigger asChild>
                            <Badge
                          variant="outline"
                          className="text-xs rounded-full cursor-pointer hover:bg-primary/10 transition-colors">
                          
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
                            spend: campaign.metrics?.spend
                          }}
                          inline />
                        
                          </PopoverContent>
                        </Popover> :

                    <Badge
                      variant="outline"
                      className="text-xs rounded-full cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => onViewInsights(campaign.id)}>
                      
                          {actionRec}
                        </Badge>
                    }
                    </div>

                    {/* Row 3.5: User-action recommendations inline */}
                    {(() => {
                      const userRecs = recommendations.filter(
                        r => r.campaignId === campaign.id && !AUTOMATABLE_TYPES.has(r.type)
                      );
                      if (userRecs.length === 0) return null;
                      return (
                        <div className="space-y-1.5 pl-5">
                          {userRecs.slice(0, 2).map((rec: any) => {
                            const action = getActionButton(rec, campaign.id);
                            return (
                              <div
                                key={rec.id}
                                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[hsl(var(--lumi-orange-1)/0.06)] border border-[hsl(var(--lumi-orange-1)/0.15)]"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--lumi-orange-1))] shrink-0" />
                                  <span className="text-xs font-medium truncate">{rec.title}</span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="lumi"
                                  className="rounded-xl text-xs shrink-0 gap-1 h-7 px-2.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(action.url);
                                  }}
                                >
                                  {action.icon}
                                  {action.label}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Row 3.5: Goal vs Actual */}
                    <CampaignGoalRow
                    kpiConfig={kpiConfig}
                    currentValue={primaryValue}
                    userGoal={campaign.userGoal ?? null}
                    onUpdateGoal={(goal) => onUpdateGoal(campaign.id, goal)} />
                  

                    {/* Row 4: View button */}
                    <div className="flex items-center gap-2 pt-1 pl-5">
                      <Button
                      onClick={() => onViewInsights(campaign.id)}
                      variant="lumi"
                      size="sm"
                      className="rounded-xl text-xs">
                      
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View Details
                      </Button>
                      {!campaign.offerId &&
                    <Button
                      onClick={() => setLinkOfferModal({ open: true, campaign })}
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs">
                      
                          <Package className="h-3.5 w-3.5 mr-1" />
                          Link Offer
                        </Button>
                    }
                      {campaign.trackingVerified === false && !hasLiveConversions(campaign) &&
                    <Badge variant="outline" className="text-xs rounded-full text-amber-600 border-amber-500/30 gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Tracking not verified
                        </Badge>
                    }
                    </div>
                  </div>
                </CardContent>
              </Card>);

        })}
        </div>
      }

      {/* Footer */}
      {campaigns.length > 0 &&
      <p className="text-center text-sm text-muted-foreground">
          <span className="text-gradient-lumi font-medium">✨ Lumi's got you</span> — focus on the green signals, and we'll alert you when something needs attention.
        </p>
      }
      
      {linkOfferModal.campaign &&
      <LinkOfferModal
        open={linkOfferModal.open}
        onOpenChange={(open) => setLinkOfferModal({ open, campaign: open ? linkOfferModal.campaign : null })}
        workspaceId={linkOfferModal.campaign.id}
        workspaceName={linkOfferModal.campaign.name}
        brandId={linkOfferModal.campaign.brandId || ''}
        onSuccess={() => handleOfferLinked()} />

      }

      {/* Client Report Modal */}
      {brandId && (
        <ClientReportModal
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
          brandId={brandId}
          dateRangeStart={dateRangeStart || ''}
          dateRangeEnd={dateRangeEnd || ''}
        />
      )}
    </div>);

}