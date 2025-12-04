import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format, subDays, startOfDay, endOfDay, startOfYesterday, endOfYesterday } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  ArrowLeft,
  CalendarIcon, 
  Lightbulb,
  Check,
  AlertTriangle,
  XCircle,
  Link2Off,
  RefreshCw,
  Sparkles,
  Heart,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Zap,
  Info
} from 'lucide-react';
import { 
  getLumiKPIConfig, 
  getLumiStatus, 
  formatLumiKPIValue, 
  formatBenchmark 
} from '@/lib/lumi-kpi-config';

interface PerformanceAnalysis {
  kpi_evaluation: {
    ctr: { value: number; status: string; benchmark: string; reason: string };
    cpc: { value: number; status: string; benchmark: string; reason: string };
    cpm: { value: number; status: string; benchmark: string; reason: string };
    frequency: { value: number; status: string; benchmark: string; reason: string };
    cpl_cpp: { value: number; status: string; benchmark: string; reason: string };
    roas: { value: number; status: string; benchmark: string; reason: string };
  };
  journey_diagnosis: {
    grow: string;
    nurture: string;
    convert: string;
  };
  creative_diagnosis: {
    problem: string;
    cause: string;
    recommended_creatives_to_add: string[];
    recommended_creatives_to_refresh: string[];
    why_it_works: string;
  };
  warm_audience_health: {
    size: string;
    stability: string;
    notes: string;
    recommendation: string;
  };
  next_steps: string[];
  creative_refresh_suggestions: Array<{
    type: string;
    hook_pattern: string;
    script_starter: string;
    b_roll: string;
    why_it_works: string;
  }>;
}

type DatePreset = 'today' | 'yesterday' | 'last3' | 'last7' | 'last14' | 'custom';

