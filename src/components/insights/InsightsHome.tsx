import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Eye, 
  Sparkles, 
  Calendar,
  Pencil,
  Check,
  X
} from 'lucide-react';
import { 
  getLumiKPIConfig, 
  formatLumiKPIValue, 
  getLumiKPIStatus,
  getLumiStatusDot,
  getLumiStatusLabel,
  formatBenchmarkRange
} from '@/lib/lumi-kpi-config';
import { KPIProgressBar } from './KPIProgressBar';
import { KPITrendIndicator } from './KPITrendIndicator';
import { DateRangePicker } from './DateRangePicker';
import { StatusFilter } from './StatusFilter';
import { AccountOverview } from './AccountOverview';

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

// Helper to extract the primary KPI value from metrics
function getPrimaryKPIValue(metrics: CampaignMetrics | null, primaryKey: string): number | null {
  if (!metrics) return null;
  
  // Direct match
  if (primaryKey in metrics && metrics[primaryKey] !== undefined) {
    return metrics[primaryKey] as number;
  }
  
  // Calculate costPerThruPlay if not present
  if (primaryKey === 'costPerThruPlay' && metrics.spend && metrics.videoThruPlays) {
    return metrics.videoThruPlays > 0 ? metrics.spend / metrics.videoThruPlays : null;
  }
  
  return null;
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
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [goalValue, setGoalValue] = useState<string>('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['active', 'live', 'paused', 'imported']);

  // Calculate status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    campaigns.forEach((c) => {
      const status = c.status || 'live';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [campaigns]);

  // Filter campaigns by selected statuses
  const filteredCampaigns = useMemo(() => {
    if (selectedStatuses.length === 0) return campaigns;
    return campaigns.filter((c) => {
      const status = c.status || 'live';
      return selectedStatuses.includes(status);
    });
  }, [campaigns, selectedStatuses]);
  const handleStartEditGoal = (campaignId: string, currentGoal: number | null | undefined) => {
    setEditingGoal(campaignId);
    setGoalValue(currentGoal?.toString() || '');
  };

  const handleSaveGoal = (campaignId: string) => {
    const numValue = parseFloat(goalValue);
    if (!isNaN(numValue) && numValue > 0) {
      onUpdateGoal(campaignId, numValue);
    }
    setEditingGoal(null);
    setGoalValue('');
  };

  const handleCancelEdit = () => {
    setEditingGoal(null);
    setGoalValue('');
  };

  return (
    <div className="space-y-8">
      {/* Lumi Welcome Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-lumi-orange-1/10 via-lumi-pink-1/10 to-lumi-purple-1/10 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary animate-sparkle-pulse" />
          <span className="text-sm font-medium text-gradient-lumi">Lumi Insights</span>
        </div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          Let's keep this <span className="text-gradient-lumi">simple</span>.
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Here's the clearest signal for each of your campaigns. Lumi monitors these automatically.
        </p>
      </div>

      {/* Account Overview */}
      {(accountMetrics || accountMetricsLoading) && (
        <AccountOverview metrics={accountMetrics || null} isLoading={accountMetricsLoading || false} />
      )}

      {/* Global Date Selector */}
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

      {/* Campaign Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="rounded-2xl animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 bg-muted rounded-xl" />
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
        <div className="space-y-4">
          {filteredCampaigns.map(campaign => {
            // Get KPI config using objective, template name, and campaign name
            const kpiConfig = getLumiKPIConfig(campaign.objective, campaign.templateName, campaign.name);
            const primaryValue = getPrimaryKPIValue(campaign.metrics, kpiConfig.primary);
            const status = getLumiKPIStatus(primaryValue, kpiConfig.benchmark, kpiConfig.primary);
            const statusDot = getLumiStatusDot(status);
            const statusLabel = getLumiStatusLabel(status);

            return (
              <Card 
                key={campaign.id} 
                variant="glow"
                className="rounded-2xl transition-all duration-300 hover:scale-[1.01]"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    {/* Campaign Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${statusDot}`} />
                        <h3 className="font-display font-semibold text-lg">{campaign.name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground pl-6">
                        {kpiConfig.friendlyName} Campaign
                      </p>
                    </div>

                    {/* Primary KPI Display */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 lg:gap-10">
                    {/* KPI Value with Progress */}
                      <div className="space-y-2 min-w-[140px]">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                          {kpiConfig.primaryLabel}
                        </p>
                        <p className="text-3xl font-bold text-foreground">
                          {formatLumiKPIValue(primaryValue, kpiConfig.primary)}
                        </p>
                        {/* Trend Indicator */}
                        <KPITrendIndicator
                          currentValue={primaryValue}
                          previousValue={getPrimaryKPIValue(campaign.previousMetrics || null, kpiConfig.primary)}
                          kpiKey={kpiConfig.primary}
                        />
                        {/* Progress Bar */}
                        <KPIProgressBar
                          value={primaryValue}
                          benchmark={kpiConfig.benchmark}
                          userGoal={campaign.userGoal}
                          kpiKey={kpiConfig.primary}
                          className="w-32"
                        />
                      </div>

                      {/* Benchmark */}
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                          Benchmark
                        </p>
                        <p className="text-lg text-muted-foreground">
                          {formatBenchmarkRange(kpiConfig.benchmark)}
                        </p>
                      </div>

                      {/* User Goal (Editable) */}
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                          Your Goal
                        </p>
                        {editingGoal === campaign.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={goalValue}
                              onChange={(e) => setGoalValue(e.target.value)}
                              className="w-24 h-8 rounded-lg text-lg"
                              placeholder="$0.00"
                              autoFocus
                            />
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-green-600"
                              onClick={() => handleSaveGoal(campaign.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-muted-foreground"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEditGoal(campaign.id, campaign.userGoal)}
                            className="flex items-center gap-2 text-lg text-muted-foreground hover:text-foreground transition-colors group"
                          >
                            {campaign.userGoal ? (
                              <span>
                                {kpiConfig.benchmark.unit === 'x' 
                                  ? `${campaign.userGoal.toFixed(2)}x` 
                                  : `${kpiConfig.benchmark.unit}${campaign.userGoal.toFixed(2)}`
                                }
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">Set goal</span>
                            )}
                            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </div>

                      {/* Status Badge */}
                      <Badge 
                        variant="outline"
                        className={`
                          rounded-full px-4 py-1.5 text-sm font-medium border
                          ${status === 'healthy' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                          ${status === 'attention' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                          ${status === 'critical' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                          ${status === 'no-data' ? 'bg-gray-50 text-gray-600 border-gray-200' : ''}
                        `}
                      >
                        {statusLabel}
                      </Badge>

                      {/* View Button */}
                      <Button
                        onClick={() => onViewInsights(campaign.id)}
                        variant="lumi"
                        className="rounded-xl"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Insights
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Lumi Footer Message */}
      {campaigns.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          <span className="text-gradient-lumi font-medium">✨ Lumi's got you</span> — focus on the green signals, and we'll alert you when something needs attention.
        </p>
      )}
    </div>
  );
}
