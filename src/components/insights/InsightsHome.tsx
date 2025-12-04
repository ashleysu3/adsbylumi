import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { format, subDays, startOfDay, endOfDay, startOfYesterday, endOfYesterday } from 'date-fns';
import { 
  ArrowRight, 
  CalendarIcon, 
  Lightbulb,
  Check,
  AlertTriangle,
  XCircle,
  Link2Off,
  RefreshCw
} from 'lucide-react';
import { 
  getLumiKPIConfig, 
  getLumiStatus, 
  formatLumiKPIValue, 
  formatBenchmark 
} from '@/lib/lumi-kpi-config';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

interface CampaignWithKPI {
  id: string;
  name: string;
  campaignType: string | null;
  primaryKPIKey: string;
  primaryKPILabel: string;
  primaryKPIValue: number | null;
  benchmark: { min: number; max: number; unit: string };
  userGoal: number | null;
  status: 'healthy' | 'attention' | 'critical';
  loading: boolean;
}

type DatePreset = 'today' | 'yesterday' | 'last3' | 'last7' | 'last14' | 'custom';

export default function InsightsHome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignWithKPI[]>([]);
  const [metaConnected, setMetaConnected] = useState(false);
  const [metaTokenExpired, setMetaTokenExpired] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Global date selection
  const [datePreset, setDatePreset] = useState<DatePreset>('last7');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  
  // User goals stored locally (will sync to DB)
  const [userGoals, setUserGoals] = useState<Record<string, number>>({});
  const [editingGoal, setEditingGoal] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (campaigns.length > 0 && !loading) {
      fetchAllKPIs();
    }
  }, [dateRange]);

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
    if (preset !== 'custom') {
      setDateRange(getDateRangeFromPreset(preset));
    }
  };

  const fetchCampaigns = async () => {
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
          meta_campaign_status,
          template_id,
          campaign_templates!campaign_workspaces_template_id_fkey (
            id,
            name,
            objective
          )
        `)
        .eq('brand_id', brand.id)
        .not('meta_campaign_ids', 'is', null)
        .neq('meta_campaign_status', 'draft')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter valid campaigns
      const validCampaigns = (data || []).filter(workspace => {
        const campaignId = (workspace.meta_campaign_ids as any)?.campaignId;
        if (!campaignId || typeof campaignId !== 'string') return false;
        if (campaignId.includes('_')) return false;
        return true;
      });

      // Initialize campaign data with KPI config
      const campaignsWithKPI: CampaignWithKPI[] = validCampaigns.map(workspace => {
        const campaignType = (workspace.campaign_templates as any)?.objective || 
                           (workspace.campaign_templates as any)?.name || null;
        const kpiConfig = getLumiKPIConfig(campaignType);
        
        return {
          id: workspace.id,
          name: workspace.name,
          campaignType,
          primaryKPIKey: kpiConfig.primaryKPI,
          primaryKPILabel: kpiConfig.primaryKPILabel,
          primaryKPIValue: null,
          benchmark: kpiConfig.benchmark,
          userGoal: userGoals[workspace.id] || null,
          status: 'healthy' as const,
          loading: true,
        };
      });

      setCampaigns(campaignsWithKPI);
      setLoading(false);
      
      // Fetch KPIs for all campaigns
      if (campaignsWithKPI.length > 0) {
        fetchAllKPIs(campaignsWithKPI);
      }
    } catch (error: any) {
      console.error('Error fetching campaigns:', error);
      toast.error('Failed to load campaigns');
      setLoading(false);
    }
  };

  const fetchAllKPIs = async (campaignList?: CampaignWithKPI[]) => {
    const list = campaignList || campaigns;
    if (!metaConnected || list.length === 0) return;

    setSyncing(true);

    // Update all campaigns to loading state
    setCampaigns(prev => prev.map(c => ({ ...c, loading: true })));

    // Fetch KPIs for each campaign
    const updatedCampaigns = await Promise.all(
      list.map(async (campaign) => {
        try {
          const { data, error } = await supabase.functions.invoke('fetch-meta-performance', {
            body: {
              workspaceId: campaign.id,
              dateRangeStart: format(dateRange.from, 'yyyy-MM-dd'),
              dateRangeEnd: format(dateRange.to, 'yyyy-MM-dd'),
            },
          });

          if (error || data?.error) {
            const errorMsg = data?.error || error?.message || '';
            if (errorMsg.includes('Error validating access token') || 
                errorMsg.includes('session has been invalidated')) {
              setMetaTokenExpired(true);
            }
            return { ...campaign, loading: false };
          }

          const metrics = data?.metrics;
          if (!metrics) return { ...campaign, loading: false };

          // Get the primary KPI value
          let kpiValue: number | null = null;
          const kpiKey = campaign.primaryKPIKey;
          
          if (kpiKey === 'cpl' || kpiKey === 'cpp') {
            kpiValue = metrics.cpl || metrics.cpp || null;
          } else if (kpiKey === 'roas') {
            kpiValue = metrics.roas;
          } else if (kpiKey === 'cpc') {
            kpiValue = metrics.cpc;
          } else if (kpiKey === 'cpm') {
            kpiValue = metrics.cpm;
          } else if (kpiKey === 'cpv') {
            // Estimate CPV from spend and video views
            kpiValue = metrics.videoViews > 0 ? metrics.spend / metrics.videoViews : null;
          }

          // Determine status
          const isLowerBetter = kpiKey !== 'roas';
          const status = kpiValue !== null 
            ? getLumiStatus(kpiValue, campaign.benchmark, isLowerBetter)
            : 'healthy';

          return {
            ...campaign,
            primaryKPIValue: kpiValue,
            status,
            loading: false,
          };
        } catch (err) {
          console.error(`Error fetching KPI for ${campaign.name}:`, err);
          return { ...campaign, loading: false };
        }
      })
    );

    setCampaigns(updatedCampaigns);
    setSyncing(false);
  };

  const handleGoalChange = (campaignId: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setUserGoals(prev => ({ ...prev, [campaignId]: numValue }));
      setCampaigns(prev => prev.map(c => 
        c.id === campaignId ? { ...c, userGoal: numValue } : c
      ));
    }
  };

  const getStatusStyles = (status: 'healthy' | 'attention' | 'critical') => {
    switch (status) {
      case 'healthy':
        return { 
          bg: 'bg-green-50', 
          border: 'border-green-200', 
          icon: <Check className="h-5 w-5 text-green-600" />,
          dot: 'bg-green-500'
        };
      case 'attention':
        return { 
          bg: 'bg-amber-50', 
          border: 'border-amber-200', 
          icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
          dot: 'bg-amber-500'
        };
      case 'critical':
        return { 
          bg: 'bg-red-50', 
          border: 'border-red-200', 
          icon: <XCircle className="h-5 w-5 text-red-600" />,
          dot: 'bg-red-500'
        };
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Card className="rounded-2xl border-2 border-dashed" style={{ backgroundColor: 'hsl(36 43% 98%)' }}>
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'hsl(42 88% 67% / 0.2)' }}>
            <Lightbulb className="h-8 w-8" style={{ color: 'hsl(24 80% 55%)' }} />
          </div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'hsl(0 0% 7%)' }}>
            Let's keep this simple.
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Build and publish a campaign to Meta to see your insights here. Lumi will monitor your most important metrics automatically.
          </p>
          <Button 
            onClick={() => navigate('/campaigns')} 
            className="rounded-xl"
            style={{ backgroundColor: 'hsl(24 80% 55%)' }}
          >
            <ArrowRight className="mr-2 h-4 w-4" />
            Create Your First Campaign
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Meta Token Expired Alert */}
      {metaTokenExpired && (
        <Alert variant="destructive" className="rounded-2xl border-destructive/50 bg-destructive/10">
          <Link2Off className="h-4 w-4" />
          <AlertTitle>Meta Connection Expired</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span>Your Meta access has expired. Let's get you reconnected!</span>
            <Button 
              size="sm" 
              variant="outline"
              className="w-fit rounded-xl"
              onClick={() => navigate('/dashboard')}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reconnect Meta
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Header with Lumi Voice */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'hsl(0 0% 7%)' }}>
            Lumi Insights
          </h1>
          <p className="text-muted-foreground">
            Let's keep this simple — here's the clearest signal for each campaign.
          </p>
        </div>
        
        <Button
          onClick={() => fetchAllKPIs()}
          disabled={syncing}
          size="sm"
          variant="outline"
          className="rounded-xl"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Refreshing...' : 'Refresh All'}
        </Button>
      </div>

      {/* Global Date Selector */}
      <Card className="rounded-2xl" style={{ backgroundColor: 'hsl(0 0% 100%)', boxShadow: 'var(--shadow-card)' }}>
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
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {datePreset === 'custom' && (
              <span className="text-sm text-muted-foreground">
                {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Campaign Cards */}
      <div className="space-y-4">
        {campaigns.map((campaign) => {
          const styles = getStatusStyles(campaign.status);
          
          return (
            <Card 
              key={campaign.id} 
              className={`rounded-2xl border-2 transition-all hover:shadow-lg ${styles.border}`}
              style={{ backgroundColor: 'hsl(0 0% 100%)' }}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                  {/* Campaign Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-3 h-3 rounded-full ${styles.dot}`} />
                      <h3 className="font-semibold text-lg truncate" style={{ color: 'hsl(0 0% 7%)' }}>
                        {campaign.name}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Primary KPI: {campaign.primaryKPILabel}
                    </p>
                  </div>

                  {/* KPI Display */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 lg:gap-8">
                    {/* Primary KPI Value */}
                    <div className="text-center sm:text-left">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Current</p>
                      {campaign.loading ? (
                        <Skeleton className="h-10 w-24 rounded-lg" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-3xl font-bold" style={{ color: 'hsl(0 0% 7%)' }}>
                            {formatLumiKPIValue(campaign.primaryKPIValue, campaign.primaryKPIKey)}
                          </span>
                          {styles.icon}
                        </div>
                      )}
                    </div>

                    {/* Benchmark */}
                    <div className="text-center sm:text-left">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Benchmark</p>
                      <span className="text-lg font-medium text-muted-foreground">
                        {formatBenchmark(campaign.benchmark)}
                      </span>
                    </div>

                    {/* User Goal */}
                    <div className="text-center sm:text-left min-w-[100px]">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Your Goal</p>
                      {editingGoal === campaign.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={campaign.userGoal || ''}
                          onChange={(e) => handleGoalChange(campaign.id, e.target.value)}
                          onBlur={() => setEditingGoal(null)}
                          onKeyDown={(e) => e.key === 'Enter' && setEditingGoal(null)}
                          className="w-24 h-8 text-center rounded-lg"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => setEditingGoal(campaign.id)}
                          className="text-lg font-medium hover:underline"
                          style={{ color: campaign.userGoal ? 'hsl(0 0% 7%)' : 'hsl(0 0% 60%)' }}
                        >
                          {campaign.userGoal 
                            ? formatLumiKPIValue(campaign.userGoal, campaign.primaryKPIKey)
                            : 'Set goal'}
                        </button>
                      )}
                    </div>

                    {/* View Button */}
                    <Button
                      onClick={() => navigate(`/data?workspace=${campaign.id}`)}
                      className="rounded-xl whitespace-nowrap"
                      style={{ backgroundColor: 'hsl(24 80% 55%)' }}
                    >
                      View Insights
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Lumi Footer Message */}
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground">
          <Lightbulb className="h-4 w-4 inline mr-1" style={{ color: 'hsl(42 88% 67%)' }} />
          Lumi's got you — click any campaign to see what to do next.
        </p>
      </div>
    </div>
  );
}
