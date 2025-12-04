import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  getLumiStatusDot
} from '@/lib/lumi-kpi-config';

interface Campaign {
  id: string;
  name: string;
  templateName: string | null;
  objective: string | null;
  metrics: {
    cpl?: number;
    cpp?: number;
    roas?: number;
    cpc?: number;
    cpm?: number;
    profile_visit_cost?: number;
    cost_per_thruplay?: number;
  } | null;
  userGoal?: number | null;
}

interface InsightsHomeProps {
  campaigns: Campaign[];
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  onViewInsights: (campaignId: string) => void;
  onUpdateGoal: (campaignId: string, goal: number) => void;
  isLoading: boolean;
}

const dateRangeOptions = [
  { value: '7', label: 'Last 7 days' },
  { value: '1', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '3', label: 'Last 3 days' },
  { value: '14', label: 'Last 14 days' },
  { value: 'custom', label: 'Custom range' },
];

export function InsightsHome({ 
  campaigns, 
  dateRange, 
  onDateRangeChange, 
  onViewInsights,
  onUpdateGoal,
  isLoading 
}: InsightsHomeProps) {
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [goalValue, setGoalValue] = useState<string>('');

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
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--lumi-orange-1)/0.1)] border border-[hsl(var(--lumi-orange-1)/0.2)]">
          <Sparkles className="h-4 w-4 text-[hsl(var(--lumi-orange-1))]" />
          <span className="text-sm font-medium text-[hsl(var(--lumi-orange-1))]">Lumi Insights</span>
        </div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          Let's keep this simple.
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Here's the clearest signal for each of your campaigns. Lumi monitors these automatically.
        </p>
      </div>

      {/* Global Date Selector */}
      <Card className="rounded-2xl border-[hsl(var(--fog-grey))] bg-white shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Viewing data for:</span>
            </div>
            <Select value={dateRange} onValueChange={onDateRangeChange}>
              <SelectTrigger className="w-[180px] rounded-xl border-[hsl(var(--fog-grey))]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {dateRangeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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
      ) : campaigns.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2 bg-[hsl(var(--warm-white))]">
          <CardContent className="p-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-[hsl(var(--lumi-orange-1)/0.3)]" />
            <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground">
              Build and publish a campaign to see your insights here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map(campaign => {
            const kpiConfig = getLumiKPIConfig(campaign.objective);
            const primaryValue = campaign.metrics?.[kpiConfig.primary as keyof typeof campaign.metrics] as number | undefined;
            const status = getLumiKPIStatus(primaryValue, kpiConfig.benchmark, kpiConfig.primary);
            const statusDot = getLumiStatusDot(status);

            return (
              <Card 
                key={campaign.id} 
                className="rounded-2xl border-[hsl(var(--fog-grey))] bg-white shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow"
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
                      {/* KPI Value */}
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                          {kpiConfig.primaryLabel}
                        </p>
                        <p className="text-3xl font-bold text-foreground">
                          {formatLumiKPIValue(primaryValue, kpiConfig.primary)}
                        </p>
                      </div>

                      {/* Benchmark */}
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                          Benchmark
                        </p>
                        <p className="text-lg text-muted-foreground">
                          {kpiConfig.benchmark.unit}{kpiConfig.benchmark.min} – {kpiConfig.benchmark.unit}{kpiConfig.benchmark.max}
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
                              <span>{kpiConfig.benchmark.unit}{campaign.userGoal}</span>
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
                        `}
                      >
                        {status === 'healthy' && 'Healthy'}
                        {status === 'attention' && 'Needs Attention'}
                        {status === 'critical' && 'Critical'}
                      </Badge>

                      {/* View Button */}
                      <Button
                        onClick={() => onViewInsights(campaign.id)}
                        variant="outline"
                        className="rounded-xl border-[hsl(var(--lumi-orange-1))] text-[hsl(var(--lumi-orange-1))] hover:bg-[hsl(var(--lumi-orange-1)/0.05)]"
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
          💡 Lumi's got you — focus on the green signals, and we'll alert you when something needs attention.
        </p>
      )}
    </div>
  );
}