export default function InsightsDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workspaceId = searchParams.get('workspace');

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [workspace, setWorkspace] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [metaConnected, setMetaConnected] = useState(false);
  const [metaTokenExpired, setMetaTokenExpired] = useState(false);
  const [userGoal, setUserGoal] = useState<number | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);

  // Campaign-level date selection
  const [datePreset, setDatePreset] = useState<DatePreset>('last7');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [isCustomDate, setIsCustomDate] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      fetchWorkspace();
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspace && !loading) {
      fetchPerformanceData();
    }
  }, [dateRange, workspace?.id]);

  const getDateRangeFromPreset = (preset: DatePreset): { from: Date; to: Date } => {
    const now = new Date();
    switch (preset) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case 'yesterday':
        return { from: startOfYesterday(), to: endOfYesterday() };
      case 'last3':
        return { from: subDays(now, 3), to: now };
      case 'last7':
        return { from: subDays(now, 7), to: now };
      case 'last14':
        return { from: subDays(now, 14), to: now };
      default:
        return { from: subDays(now, 7), to: now };
    }
  };

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    setIsCustomDate(preset === 'custom');
    if (preset !== 'custom') {
      setDateRange(getDateRangeFromPreset(preset));
    }
  };

  const fetchWorkspace = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: brand } = await supabase
        .from('brands')
        .select('id, meta_access_token, meta_account_id')
        .eq('user_id', user.id)
        .single();

      if (!brand) return;
      setMetaConnected(!!(brand.meta_access_token && brand.meta_account_id));

      const { data, error } = await supabase
        .from('campaign_workspaces')
        .select(`
          id, 
          name, 
          meta_campaign_ids, 
          template_id,
          campaign_templates!campaign_workspaces_template_id_fkey (
            id,
            name,
            objective
          )
        `)
        .eq('id', workspaceId)
        .single();

      if (error) throw error;
      setWorkspace(data);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching workspace:', error);
      toast.error('Failed to load campaign');
      setLoading(false);
    }
  };

  const fetchPerformanceData = async () => {
    if (!workspaceId || !metaConnected) return;

    setSyncing(true);

    try {
      const { data: metricsData, error: metricsError } = await supabase.functions.invoke(
        'fetch-meta-performance',
        {
          body: {
            workspaceId,
            dateRangeStart: format(dateRange.from, 'yyyy-MM-dd'),
            dateRangeEnd: format(dateRange.to, 'yyyy-MM-dd'),
          },
        }
      );

      const responseError = metricsData?.error || '';
      if (responseError.includes('Error validating access token') || 
          responseError.includes('session has been invalidated')) {
        setMetaTokenExpired(true);
        setSyncing(false);
        return;
      }

      if (metricsError || metricsData?.error) {
        throw new Error(metricsData?.error || metricsError?.message);
      }

      setMetaTokenExpired(false);

      if (metricsData?.metrics) {
        setMetrics(metricsData.metrics);
        setAnalyzing(true);

        const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
          'analyze-performance',
          {
            body: {
              workspaceId,
              metricsData: metricsData.metrics,
            },
          }
        );

        if (!analysisError && analysisData?.analysis) {
          setAnalysis(analysisData.analysis);
        }
      }
    } catch (error: any) {
      console.error('Error fetching performance:', error);
      toast.error('Failed to fetch performance data');
    } finally {
      setSyncing(false);
      setAnalyzing(false);
    }
  };

  const campaignType = (workspace?.campaign_templates as any)?.objective || 
                       (workspace?.campaign_templates as any)?.name || null;
  const kpiConfig = getLumiKPIConfig(campaignType);

  // Get primary KPI value from metrics
  const getPrimaryKPIValue = (): number | null => {
    if (!metrics) return null;
    const key = kpiConfig.primaryKPI;
    if (key === 'cpl' || key === 'cpp') return metrics.cpl || metrics.cpp;
    if (key === 'roas') return metrics.roas;
    if (key === 'cpc') return metrics.cpc;
    if (key === 'cpm') return metrics.cpm;
    if (key === 'cpv') return metrics.videoViews > 0 ? metrics.spend / metrics.videoViews : null;
    return null;
  };

  const primaryKPIValue = getPrimaryKPIValue();
  const isLowerBetter = kpiConfig.primaryKPI !== 'roas';
  const status = primaryKPIValue !== null 
    ? getLumiStatus(primaryKPIValue, kpiConfig.benchmark, isLowerBetter)
    : 'healthy';

  const getStatusStyles = (s: string) => {
    switch (s) {
      case 'healthy':
      case 'excellent':
        return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: <Check className="h-6 w-6 text-green-600" /> };
      case 'attention':
      case 'needs attention':
        return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: <AlertTriangle className="h-6 w-6 text-amber-600" /> };
      case 'critical':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: <XCircle className="h-6 w-6 text-red-600" /> };
      default:
        return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', icon: <Info className="h-6 w-6 text-gray-600" /> };
    }
  };

  const styles = getStatusStyles(status);

  // Extract what's working vs needs attention from analysis
  const getWhatsWorking = () => {
    if (!analysis?.kpi_evaluation) return [];
    const working: string[] = [];
    Object.entries(analysis.kpi_evaluation).forEach(([key, kpi]) => {
      if (kpi.status === 'excellent' || kpi.status === 'healthy') {
        working.push(kpi.reason);
      }
    });
    return working.slice(0, 3);
  };

  const getWhatsNeedsAttention = () => {
    if (!analysis?.kpi_evaluation) return [];
    const attention: string[] = [];
    Object.entries(analysis.kpi_evaluation).forEach(([key, kpi]) => {
      if (kpi.status === 'needs attention' || kpi.status === 'critical') {
        attention.push(kpi.reason);
      }
    });
    return attention.slice(0, 3);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-48 rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="pt-8 text-center">
          <p className="text-muted-foreground">Campaign not found</p>
          <Button onClick={() => navigate('/data')} className="mt-4 rounded-xl">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Insights
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Meta Token Expired Alert */}
      {metaTokenExpired && (
        <Alert variant="destructive" className="rounded-2xl">
          <Link2Off className="h-4 w-4" />
          <AlertTitle>Meta Connection Expired</AlertTitle>
          <AlertDescription className="flex items-center gap-3">
            <span>Let's get you reconnected!</span>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => navigate('/dashboard')}>
              Reconnect Meta
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Back Button & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-xl"
            onClick={() => navigate('/data')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            All Campaigns
          </Button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'hsl(0 0% 7%)' }}>
              {workspace.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {campaignType || 'Campaign'} Insights
            </p>
          </div>
        </div>
        
        <Button
          onClick={fetchPerformanceData}
          disabled={syncing || analyzing}
          size="sm"
          variant="outline"
          className="rounded-xl"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : analyzing ? 'Analyzing...' : 'Refresh'}
        </Button>
      </div>

      {/* Campaign-Level Date Selector */}
      <Card className="rounded-2xl" style={{ backgroundColor: 'hsl(0 0% 100%)' }}>
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <CalendarIcon className="h-5 w-5 text-muted-foreground hidden sm:block" />
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'today', label: 'Today' },
                { key: 'yesterday', label: 'Yesterday' },
                { key: 'last3', label: 'Last 3 days' },
                { key: 'last7', label: 'Last 7 days' },
                { key: 'last14', label: 'Last 14 days' },
              ].map(({ key, label }) => (
                <Button
                  key={key}
                  size="sm"
                  variant={datePreset === key ? 'default' : 'outline'}
                  className="rounded-xl"
                  style={datePreset === key ? { backgroundColor: 'hsl(24 80% 55%)' } : {}}
                  onClick={() => handleDatePresetChange(key as DatePreset)}
                >
                  {label}
                </Button>
              ))}
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant={datePreset === 'custom' ? 'default' : 'outline'}
                    className="rounded-xl"
                    style={datePreset === 'custom' ? { backgroundColor: 'hsl(24 80% 55%)' } : {}}
                  >
                    Custom
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl" align="end">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDatePreset('custom');
                        setIsCustomDate(true);
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {isCustomDate && (
            <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Viewing {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')} for this campaign only.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 1: Primary KPI Card */}
      <Card className={`rounded-2xl border-2 ${styles.border}`} style={{ backgroundColor: styles.bg.replace('bg-', '') }}>
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <Lightbulb className="h-6 w-6" style={{ color: 'hsl(42 88% 67%)' }} />
                <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Primary Signal
                </span>
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'hsl(0 0% 7%)' }}>
                {kpiConfig.primaryKPILabel}
              </h2>
              <p className="text-muted-foreground">
                {kpiConfig.friendlyDescription}
              </p>
              <p className="text-sm text-muted-foreground mt-4 italic">
                This is your most important signal — Lumi monitors this automatically.
              </p>
            </div>

            <div className="flex flex-col items-center lg:items-end gap-4 p-6 rounded-2xl bg-white/80 min-w-[240px]">
              {syncing ? (
                <Skeleton className="h-16 w-32 rounded-xl" />
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-5xl font-bold" style={{ color: 'hsl(0 0% 7%)' }}>
                      {formatLumiKPIValue(primaryKPIValue, kpiConfig.primaryKPI)}
                    </span>
                    {styles.icon}
                  </div>
                  
                  <div className="text-center lg:text-right space-y-2">
                    <div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Benchmark: </span>
                      <span className="font-medium">{formatBenchmark(kpiConfig.benchmark)}</span>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Your Goal: </span>
                      {editingGoal ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={userGoal || ''}
                          onChange={(e) => setUserGoal(parseFloat(e.target.value) || null)}
                          onBlur={() => setEditingGoal(false)}
                          className="w-24 h-8 inline-block ml-2 rounded-lg"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => setEditingGoal(true)}
                          className="font-medium hover:underline ml-1"
                          style={{ color: userGoal ? 'hsl(0 0% 7%)' : 'hsl(24 80% 55%)' }}
                        >
                          {userGoal ? formatLumiKPIValue(userGoal, kpiConfig.primaryKPI) : 'Set goal'}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <Badge 
                    className={`${styles.bg} ${styles.text} ${styles.border} rounded-xl px-4 py-1`}
                    variant="outline"
                  >
                    {status === 'healthy' && '✓ Looking great!'}
                    {status === 'attention' && '⚠ Needs a little love'}
                    {status === 'critical' && '✗ Time to improve this'}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <>
          {/* Section 2: What's Working */}
          {getWhatsWorking().length > 0 && (
            <Card className="rounded-2xl border-2 border-green-200" style={{ backgroundColor: 'hsl(142 76% 97%)' }}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-green-100">
                    <Heart className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg" style={{ color: 'hsl(0 0% 7%)' }}>
                      Here's where you're glowing
                    </CardTitle>
                    <CardDescription>What's working well for this campaign</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {getWhatsWorking().map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm" style={{ color: 'hsl(0 0% 20%)' }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Section 3: What Needs Attention */}
          {getWhatsNeedsAttention().length > 0 && (
            <Card className="rounded-2xl border-2 border-amber-200" style={{ backgroundColor: 'hsl(48 100% 97%)' }}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-100">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg" style={{ color: 'hsl(0 0% 7%)' }}>
                      Here's where we can brighten things up
                    </CardTitle>
                    <CardDescription>Areas that could use some attention</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {getWhatsNeedsAttention().map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm" style={{ color: 'hsl(0 0% 20%)' }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Section 4: Customer Journey Performance */}
          {analysis.journey_diagnosis && (
            <Card className="rounded-2xl" style={{ backgroundColor: 'hsl(0 0% 100%)' }}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl" style={{ backgroundColor: 'hsl(42 88% 67% / 0.2)' }}>
                    <Users className="h-5 w-5" style={{ color: 'hsl(24 80% 55%)' }} />
                  </div>
                  <div>
                    <CardTitle className="text-lg" style={{ color: 'hsl(0 0% 7%)' }}>
                      Customer Journey Performance
                    </CardTitle>
                    <CardDescription>How people move through your funnel</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border-2" style={{ borderColor: 'hsl(30 14% 90%)', backgroundColor: 'hsl(36 43% 98%)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="h-4 w-4" style={{ color: 'hsl(24 80% 55%)' }} />
                      <span className="font-semibold text-sm">Grow</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{analysis.journey_diagnosis.grow}</p>
                  </div>
                  <div className="p-4 rounded-xl border-2" style={{ borderColor: 'hsl(30 14% 90%)', backgroundColor: 'hsl(36 43% 98%)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="h-4 w-4" style={{ color: 'hsl(33 82% 61%)' }} />
                      <span className="font-semibold text-sm">Nurture</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{analysis.journey_diagnosis.nurture}</p>
                  </div>
                  <div className="p-4 rounded-xl border-2" style={{ borderColor: 'hsl(30 14% 90%)', backgroundColor: 'hsl(36 43% 98%)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4" style={{ color: 'hsl(42 88% 67%)' }} />
                      <span className="font-semibold text-sm">Convert</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{analysis.journey_diagnosis.convert}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section 5: Creative Warmth & Fatigue */}
          {analysis.creative_diagnosis && (
            <Card className="rounded-2xl" style={{ backgroundColor: 'hsl(0 0% 100%)' }}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl" style={{ backgroundColor: 'hsl(24 80% 55% / 0.1)' }}>
                    <Sparkles className="h-5 w-5" style={{ color: 'hsl(24 80% 55%)' }} />
                  </div>
                  <div>
                    <CardTitle className="text-lg" style={{ color: 'hsl(0 0% 7%)' }}>
                      Creative Warmth & Fatigue
                    </CardTitle>
                    <CardDescription>
                      {analysis.creative_diagnosis.recommended_creatives_to_refresh?.length > 0 
                        ? "Some of your creative is getting tired — Lumi recommends refreshing one piece."
                        : "Your creative is performing well!"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis.creative_diagnosis.problem && (
                  <div className="p-4 rounded-xl" style={{ backgroundColor: 'hsl(36 43% 98%)' }}>
                    <p className="text-sm" style={{ color: 'hsl(0 0% 20%)' }}>
                      <strong>What Lumi sees:</strong> {analysis.creative_diagnosis.problem}
                    </p>
                    {analysis.creative_diagnosis.cause && (
                      <p className="text-sm text-muted-foreground mt-2">
                        <strong>Why:</strong> {analysis.creative_diagnosis.cause}
                      </p>
                    )}
                  </div>
                )}
                
                {analysis.creative_diagnosis.recommended_creatives_to_refresh?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Consider refreshing:</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.creative_diagnosis.recommended_creatives_to_refresh.map((item, i) => (
                        <Badge key={i} variant="outline" className="rounded-xl">{item}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Section 6: Lumi Recommends */}
          {analysis.next_steps && analysis.next_steps.length > 0 && (
            <Card className="rounded-2xl border-2" style={{ borderColor: 'hsl(24 80% 55%)', backgroundColor: 'hsl(24 80% 55% / 0.05)' }}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl" style={{ backgroundColor: 'hsl(24 80% 55%)' }}>
                    <Lightbulb className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg" style={{ color: 'hsl(0 0% 7%)' }}>
                      Lumi's got you — here's what to do next
                    </CardTitle>
                    <CardDescription>Your top priorities right now</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {analysis.next_steps.slice(0, 3).map((step, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white"
                        style={{ backgroundColor: 'hsl(24 80% 55%)' }}
                      >
                        {i + 1}
                      </div>
                      <p className="text-sm pt-1" style={{ color: 'hsl(0 0% 20%)' }}>{step}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Loading State */}
      {(syncing || analyzing) && !analysis && (
        <Card className="rounded-2xl">
          <CardContent className="pt-8 pb-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: 'hsl(24 80% 55%)' }} />
            <p className="font-medium" style={{ color: 'hsl(0 0% 7%)' }}>
              {syncing ? 'Fetching your data from Meta...' : 'Lumi is analyzing your performance...'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">This may take a moment</p>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {!syncing && !analyzing && !metrics && !metaTokenExpired && (
        <Card className="rounded-2xl">
          <CardContent className="pt-8 pb-8 text-center">
            <Lightbulb className="h-8 w-8 mx-auto mb-4" style={{ color: 'hsl(42 88% 67%)' }} />
            <p className="font-medium" style={{ color: 'hsl(0 0% 7%)' }}>
              Ready to analyze!
            </p>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Click refresh to pull your latest performance data.
            </p>
            <Button onClick={fetchPerformanceData} className="rounded-xl" style={{ backgroundColor: 'hsl(24 80% 55%)' }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Fetch Data
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
