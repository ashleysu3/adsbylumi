import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ArrowLeft, 
  Sparkles, 
  Calendar,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Heart,
  RefreshCw,
  Sparkle,
  Info,
  Package,
  PlusCircle,
  ArrowRight,
  ChevronDown,
  DollarSign
} from 'lucide-react';
import { 
  getLumiKPIConfig, 
  formatLumiKPIValue, 
  getLumiKPIStatus,
  getLumiStatusColor,
  getLumiStatusLabel,
} from '@/lib/lumi-kpi-config';
import { AdBreakdown } from './AdBreakdown';
import { BudgetAdjustmentPanel } from './BudgetAdjustmentPanel';
import { LinkOfferModal } from './LinkOfferModal';
import { CreativeBenchPanel } from './CreativeBenchPanel';
import { WhatsWorkingCard } from './WhatsWorkingCard';
import { LumiRecommendations } from './LumiRecommendations';

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

interface PerformanceAnalysis {
  kpi_evaluation?: Record<string, {
    value: number;
    status: string;
    benchmark: string;
    reason: string;
  }>;
  journey_diagnosis?: {
    grow: string;
    nurture: string;
    convert: string;
  };
  creative_diagnosis?: {
    problem: string;
    cause: string;
    recommended_creatives_to_add: string[];
    recommended_creatives_to_refresh: string[];
    why_it_works: string;
  };
  warm_audience_health?: {
    size: string;
    stability: string;
    notes: string;
    recommendation: string;
  };
  next_steps?: string[];
  journey_stages?: string[];
  kpi_benchmarks?: Record<string, { min: number; max: number; unit: string }>;
}

interface CampaignInsightDetailProps {
  campaign: {
    id: string;
    name: string;
    templateName: string | null;
    objective: string | null;
    metrics: CampaignMetrics | null;
    previousMetrics?: CampaignMetrics | null;
    userGoal?: number | null;
    offerId?: string | null;
    offerName?: string | null;
    brandId?: string;
  };
  analysis: PerformanceAnalysis | null;
  globalDateRange: string;
  onBack: () => void;
  onUpdateGoal: (goal: number) => void;
  onDateRangeChange?: (range: string) => void;
  onOfferLinked?: () => void;
  isLoading: boolean;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  detailLevel?: 'simple' | 'detailed';
}

const dateRangeOptions = [
  { value: 'global', label: 'Same as overview' },
  { value: '7', label: 'Last 7 days' },
  { value: '1', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '3', label: 'Last 3 days' },
  { value: '14', label: 'Last 14 days' },
];

function getBudgetVerdict(status: string): { label: string; icon: React.ReactNode; colorClass: string } {
  switch (status) {
    case 'healthy': return { label: 'Increase spend', icon: <TrendingUp className="h-4 w-4" />, colorClass: 'text-green-700 bg-green-50 border-green-200' };
    case 'attention': return { label: 'Keep spend the same', icon: <DollarSign className="h-4 w-4" />, colorClass: 'text-amber-700 bg-amber-50 border-amber-200' };
    case 'critical': return { label: 'Reduce spend', icon: <TrendingDown className="h-4 w-4" />, colorClass: 'text-red-700 bg-red-50 border-red-200' };
    default: return { label: 'Wait for data', icon: <Info className="h-4 w-4" />, colorClass: 'text-muted-foreground bg-muted border-muted' };
  }
}

