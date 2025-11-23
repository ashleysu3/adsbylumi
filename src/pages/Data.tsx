import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  CalendarIcon,
  Lightbulb,
  Target,
  Users,
  Sparkles,
  Download,
  Mail,
  ArrowRight,
  Info
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

interface PerformanceMetrics {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  leads: number;
  purchases: number;
  addToCart: number;
  cpl: number;
  cpp: number;
  roas: number | null;
  linkClicks: number;
  videoViews: number;
}

interface KPIStatus {
  value: number;
  status: 'excellent' | 'healthy' | 'needs attention' | 'critical';
  benchmark: string;
  reason: string;
}

interface PerformanceAnalysis {
  kpi_evaluation: {
    ctr: KPIStatus;
    cpc: KPIStatus;
    cpm: KPIStatus;
    frequency: KPIStatus;
    cpl_cpp: KPIStatus;
    roas: KPIStatus;
  };
  funnel_diagnosis: {
    tofu: string;
    mofu: string;
    bofu: string;
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
  seasonality_context: {
    quarter: string;
    expected_behavior: string;
    notes: string;
    recommendation: string;
  };
  offer_diagnosis: {
    type: string;
    issue: string;
    fix: string;
  };
  next_steps: string[];
  creative_refresh_suggestions: Array<{
    type: string;
    hook_pattern: string;
    script_starter: string;
    b_roll: string;
    why_it_works: string;
  }>;
  analyzed_at: string;
}

export default function Data() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workspaceIdFromUrl = searchParams.get('workspace');

  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(workspaceIdFromUrl || '');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [metaConnected, setMetaConnected] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  // Fetch workspaces on mount
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // Fetch data when workspace or date range changes
  useEffect(() => {
    if (selectedWorkspaceId) {
      fetchPerformanceData();
    }
  }, [selectedWorkspaceId, dateRange]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!selectedWorkspaceId) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const lastSync = lastSyncTime ? new Date(lastSyncTime).getTime() : 0;
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        // Only fetch if last sync was more than 5 minutes ago
        if (now - lastSync > fiveMinutes) {
          fetchPerformanceData(true);
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [selectedWorkspaceId, lastSyncTime]);

