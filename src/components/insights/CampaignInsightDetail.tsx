import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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
  Lightbulb,
  Pencil,
  Check,
  X,
  Info
} from 'lucide-react';
import { 
  getLumiKPIConfig, 
  formatLumiKPIValue, 
  getLumiKPIStatus,
  getLumiStatusColor
} from '@/lib/lumi-kpi-config';

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
}

interface CampaignInsightDetailProps {
  campaign: {
    id: string;
    name: string;
    templateName: string | null;
    objective: string | null;
    metrics: Record<string, number> | null;
    userGoal?: number | null;
  };
  analysis: PerformanceAnalysis | null;
  globalDateRange: string;
  onBack: () => void;
  onUpdateGoal: (goal: number) => void;
  isLoading: boolean;
}

const dateRangeOptions = [
  { value: 'global', label: 'Same as overview' },
  { value: '7', label: 'Last 7 days' },
  { value: '1', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '3', label: 'Last 3 days' },
  { value: '14', label: 'Last 14 days' },
];

export function CampaignInsightDetail({ 
  campaign, 
  analysis, 
  globalDateRange,
  onBack,
  onUpdateGoal,
  isLoading 
}: CampaignInsightDetailProps) {
  const [localDateRange, setLocalDateRange] = useState<string>('global');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalValue, setGoalValue] = useState<string>(campaign.userGoal?.toString() || '');

  const kpiConfig = getLumiKPIConfig(campaign.objective);
  const primaryValue = campaign.metrics?.[kpiConfig.primary] as number | undefined;
  const status = getLumiKPIStatus(primaryValue, kpiConfig.benchmark, kpiConfig.primary);
  const statusColorClass = getLumiStatusColor(status);

  const handleSaveGoal = () => {
    const numValue = parseFloat(goalValue);
    if (!isNaN(numValue) && numValue > 0) {
      onUpdateGoal(numValue);
    }
    setEditingGoal(false);
  };

  // Extract positive signals (what's working)
  const whatsWorking = analysis?.kpi_evaluation 
    ? Object.entries(analysis.kpi_evaluation)
        .filter(([_, kpi]) => kpi.status === 'excellent' || kpi.status === 'healthy')
        .map(([key, kpi]) => kpi.reason)
        .slice(0, 3)
    : [];

  // Extract negative signals (what needs attention)
  const needsAttention = analysis?.kpi_evaluation
    ? Object.entries(analysis.kpi_evaluation)
        .filter(([_, kpi]) => kpi.status === 'needs attention' || kpi.status === 'critical')
        .map(([key, kpi]) => kpi.reason)
        .slice(0, 3)
    : [];

  // Limit next steps to 2-3
  const nextSteps = (analysis?.next_steps || []).slice(0, 3);

  return (
    <div className="space-y-6 pb-12">
      {/* Back Button & Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="rounded-xl"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Overview
        </Button>
      </div>

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

      {/* Campaign-Level Date Override */}
      <Card className="rounded-2xl border-[hsl(var(--fog-grey))] bg-white shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Date range for this campaign:</span>
            </div>
            <Select value={localDateRange} onValueChange={setLocalDateRange}>
              <SelectTrigger className="w-[200px] rounded-xl border-[hsl(var(--fog-grey))]">
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
          {localDateRange !== 'global' && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Viewing {dateRangeOptions.find(o => o.value === localDateRange)?.label.toLowerCase()} for this campaign only.
            </p>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <Card className="rounded-2xl animate-pulse">
          <CardContent className="p-12">
            <div className="h-48 bg-muted rounded-xl" />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* SECTION 1: Primary KPI Card */}
          <Card className={`rounded-2xl border-2 ${statusColorClass} shadow-[var(--shadow-card)]`}>
            <CardContent className="p-8">
              <div className="flex flex-col lg:flex-row lg:items-center gap-8">
                {/* Main KPI Display */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    {status === 'healthy' && <CheckCircle2 className="h-8 w-8 text-green-600" />}
                    {status === 'attention' && <AlertTriangle className="h-8 w-8 text-amber-600" />}
                    {status === 'critical' && <AlertTriangle className="h-8 w-8 text-red-600" />}
                    <div>
                      <p className="text-sm uppercase tracking-wider text-muted-foreground font-medium">
                        Primary KPI: {kpiConfig.primaryLabel}
                      </p>
                      <p className="text-5xl font-bold mt-1">
                        {formatLumiKPIValue(primaryValue, kpiConfig.primary)}
                      </p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground italic">
                    This is your most important signal — Lumi monitors this automatically.
                  </p>
                </div>

                {/* Benchmark & Goal */}
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="space-y-1 p-4 rounded-xl bg-white/50">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Benchmark</p>
                    <p className="text-xl font-semibold">
                      {kpiConfig.benchmark.unit}{kpiConfig.benchmark.min} – {kpiConfig.benchmark.unit}{kpiConfig.benchmark.max}
                    </p>
                  </div>

                  <div className="space-y-1 p-4 rounded-xl bg-white/50">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Your Goal</p>
                    {editingGoal ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={goalValue}
                          onChange={(e) => setGoalValue(e.target.value)}
                          className="w-24 h-9 rounded-lg"
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-green-600" onClick={handleSaveGoal}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setEditingGoal(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setEditingGoal(true)}
                        className="flex items-center gap-2 text-xl font-semibold hover:text-[hsl(var(--lumi-orange-1))] transition-colors group"
                      >
                        {campaign.userGoal ? (
                          <span>{kpiConfig.benchmark.unit}{campaign.userGoal}</span>
                        ) : (
                          <span className="text-muted-foreground">Set goal</span>
                        )}
                        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 2: What's Working */}
          {whatsWorking.length > 0 && (
            <Card className="rounded-2xl border-[hsl(var(--fog-grey))] bg-white shadow-[var(--shadow-card)]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Here's where you're glowing ✨
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {whatsWorking.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-green-50/50 border border-green-100">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">{item}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* SECTION 3: What Needs Attention */}
          {needsAttention.length > 0 && (
            <Card className="rounded-2xl border-[hsl(var(--fog-grey))] bg-white shadow-[var(--shadow-card)]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingDown className="h-5 w-5 text-amber-600" />
                  Here's where we can brighten things up
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {needsAttention.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/50 border border-amber-100">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">{item}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* SECTION 4: Customer Journey Performance */}
          {analysis?.journey_diagnosis && (
            <Card className="rounded-2xl border-[hsl(var(--fog-grey))] bg-white shadow-[var(--shadow-card)]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Heart className="h-5 w-5 text-[hsl(var(--lumi-orange-1))]" />
                  Customer Journey Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-[hsl(var(--warm-white))] border border-[hsl(var(--fog-grey))]">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="rounded-full bg-green-50 text-green-700 border-green-200">
                      Grow
                    </Badge>
                    <span className="text-xs text-muted-foreground">Attract new people and spark interest</span>
                  </div>
                  <p className="text-sm">{analysis.journey_diagnosis.grow || 'No data yet'}</p>
                </div>

                <div className="p-4 rounded-xl bg-[hsl(var(--warm-white))] border border-[hsl(var(--fog-grey))]">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="rounded-full bg-amber-50 text-amber-700 border-amber-200">
                      Nurture
                    </Badge>
                    <span className="text-xs text-muted-foreground">Build trust and deepen understanding</span>
                  </div>
                  <p className="text-sm">{analysis.journey_diagnosis.nurture || 'No data yet'}</p>
                </div>

                <div className="p-4 rounded-xl bg-[hsl(var(--warm-white))] border border-[hsl(var(--fog-grey))]">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="rounded-full bg-blue-50 text-blue-700 border-blue-200">
                      Convert
                    </Badge>
                    <span className="text-xs text-muted-foreground">Guide ready people to take action</span>
                  </div>
                  <p className="text-sm">{analysis.journey_diagnosis.convert || 'No data yet'}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SECTION 5: Creative Warmth & Fatigue */}
          {analysis?.creative_diagnosis && analysis.creative_diagnosis.problem && (
            <Card className="rounded-2xl border-[hsl(var(--fog-grey))] bg-white shadow-[var(--shadow-card)]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <RefreshCw className="h-5 w-5 text-[hsl(var(--lumi-orange-1))]" />
                  Creative Warmth & Fatigue
                </CardTitle>
                <CardDescription>
                  Some of your creative is getting tired — Lumi recommends refreshing one piece.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="rounded-xl border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    {analysis.creative_diagnosis.problem}
                  </AlertDescription>
                </Alert>

                {analysis.creative_diagnosis.recommended_creatives_to_refresh?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Consider refreshing:</p>
                    <ul className="space-y-2">
                      {analysis.creative_diagnosis.recommended_creatives_to_refresh.slice(0, 2).map((item, i) => (
                        <li key={i} className="text-sm flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                          <RefreshCw className="h-4 w-4 text-[hsl(var(--lumi-orange-1))] flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* SECTION 6: Lumi Recommends (2-3 steps only) */}
          {nextSteps.length > 0 && (
            <Card className="rounded-2xl border-2 border-[hsl(var(--lumi-orange-1)/0.3)] bg-gradient-to-br from-[hsl(var(--lumi-orange-1)/0.05)] to-transparent shadow-[var(--shadow-card)]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lightbulb className="h-5 w-5 text-[hsl(var(--lumi-orange-1))]" />
                  Lumi's got you — here's what to do next
                </CardTitle>
                <CardDescription>
                  Take these {nextSteps.length} steps this week for better results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {nextSteps.map((step, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 rounded-xl bg-white border border-[hsl(var(--fog-grey))]">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[hsl(var(--lumi-orange-1))] text-white flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <p className="flex-1 pt-1">{step}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