export function CampaignInsightDetail({ 
  campaign, 
  analysis, 
  globalDateRange,
  onBack,
  onUpdateGoal,
  onDateRangeChange,
  onOfferLinked,
  isLoading,
  dateRangeStart,
  dateRangeEnd,
  detailLevel = 'simple',
}: CampaignInsightDetailProps) {
  const navigate = useNavigate();
  const recsRef = useRef<HTMLDivElement>(null);
  const [localDateRange, setLocalDateRange] = useState<string>('global');
  const [showLinkOfferModal, setShowLinkOfferModal] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(detailLevel === 'detailed');
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  // Fetch recommendations for this campaign
  const fetchRecommendations = async () => {
    if (!campaign.metrics) return;
    setRecsLoading(true);
    try {
      // Also fetch bench items for swap recommendations
      let benchItems: any[] = [];
      if (campaign.brandId) {
        const { data: bench } = await supabase
          .from('creative_bench')
          .select('*')
          .eq('workspace_id', campaign.id)
          .eq('status', 'bench');
        benchItems = bench || [];
      }

      const { data, error } = await supabase.functions.invoke('generate-recommendations', {
        body: {
          workspaceId: campaign.id,
          brandId: campaign.brandId,
          metrics: campaign.metrics,
          benchItems,
        },
      });
      if (!error && data?.recommendations) {
        setRecommendations(data.recommendations);
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    } finally {
      setRecsLoading(false);
    }
  };

  useEffect(() => {
    if (campaign.metrics && !isLoading) {
      fetchRecommendations();
    }
  }, [campaign.id, isLoading]);

  // Load auto_rotate_enabled from workspace
  const handleAutoRotateChange = async (enabled: boolean) => {
    setAutoRotateEnabled(enabled);
    try {
      await supabase
        .from('campaign_workspaces')
        .update({ auto_rotate_enabled: enabled })
        .eq('id', campaign.id);
    } catch (err) {
      console.error('Failed to update auto-rotate:', err);
    }
  };

  const kpiConfig = getLumiKPIConfig(campaign.objective, campaign.templateName, campaign.name);
  const primaryValue = getPrimaryKPIValue(campaign.metrics, kpiConfig.primary);
  const status = getLumiKPIStatus(primaryValue, kpiConfig.benchmark, kpiConfig.primary);
  const statusColorClass = getLumiStatusColor(status);
  const statusLabel = getLumiStatusLabel(status);
  const budgetVerdict = getBudgetVerdict(status);

  const handleDateRangeChange = (value: string) => {
    setLocalDateRange(value);
    if (onDateRangeChange && value !== 'global') {
      onDateRangeChange(value);
    } else if (onDateRangeChange && value === 'global') {
      onDateRangeChange(globalDateRange);
    }
  };
  
  const handleOfferLinked = () => {
    setShowLinkOfferModal(false);
    onOfferLinked?.();
  };
  
  const handleAddCreative = () => {
    navigate(`/creative?workspace=${campaign.id}&addCreative=true`);
  };

  // Extract signals
  const whatsWorking = analysis?.kpi_evaluation 
    ? Object.entries(analysis.kpi_evaluation)
        .filter(([_, kpi]) => kpi.status === 'excellent' || kpi.status === 'healthy')
        .map(([key, kpi]) => kpi.reason)
        .slice(0, 2)
    : [];

  const needsAttention = analysis?.kpi_evaluation
    ? Object.entries(analysis.kpi_evaluation)
        .filter(([key, kpi]) => {
          if (kpi.status === 'tracking_only' || kpi.status === 'not_applicable') return false;
          return kpi.status === 'needs attention' || kpi.status === 'critical' || kpi.status === 'needs_attention';
        })
        .map(([key, kpi]) => kpi.reason)
        .slice(0, 2)
    : [];

  const nextSteps = (analysis?.next_steps || []).slice(0, 2);

  return (
    <div className="space-y-6 pb-12">
      {/* Back Button */}
      <Button variant="ghost" onClick={onBack} className="rounded-xl">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Overview
      </Button>

      {/* Campaign Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-[hsl(var(--lumi-orange-1))]" />
          <Badge variant="outline" className="rounded-full text-xs">
            {kpiConfig.friendlyName}
          </Badge>
        </div>
        <h1 className="text-2xl font-display font-bold">{campaign.name}</h1>
      </div>

      {/* Link Offer Section */}
      <Card className={`rounded-2xl shadow-[var(--shadow-card)] ${
        campaign.offerId ? 'border-green-200 bg-green-50/30' : 'border-amber-200 bg-amber-50/30'
      }`}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                campaign.offerId ? 'bg-green-100' : 'bg-amber-100'
              }`}>
                <Package className={`h-5 w-5 ${campaign.offerId ? 'text-green-600' : 'text-amber-600'}`} />
              </div>
              <div>
                <p className="font-medium text-sm">{campaign.offerId ? 'Linked Offer' : 'No Offer Linked'}</p>
                <p className="text-sm text-muted-foreground">
                  {campaign.offerId ? (campaign.offerName || 'Offer connected') : 'Link an offer to enable creative generation'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {campaign.offerId ? (
                <Button size="sm" onClick={handleAddCreative} className="rounded-xl">
                  <PlusCircle className="h-4 w-4 mr-2" />Add to Campaign
                </Button>
              ) : (
                <Button onClick={() => setShowLinkOfferModal(true)} className="rounded-xl">
                  <Package className="h-4 w-4 mr-2" />Link Offer<ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date Override */}
      <Card className="rounded-2xl border-[hsl(var(--fog-grey))] bg-white shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" /><span>Date range:</span>
            </div>
            <Select value={localDateRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger className="w-[200px] rounded-xl border-[hsl(var(--fog-grey))]"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                {dateRangeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Link Offer Modal */}
      {campaign.brandId && (
        <LinkOfferModal
          open={showLinkOfferModal}
          onOpenChange={setShowLinkOfferModal}
          workspaceId={campaign.id}
          workspaceName={campaign.name}
          brandId={campaign.brandId}
          onSuccess={handleOfferLinked}
        />
      )}

      {isLoading ? (
        <Card className="rounded-2xl">
          <CardContent className="p-12 flex flex-col items-center justify-center">
            <div className="w-full max-w-sm mb-4">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[hsl(var(--lumi-orange-1))] to-[hsl(var(--lumi-orange-2))] rounded-full animate-pulse w-1/2" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Taking a look at the big picture.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* HIGH-LEVEL: 3 Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* What's Working */}
            <Card className="rounded-2xl border-green-200 bg-green-50/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-sm">What's Working</h3>
                </div>
                {whatsWorking.length > 0 ? (
                  <ul className="space-y-2">
                    {whatsWorking.map((item, i) => (
                      <li key={i} className="text-sm text-green-800">• {item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Still gathering data</p>
                )}
              </CardContent>
            </Card>

            {/* What's Not Working */}
            <Card className="rounded-2xl border-amber-200 bg-amber-50/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <h3 className="font-semibold text-sm">What's Not Working</h3>
                </div>
                {needsAttention.length > 0 ? (
                  <ul className="space-y-2">
                    {needsAttention.map((item, i) => (
                      <li key={i} className="text-sm text-amber-800">• {item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-green-700">Everything looks great! 🎉</p>
                )}
              </CardContent>
            </Card>

            {/* What To Do Next — clickable anchor to recommendations */}
            <Card
              className="rounded-2xl border-[hsl(var(--lumi-orange-1)/0.3)] bg-[hsl(var(--lumi-orange-1)/0.05)] cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => recsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkle className="h-5 w-5 text-[hsl(var(--lumi-orange-1))]" />
                  <h3 className="font-semibold text-sm">What To Do Next</h3>
                  {(nextSteps.length > 0 || recommendations.length > 0) && (
                    <Badge className="ml-auto bg-[hsl(var(--lumi-orange-1))] text-white text-xs rounded-full">
                      {nextSteps.length + recommendations.length}
                    </Badge>
                  )}
                </div>
                {nextSteps.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {nextSteps.length + recommendations.length} actionable recommendation{nextSteps.length + recommendations.length !== 1 ? 's' : ''} — tap to view
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Check back soon for recommendations</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Lumi Actionable Recommendations — below summary cards */}
          <LumiRecommendations
            recommendations={recommendations}
            loading={recsLoading}
            onRefresh={fetchRecommendations}
            onRecommendationExecuted={fetchRecommendations}
            nextSteps={analysis?.next_steps || []}
            recsRef={recsRef}
          />

          {/* Budget Recommendation */}
          <Card className={`rounded-2xl border ${budgetVerdict.colorClass}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/50">
                  {budgetVerdict.icon}
                </div>
                <div>
                  <p className="font-semibold text-sm">Budget Recommendation</p>
                  <p className="text-sm">{budgetVerdict.label}</p>
                </div>
                <Badge variant="outline" className="ml-auto rounded-full text-xs">
                  {statusLabel}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Primary KPI */}
          <Card className={`rounded-2xl border-2 ${statusColorClass} shadow-[var(--shadow-card)]`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                {status === 'healthy' && <CheckCircle2 className="h-8 w-8 text-green-600" />}
                {status === 'attention' && <AlertTriangle className="h-8 w-8 text-amber-600" />}
                {status === 'critical' && <AlertTriangle className="h-8 w-8 text-red-600" />}
                {status === 'no-data' && <Info className="h-8 w-8 text-gray-400" />}
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{kpiConfig.primaryLabel}</p>
                  <p className="text-4xl font-bold">{formatLumiKPIValue(primaryValue, kpiConfig.primary)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ad-Level Breakdown */}
          <AdBreakdown 
            workspaceId={campaign.id} 
            dateRangeStart={dateRangeStart}
            dateRangeEnd={dateRangeEnd}
          />

          {/* Creative Bench */}
          {campaign.brandId && (
            <CreativeBenchPanel
              workspaceId={campaign.id}
              brandId={campaign.brandId}
              autoRotateEnabled={autoRotateEnabled}
              onAutoRotateChange={handleAutoRotateChange}
            />
          )}

          {/* What's Working Card */}
          {campaign.brandId && (
            <WhatsWorkingCard brandId={campaign.brandId} workspaceId={campaign.id} />
          )}

          {/* Advanced Analysis (Collapsible) */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 w-full p-4 rounded-xl border bg-card text-sm font-medium hover:bg-muted/50 transition-colors">
                <Info className="h-4 w-4 text-muted-foreground" />
                Advanced Analysis
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-6">
              {/* Customer Journey */}
              {(() => {
                const journeyStages = analysis?.journey_stages || ['grow', 'nurture', 'convert'];
                const showGrow = journeyStages.includes('grow');
                const showNurture = journeyStages.includes('nurture');
                const showConvert = journeyStages.includes('convert');
                if (!showGrow && !showNurture && !showConvert) return null;
                
                return (
                  <Card className="rounded-2xl border-[hsl(var(--fog-grey))] bg-white shadow-[var(--shadow-card)]">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Heart className="h-5 w-5 text-[hsl(var(--lumi-orange-1))]" />
                        Customer Journey Performance
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {analysis?.journey_diagnosis ? (
                        <>
                          {showGrow && (
                            <div className="p-4 rounded-xl bg-[hsl(var(--warm-white))] border border-[hsl(var(--fog-grey))]">
                              <Badge variant="outline" className="rounded-full bg-green-50 text-green-700 border-green-200 mb-2">🌱 Grow</Badge>
                              <p className="text-sm">{analysis.journey_diagnosis.grow || 'No data yet'}</p>
                            </div>
                          )}
                          {showNurture && (
                            <div className="p-4 rounded-xl bg-[hsl(var(--warm-white))] border border-[hsl(var(--fog-grey))]">
                              <Badge variant="outline" className="rounded-full bg-amber-50 text-amber-700 border-amber-200 mb-2">💜 Nurture</Badge>
                              <p className="text-sm">{analysis.journey_diagnosis.nurture || 'No data yet'}</p>
                            </div>
                          )}
                          {showConvert && (
                            <div className="p-4 rounded-xl bg-[hsl(var(--warm-white))] border border-[hsl(var(--fog-grey))]">
                              <Badge variant="outline" className="rounded-full bg-blue-50 text-blue-700 border-blue-200 mb-2">💰 Convert</Badge>
                              <p className="text-sm">{analysis.journey_diagnosis.convert || 'No data yet'}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center p-4">Analyzing your customer journey — check back soon!</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Creative Fatigue */}
              <Card className="rounded-2xl border-[hsl(var(--fog-grey))] bg-white shadow-[var(--shadow-card)]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <RefreshCw className="h-5 w-5 text-[hsl(var(--lumi-orange-1))]" />
                    Creative Warmth & Fatigue
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysis?.creative_diagnosis?.problem ? (
                    <>
                      <Alert className="rounded-xl border-amber-200 bg-amber-50">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800">{analysis.creative_diagnosis.problem}</AlertDescription>
                      </Alert>
                      {analysis.creative_diagnosis.recommended_creatives_to_refresh?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Consider refreshing:</p>
                          <ul className="space-y-2">
                            {analysis.creative_diagnosis.recommended_creatives_to_refresh.slice(0, 2).map((item, i) => (
                              <li key={i} className="text-sm flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                                <RefreshCw className="h-4 w-4 text-[hsl(var(--lumi-orange-1))] shrink-0 mt-0.5" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 rounded-xl bg-green-50/50 border border-green-100 text-center">
                      <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
                      <p className="text-sm text-green-800">Your creative is fresh and performing well!</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Budget Adjustment Panel */}
              <BudgetAdjustmentPanel
                workspaceId={campaign.id}
                workspaceName={campaign.name}
                currentBudget={campaign.metrics?.spend ? Math.round(campaign.metrics.spend / 7) : 20}
                metrics={{
                  roas: campaign.metrics?.roas ?? undefined,
                  ctr: campaign.metrics?.clicks && campaign.metrics?.impressions 
                    ? (campaign.metrics.clicks / campaign.metrics.impressions) * 100 
                    : undefined,
                  frequency: campaign.metrics?.impressions && campaign.metrics?.spend
                    ? campaign.metrics.impressions / (campaign.metrics.spend * 10)
                    : undefined,
                }}
              />
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}