  const fetchWorkspaces = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: brand } = await supabase
        .from('brands')
        .select('id, meta_access_token, meta_account_id')
        .eq('user_id', user.id)
        .single();

      if (!brand) return;

      // Check if Meta is properly connected
      const isMetaConnected = !!(brand.meta_access_token && brand.meta_account_id);
      setMetaConnected(isMetaConnected);

      const { data, error } = await supabase
        .from('campaign_workspaces')
        .select('id, name, meta_campaign_ids, meta_insights_last_sync, performance_report_latest')
        .eq('brand_id', brand.id)
        .not('meta_campaign_ids', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setWorkspaces(data || []);
      if (data && data.length > 0 && !selectedWorkspaceId) {
        setSelectedWorkspaceId(data[0].id);
      }
    } catch (error: any) {
      console.error('Error fetching workspaces:', error);
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformanceData = async (silent = false) => {
    if (!selectedWorkspaceId) return;

    // Check if Meta is connected before attempting to fetch
    if (!metaConnected) {
      toast.error('Meta account not connected', {
        description: 'Please reconnect your Meta ad account in the Dashboard.',
        action: {
          label: 'Go to Dashboard',
          onClick: () => navigate('/dashboard'),
        },
      });
      return;
    }
    
    if (!silent) setSyncing(true);

    try {
      // Fetch Meta performance data
      const { data: metricsData, error: metricsError } = await supabase.functions.invoke(
        'fetch-meta-performance',
        {
          body: {
            workspaceId: selectedWorkspaceId,
            dateRangeStart: format(dateRange.from, 'yyyy-MM-dd'),
            dateRangeEnd: format(dateRange.to, 'yyyy-MM-dd'),
          },
        }
      );

      if (metricsError) {
        const errorMsg = metricsError.message || '';
        
        // Check if it's a Meta connection issue
        if (errorMsg.includes('Meta account not connected')) {
          toast.error('Meta account not connected', {
            description: 'Please connect your Meta ad account in the Dashboard to view performance data.',
            action: {
              label: 'Go to Dashboard',
              onClick: () => navigate('/dashboard'),
            },
          });
          return;
        }
        
        // Check if campaign uses placeholder ID or not published
        if (errorMsg.includes('placeholder ID') || errorMsg.includes('not been published') || errorMsg.includes('Invalid Meta campaign ID')) {
          toast.error('Campaign not built in Meta', {
            description: 'This campaign needs to be built and published to Meta before you can view performance data. Go to the campaign workspace and complete the build process.',
            action: {
              label: 'View Campaigns',
              onClick: () => navigate('/campaigns'),
            },
          });
          return;
        }
        
        // Check if Meta API error (campaign doesn't exist)
        if (errorMsg.includes('Meta API error') || errorMsg.includes('does not exist')) {
          toast.error('Campaign not found in Meta', {
            description: 'This campaign may have been deleted from Meta Ads Manager or the campaign ID is incorrect.',
          });
          return;
        }
        
        throw metricsError;
      }

      if (metricsData?.metrics) {
        setMetrics(metricsData.metrics);
        setLastSyncTime(new Date().toISOString());

        // Start analysis
        if (!silent) setAnalyzing(true);
        
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
          'analyze-performance',
          {
            body: {
              workspaceId: selectedWorkspaceId,
              metricsData: metricsData.metrics,
            },
          }
        );

        if (analysisError) throw analysisError;

        if (analysisData?.analysis) {
          setAnalysis(analysisData.analysis);
          if (!silent) {
            toast.success('Performance analysis complete!');
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching performance:', error);
      toast.error(error.message || 'Failed to fetch performance data');
    } finally {
      setSyncing(false);
      setAnalyzing(false);
    }
  };

  const generateWeeklyReport = async () => {
    if (!selectedWorkspaceId) return;

    try {
      const { data, error } = await supabase.functions.invoke('generate-weekly-report', {
        body: { workspaceId: selectedWorkspaceId },
      });

      if (error) throw error;

      toast.success('Weekly report generated!');
      
      // Show report in alert or download
      if (data?.report) {
        const blob = new Blob([data.report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `weekly-report-${format(new Date(), 'yyyy-MM-dd')}.txt`;
        a.click();
      }
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'healthy': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'needs attention': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'needs attention':
      case 'critical':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getProgressValue = (status: string) => {
    switch (status) {
      case 'excellent': return 100;
      case 'healthy': return 75;
      case 'needs attention': return 50;
      case 'critical': return 25;
      default: return 0;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (workspaces.length === 0) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>No Published Campaigns</CardTitle>
            <CardDescription>
              You need to publish a campaign to Meta before you can view performance data.
            </CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    );
  }

  const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);
  const isLive = lastSyncTime && (Date.now() - new Date(lastSyncTime).getTime()) < 2 * 60 * 1000;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Performance Dashboard</h1>
            <p className="text-muted-foreground">
              Real-time insights from Meta Ads with AI-powered recommendations
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {isLive && (
              <Badge variant="outline" className="gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Live
              </Badge>
            )}
            
            <Button
              onClick={() => fetchPerformanceData()}
              disabled={syncing || analyzing}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : analyzing ? 'Analyzing...' : 'Refresh'}
            </Button>

            <Button onClick={generateWeeklyReport} size="sm" variant="outline">
              <Mail className="h-4 w-4 mr-2" />
              Weekly Report
            </Button>
          </div>
        </div>

        {/* Campaign Selector & Date Range */}
        <Card>
          <CardContent className="pt-6">
            {!metaConnected && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Meta Account Not Connected</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>Your Meta ad account needs to be reconnected to view performance data.</span>
                  <Button onClick={() => navigate('/dashboard')} size="sm" variant="outline" className="ml-4">
                    Go to Dashboard
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Campaign</label>
                <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((workspace) => (
                      <SelectItem key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-[280px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from && dateRange.to ? (
                        <>
                          {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
                        </>
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <div className="p-3 space-y-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setDateRange({
                          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                          to: new Date(),
                        })}
                      >
                        Last 7 days
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setDateRange({
                          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                          to: new Date(),
                        })}
                      >
                        Last 30 days
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {lastSyncTime && (
              <p className="text-xs text-muted-foreground mt-3">
                Last synced: {format(new Date(lastSyncTime), 'MMM d, h:mm a')}
              </p>
            )}
          </CardContent>
        </Card>

        {syncing || analyzing ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="font-medium">
                    {syncing ? 'Fetching data from Meta...' : 'AI analyzing your performance...'}
                  </p>
                  <p className="text-sm text-muted-foreground">This may take a moment</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : !metrics || !analysis ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Click "Refresh" to load performance data</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(analysis.kpi_evaluation).map(([key, kpi]) => (
                <Card key={key} className={`border-2 ${getStatusColor(kpi.status)}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium uppercase tracking-wide">
                        {key === 'cpl_cpp' ? 'Cost per Result' : key.toUpperCase()}
                      </CardTitle>
                      {getStatusIcon(kpi.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">
                          {key.includes('cost') || key.includes('cp') ? '$' : ''}
                          {kpi.value?.toFixed(2) || '0.00'}
                          {key === 'ctr' ? '%' : ''}
                        </span>
                        {kpi.status === 'excellent' && <TrendingUp className="h-4 w-4 text-green-600" />}
                        {kpi.status === 'critical' && <TrendingDown className="h-4 w-4 text-red-600" />}
                      </div>
                      
                      <Progress value={getProgressValue(kpi.status)} className="h-2" />
                      
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Benchmark: {kpi.benchmark}
                        </p>
                        <p className="text-sm">{kpi.reason}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Top 3 Next Steps - Prominent */}
            <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Your Top 3 Next Steps
                </CardTitle>
                <CardDescription>Take these actions this week for better results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysis.next_steps.map((step, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <p className="flex-1 pt-1">{step}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Funnel Diagnosis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Funnel Health Diagnosis
                </CardTitle>
                <CardDescription>Performance analysis by funnel stage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">TOFU - Top of Funnel</Badge>
                      <span className="text-xs text-muted-foreground">Awareness Stage</span>
                    </div>
                    <p className="text-sm pl-4 border-l-2 border-primary/30">{analysis.funnel_diagnosis.tofu}</p>
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">MOFU - Middle of Funnel</Badge>
                      <span className="text-xs text-muted-foreground">Consideration Stage</span>
                    </div>
                    <p className="text-sm pl-4 border-l-2 border-primary/30">{analysis.funnel_diagnosis.mofu}</p>
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">BOFU - Bottom of Funnel</Badge>
                      <span className="text-xs text-muted-foreground">Conversion Stage</span>
                    </div>
                    <p className="text-sm pl-4 border-l-2 border-primary/30">{analysis.funnel_diagnosis.bofu}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Creative Diagnosis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    Creative Diagnosis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysis.creative_diagnosis.problem && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Issue Detected</AlertTitle>
                      <AlertDescription>{analysis.creative_diagnosis.problem}</AlertDescription>
                    </Alert>
                  )}

                  <div>
                    <h4 className="font-medium mb-2">Root Cause</h4>
                    <p className="text-sm text-muted-foreground">{analysis.creative_diagnosis.cause}</p>
                  </div>

                  {analysis.creative_diagnosis.recommended_creatives_to_add.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Add These Creatives</h4>
                      <ul className="space-y-1">
                        {analysis.creative_diagnosis.recommended_creatives_to_add.map((item, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <ArrowRight className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <p className="text-sm"><strong>Why this works:</strong> {analysis.creative_diagnosis.why_it_works}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Warm Audience Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Warm Audience Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Audience Size</p>
                      <p className="text-2xl font-bold">{analysis.warm_audience_health.size}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Stability</p>
                      <Badge variant={analysis.warm_audience_health.stability === 'Low' ? 'destructive' : 'default'}>
                        {analysis.warm_audience_health.stability}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Notes</h4>
                    <p className="text-sm text-muted-foreground">{analysis.warm_audience_health.notes}</p>
                  </div>

                  <Alert>
                    <Lightbulb className="h-4 w-4" />
                    <AlertTitle>Recommendation</AlertTitle>
                    <AlertDescription>{analysis.warm_audience_health.recommendation}</AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>

            {/* Seasonality Context */}
            {analysis.seasonality_context.notes && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Seasonality Context - {analysis.seasonality_context.quarter}</AlertTitle>
                <AlertDescription>
                  <p className="mb-2">{analysis.seasonality_context.notes}</p>
                  <p className="font-medium">{analysis.seasonality_context.recommendation}</p>
                </AlertDescription>
              </Alert>
            )}

            {/* Creative Refresh Suggestions */}
            {analysis.creative_refresh_suggestions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Creative Refresh Suggestions</CardTitle>
                  <CardDescription>AI-generated creative ideas based on your performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysis.creative_refresh_suggestions.map((suggestion, index) => (
                      <Card key={index}>
                        <CardHeader>
                          <CardTitle className="text-base">{suggestion.type}</CardTitle>
                          <Badge variant="outline">{suggestion.hook_pattern}</Badge>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div>
                            <strong>Script Starter:</strong>
                            <p className="text-muted-foreground italic">"{suggestion.script_starter}"</p>
                          </div>
                          <div>
                            <strong>B-Roll:</strong>
                            <p className="text-muted-foreground">{suggestion.b_roll}</p>
                          </div>
                          <div className="pt-2 border-t">
                            <strong>Why it works:</strong>
                            <p className="text-muted-foreground">{suggestion.why_it_works}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
