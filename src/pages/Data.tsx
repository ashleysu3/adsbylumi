import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format, subDays, startOfDay, endOfDay, startOfYesterday, endOfYesterday } from 'date-fns';
import { RefreshCw, Link2Off } from 'lucide-react';
import { InsightsHome } from '@/components/insights/InsightsHome';
import { CampaignInsightDetail } from '@/components/insights/CampaignInsightDetail';

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

interface CampaignData {
  id: string;
  name: string;
  templateName: string | null;
  objective: string | null;
  metrics: Record<string, number> | null;
  userGoal?: number | null;
}

export default function Data() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workspaceIdFromUrl = searchParams.get('workspace');

  // View state: 'home' or 'detail'
  const [view, setView] = useState<'home' | 'detail'>(workspaceIdFromUrl ? 'detail' : 'home');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(workspaceIdFromUrl);

  // Data state
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Meta connection state
  const [metaConnected, setMetaConnected] = useState(false);
  const [metaTokenExpired, setMetaTokenExpired] = useState(false);

  // Date range state
  const [globalDateRange, setGlobalDateRange] = useState<string>('7');

  // User goals stored locally (in real app, would be in DB)
  const [userGoals, setUserGoals] = useState<Record<string, number>>({});

  // Convert date range string to actual dates
  const getDateRange = (rangeValue: string): { from: Date; to: Date } => {
    const now = new Date();
    switch (rangeValue) {
      case '1':
        return { from: startOfDay(now), to: endOfDay(now) };
      case 'yesterday':
        return { from: startOfYesterday(), to: endOfYesterday() };
      case '3':
        return { from: subDays(now, 3), to: now };
      case '7':
        return { from: subDays(now, 7), to: now };
      case '14':
        return { from: subDays(now, 14), to: now };
      default:
        return { from: subDays(now, 7), to: now };
    }
  };

  // Fetch campaigns on mount
  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Refetch when date range changes
  useEffect(() => {
    if (campaigns.length > 0) {
      fetchAllMetrics();
    }
  }, [globalDateRange]);

  // Fetch campaign for detail view
  useEffect(() => {
    if (view === 'detail' && selectedCampaignId) {
      fetchCampaignDetail(selectedCampaignId);
    }
  }, [view, selectedCampaignId]);

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

      const isMetaConnected = !!(brand.meta_access_token && brand.meta_account_id);
      setMetaConnected(isMetaConnected);

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
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter published campaigns
      const publishedWorkspaces = (data || []).filter(workspace => {
        if (!workspace.meta_campaign_ids) return false;
        const campaignId = (workspace.meta_campaign_ids as any)?.campaignId;
        if (!campaignId) return false;
        if (typeof campaignId === 'string' && campaignId.includes('_')) {
          const parts = campaignId.split('_');
          const numericPart = parts[parts.length - 1];
          const timestamp = parseInt(numericPart);
          const now = Date.now();
          const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
          if (timestamp > oneYearAgo && timestamp <= now) return false;
        }
        if (workspace.meta_campaign_status === 'draft') return false;
        return true;
      });

      const campaignData: CampaignData[] = publishedWorkspaces.map(w => ({
        id: w.id,
        name: w.name,
        templateName: (w.campaign_templates as any)?.name || null,
        objective: (w.campaign_templates as any)?.objective || null,
        metrics: null,
        userGoal: userGoals[w.id] || null,
      }));

      setCampaigns(campaignData);

      // Fetch metrics for all campaigns
      if (isMetaConnected && campaignData.length > 0) {
        await fetchAllMetrics(campaignData);
      }
    } catch (error: any) {
      console.error('Error fetching campaigns:', error);
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMetrics = async (campaignList?: CampaignData[]) => {
    const list = campaignList || campaigns;
    if (list.length === 0) return;

    setSyncing(true);
    const dateRange = getDateRange(globalDateRange);

    try {
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

            // Check for token expiration
            const responseError = data?.error || '';
            if (responseError.includes('Error validating access token') || 
                responseError.includes('session has been invalidated')) {
              setMetaTokenExpired(true);
              return campaign;
            }

            if (error) {
              console.error(`Error fetching metrics for ${campaign.name}:`, error);
              return campaign;
            }

            return {
              ...campaign,
              metrics: data?.metrics || null,
              userGoal: userGoals[campaign.id] || null,
            };
          } catch (err) {
            console.error(`Error fetching metrics for ${campaign.name}:`, err);
            return campaign;
          }
        })
      );

      setCampaigns(updatedCampaigns);
      setMetaTokenExpired(false);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setSyncing(false);
    }
  };

  const fetchCampaignDetail = async (campaignId: string) => {
    setSyncing(true);
    const dateRange = getDateRange(globalDateRange);

    try {
      // Fetch metrics
      const { data: metricsData, error: metricsError } = await supabase.functions.invoke(
        'fetch-meta-performance',
        {
          body: {
            workspaceId: campaignId,
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

      if (metricsError) throw metricsError;

      // Update campaign metrics
      if (metricsData?.metrics) {
        setCampaigns(prev => prev.map(c => 
          c.id === campaignId 
            ? { ...c, metrics: metricsData.metrics }
            : c
        ));

        // Fetch analysis
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
          'analyze-performance',
          {
            body: {
              workspaceId: campaignId,
              metricsData: metricsData.metrics,
            },
          }
        );

        if (!analysisError && analysisData?.analysis) {
          setAnalysis(analysisData.analysis);
        }
      }

      setMetaTokenExpired(false);
    } catch (error: any) {
      console.error('Error fetching campaign detail:', error);
      const errorMsg = error?.message || '';
      if (errorMsg.includes('non-2xx status code') || errorMsg.includes('Edge Function')) {
        setMetaTokenExpired(true);
      } else {
        toast.error('Failed to load campaign insights');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleViewInsights = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setAnalysis(null);
    setView('detail');
  };

  const handleBackToHome = () => {
    setView('home');
    setSelectedCampaignId(null);
    setAnalysis(null);
  };

  const handleUpdateGoal = async (campaignId: string, goal: number) => {
    setUserGoals(prev => ({ ...prev, [campaignId]: goal }));
    setCampaigns(prev => prev.map(c => 
      c.id === campaignId ? { ...c, userGoal: goal } : c
    ));
    
    // In a real app, save to database here
    toast.success('Goal updated!');
  };

  const handleDateRangeChange = (range: string) => {
    setGlobalDateRange(range);
  };

  // Get selected campaign for detail view
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Meta Token Expired Alert */}
        {metaTokenExpired && (
          <Alert variant="destructive" className="mb-6 rounded-2xl border-destructive/50 bg-destructive/10">
            <Link2Off className="h-4 w-4" />
            <AlertTitle>Meta Connection Expired</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span>Your Meta access token has expired. Please reconnect to continue viewing insights.</span>
              <Button 
                size="sm" 
                variant="outline"
                className="w-fit border-destructive/50 hover:bg-destructive/20 rounded-xl"
                onClick={() => navigate('/dashboard')}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reconnect Meta
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Meta Not Connected Alert */}
        {!metaConnected && !loading && (
          <Alert className="mb-6 rounded-2xl border-amber-200 bg-amber-50">
            <AlertTitle className="text-amber-800">Connect your Meta account</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 text-amber-700">
              <span>Connect your Meta ad account to see campaign insights here.</span>
              <Button 
                size="sm" 
                variant="outline"
                className="w-fit rounded-xl"
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        {view === 'home' ? (
          <InsightsHome
            campaigns={campaigns}
            dateRange={globalDateRange}
            onDateRangeChange={handleDateRangeChange}
            onViewInsights={handleViewInsights}
            onUpdateGoal={handleUpdateGoal}
            isLoading={loading || syncing}
          />
        ) : selectedCampaign ? (
          <CampaignInsightDetail
            campaign={selectedCampaign}
            analysis={analysis}
            globalDateRange={globalDateRange}
            onBack={handleBackToHome}
            onUpdateGoal={(goal) => handleUpdateGoal(selectedCampaign.id, goal)}
            isLoading={syncing}
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Campaign not found</p>
            <Button onClick={handleBackToHome} className="mt-4">
              Back to Overview
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
