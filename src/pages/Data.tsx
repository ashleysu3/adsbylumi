import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, subDays, startOfDay, endOfDay, startOfYesterday, endOfYesterday } from 'date-fns';
import { RefreshCw, Link2Off, CheckCircle2, AlertTriangle, Link2, Download } from 'lucide-react';
import { InsightsHome } from '@/components/insights/InsightsHome';
import { CampaignInsightDetail } from '@/components/insights/CampaignInsightDetail';
import { ResultsEmptyState } from '@/components/insights/ResultsEmptyState';
import { useLumiAssistant } from '@/components/LumiAssistant';
import { MetaConnectionAlert, MetaConnectionBanner } from '@/components/MetaConnectionAlert';
import { ImportCampaignsModal } from '@/components/insights/ImportCampaignsModal';
import { useBrand } from '@/contexts/BrandContext';

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
  previousMetrics?: Record<string, number> | null;
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

export default function Data() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workspaceIdFromUrl = searchParams.get('workspace');
  const { setRecommendation } = useLumiAssistant();
  const { activeBrand, loading: brandLoading } = useBrand();

  // View state: 'home' or 'detail'
  const [view, setView] = useState<'home' | 'detail'>(workspaceIdFromUrl ? 'detail' : 'home');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(workspaceIdFromUrl);

  // Detail level preference
  const [detailLevel, setDetailLevel] = useState<'simple' | 'detailed'>(() => {
    return (localStorage.getItem('lumi-insights-detail-level') as 'simple' | 'detailed') || 'simple';
  });

  // Data state
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Meta connection state - derived from activeBrand
  const metaConnected = !!activeBrand?.meta_account_id;
  const [metaTokenExpired, setMetaTokenExpired] = useState(false);
  const brandId = activeBrand?.id || null;
  const metaAccountId = activeBrand?.meta_account_id || null;
  const [tokenExpirationChecked, setTokenExpirationChecked] = useState(false);

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Account metrics state
  const [accountMetrics, setAccountMetrics] = useState<AccountMetrics | null>(null);
  const [accountMetricsLoading, setAccountMetricsLoading] = useState(false);

  // Date range state
  const [globalDateRange, setGlobalDateRange] = useState<string>('7');
  const [detailDateRange, setDetailDateRange] = useState<string>('7');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date; to: Date } | null>(null);

  // User goals stored locally and loaded from DB
  const [userGoals, setUserGoals] = useState<Record<string, number>>({});

  // Contextual Lumi recommendations
  useEffect(() => {
    if (loading) return;

    // Priority 1: Meta not connected
    if (!metaConnected) {
      setRecommendation({
        id: "data-connect-meta",
        title: "Connect Meta to See Insights",
        message: "Link your Meta ad account to unlock real-time performance data and AI-powered optimization recommendations.",
        actionLabel: "Go to Dashboard",
        onAction: () => navigate("/dashboard"),
      });
      return;
    }

    // Priority 2: Token expired
    if (metaTokenExpired) {
      setRecommendation({
        id: "data-reconnect-meta",
        title: "Meta Connection Expired",
        message: "Your access token has expired. Reconnect to continue tracking your campaign performance.",
        actionLabel: "Reconnect",
        onAction: () => navigate("/dashboard"),
      });
      return;
    }

    // Priority 3: No campaigns
    if (campaigns.length === 0) {
      setRecommendation({
        id: "data-no-campaigns",
        title: "No Live Campaigns Yet",
        message: "Publish your first campaign to start tracking performance and get AI-powered insights.",
        actionLabel: "Create Campaign",
        onAction: () => navigate("/create"),
      });
      return;
    }

    // Priority 4: Analyze campaign performance
    const campaignsWithMetrics = campaigns.filter(c => c.metrics);
    if (campaignsWithMetrics.length > 0) {
      // Find campaigns with low CTR
      const lowCtrCampaign = campaignsWithMetrics.find(c => {
        const ctr = c.metrics?.ctr || 0;
        return ctr < 1.0 && ctr > 0;
      });

      if (lowCtrCampaign) {
        setRecommendation({
          id: `data-low-ctr-${lowCtrCampaign.id}`,
          title: "CTR Below Benchmark",
          message: `"${lowCtrCampaign.name}" has a ${(lowCtrCampaign.metrics?.ctr || 0).toFixed(2)}% CTR. This is below the 1% benchmark — your creative might need a refresh.`,
          actionLabel: "View Insights",
          onAction: () => handleViewInsights(lowCtrCampaign.id),
        });
        return;
      }

      // Find campaigns with high frequency (creative fatigue)
      const fatigueRisk = campaignsWithMetrics.find(c => {
        const frequency = c.metrics?.frequency || 0;
        return frequency >= 3;
      });

      if (fatigueRisk) {
        setRecommendation({
          id: `data-fatigue-${fatigueRisk.id}`,
          title: "Creative Fatigue Alert",
          message: `"${fatigueRisk.name}" has a frequency of ${(fatigueRisk.metrics?.frequency || 0).toFixed(1)}. Your audience is seeing ads too often — time to add fresh creative.`,
          actionLabel: "View Insights",
          onAction: () => handleViewInsights(fatigueRisk.id),
        });
        return;
      }

      // Good performance - celebrate
      const topPerformer = campaignsWithMetrics.find(c => {
        const roas = c.metrics?.roas || 0;
        return roas >= 3;
      });

      if (topPerformer) {
        setRecommendation({
          id: `data-winning-${topPerformer.id}`,
          title: "You Have a Winner! 🎉",
          message: `"${topPerformer.name}" is crushing it with ${(topPerformer.metrics?.roas || 0).toFixed(1)}x ROAS! Consider scaling your budget to maximize returns.`,
          actionLabel: "View Insights",
          onAction: () => handleViewInsights(topPerformer.id),
        });
      }
    }
  }, [loading, metaConnected, metaTokenExpired, campaigns, setRecommendation, navigate]);

  // Convert date range string to actual dates
  const getDateRange = (rangeValue: string, custom?: { from: Date; to: Date } | null): { from: Date; to: Date } => {
    if (rangeValue === 'custom' && custom?.from && custom?.to) {
      return { from: startOfDay(custom.from), to: endOfDay(custom.to) };
    }
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

  // Fetch campaigns when brand is available
  useEffect(() => {
    if (!brandLoading && activeBrand) {
      fetchCampaigns();
    }
  }, [brandLoading, activeBrand?.id]);

  // Check token expiration when brand loads - uses type assertion since meta_token_expires_at may exist
  useEffect(() => {
    const brandData = activeBrand as any;
    if (brandData && metaConnected && brandData.meta_token_expires_at && !tokenExpirationChecked) {
      const expiresAt = new Date(brandData.meta_token_expires_at);
      const now = new Date();
      
      if (expiresAt < now) {
        setMetaTokenExpired(true);
        toast.error("Meta connection expired", {
          description: "Reconnect to continue syncing your campaigns.",
          action: {
            label: "Reconnect",
            onClick: () => navigate("/meta-settings"),
          },
          duration: 10000,
        });
      }
      setTokenExpirationChecked(true);
    }
  }, [activeBrand, metaConnected, tokenExpirationChecked, navigate]);

  // Refetch when global date range changes (home view)
  useEffect(() => {
    if (view === 'home' && campaigns.length > 0) {
      fetchAllMetrics();
    }
    if (view === 'home' && metaConnected && brandId) {
      fetchAccountOverview();
    }
  }, [globalDateRange, customDateRange]);

  // Fetch campaign for detail view
  useEffect(() => {
    if (view === 'detail' && selectedCampaignId) {
      fetchCampaignDetail(selectedCampaignId, detailDateRange);
    }
  }, [view, selectedCampaignId]);

  const fetchCampaigns = async () => {
    if (!activeBrand) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('campaign_workspaces')
        .select(`
          id, 
          name, 
          meta_campaign_ids, 
          meta_campaign_status,
          template_id,
          final_answers,
          offer_id,
          offer_name,
          brand_id,
          campaign_builder_answers,
          tracking_verified,
          campaign_templates!campaign_workspaces_template_id_fkey (
            id,
            name,
            objective
          )
        `)
        .eq('brand_id', activeBrand.id)
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

      // Load user goals from final_answers
      const loadedGoals: Record<string, number> = {};
      publishedWorkspaces.forEach(w => {
        const finalAnswers = w.final_answers as any;
        if (finalAnswers?.userKpiGoal) {
          loadedGoals[w.id] = finalAnswers.userKpiGoal;
        }
      });
      setUserGoals(prev => ({ ...prev, ...loadedGoals }));

      const campaignData: CampaignData[] = publishedWorkspaces.map(w => {
        const builderAnswers = w.campaign_builder_answers as any;
        const dailyBudget = builderAnswers?.budget ? Number(builderAnswers.budget) : undefined;
        return {
          id: w.id,
          name: w.name,
          templateName: (w.campaign_templates as any)?.name || null,
          objective: (w.campaign_templates as any)?.objective || null,
          metrics: null,
          userGoal: loadedGoals[w.id] || null,
          status: w.meta_campaign_status || 'live',
          offerId: w.offer_id || null,
          offerName: w.offer_name || null,
          brandId: w.brand_id,
          dailyBudget,
          trackingVerified: (w as any).tracking_verified ?? false,
        };
      });

      setCampaigns(campaignData);

      // Fetch metrics for all campaigns and account overview
      if (metaConnected && campaignData.length > 0) {
        await Promise.all([
          fetchAllMetrics(campaignData),
          fetchAccountOverview(activeBrand.id),
        ]);
      } else if (metaConnected) {
        await fetchAccountOverview(activeBrand.id);
      }
    } catch (error: any) {
      console.error('Error fetching campaigns:', error);
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountOverview = async (currentBrandId?: string) => {
    const id = currentBrandId || brandId;
    if (!id) return;

    setAccountMetricsLoading(true);
    const dateRange = getDateRange(globalDateRange, customDateRange);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-account-overview', {
        body: {
          brandId: id,
          dateRangeStart: format(dateRange.from, 'yyyy-MM-dd'),
          dateRangeEnd: format(dateRange.to, 'yyyy-MM-dd'),
        },
      });

      // Check for token errors
      const responseError = data?.error || '';
      if (responseError.includes('Meta access token not found') || 
          responseError.includes('Please reconnect')) {
        setMetaTokenExpired(true);
        return;
      }

      if (error || !data?.success) {
        console.error('Error fetching account overview:', data?.error || error);
        return;
      }

      setAccountMetrics(data.metrics);
    } catch (err: any) {
      console.error('Error fetching account overview:', err);
    } finally {
      setAccountMetricsLoading(false);
    }
  };
  const getPreviousPeriodRange = (rangeValue: string, custom?: { from: Date; to: Date } | null): { from: Date; to: Date } => {
    const current = getDateRange(rangeValue, custom);
    const daysDiff = Math.ceil((current.to.getTime() - current.from.getTime()) / (1000 * 60 * 60 * 24));
    return {
      from: subDays(current.from, daysDiff),
      to: subDays(current.to, daysDiff),
    };
  };

  const autoVerifyTracking = (campaignList: CampaignData[]) => {
    campaignList.forEach((campaign) => {
      if (campaign.trackingVerified !== false || !campaign.metrics) return;
      const name = (campaign.name || '').toLowerCase();
      const obj = (campaign.objective || '').toLowerCase();
      // Check conversions: use objective if available, otherwise infer from campaign name
      const isLeadCampaign = obj.includes('lead') || name.includes('lead');
      const isSalesCampaign = obj.includes('sale') || obj.includes('purchase') || name.includes('sale');
      const hasConversions =
        (isLeadCampaign && (campaign.metrics.leads ?? 0) > 0) ||
        (isSalesCampaign && (campaign.metrics.purchases ?? 0) > 0) ||
        // Fallback: if either leads or purchases exist, tracking works
        (!isLeadCampaign && !isSalesCampaign && ((campaign.metrics.leads ?? 0) > 0 || (campaign.metrics.purchases ?? 0) > 0));
      if (!hasConversions) return;
      campaign.trackingVerified = true;
      supabase
        .from('campaign_workspaces')
        .update({ tracking_verified: true })
        .eq('id', campaign.id)
        .then(({ error }) => {
          if (error) console.error('Auto-verify tracking update failed:', error);
        });
    });
  };

  const fetchAllMetrics = async (campaignList?: CampaignData[]) => {
    const list = campaignList || campaigns;
    if (list.length === 0) return;

    setSyncing(true);
    const dateRange = getDateRange(globalDateRange, customDateRange);
    const prevDateRange = getPreviousPeriodRange(globalDateRange, customDateRange);

    try {
      const updatedCampaigns = await Promise.all(
        list.map(async (campaign) => {
          try {
            // Fetch current period metrics
            const { data, error } = await supabase.functions.invoke('fetch-meta-performance', {
              body: {
                workspaceId: campaign.id,
                dateRangeStart: format(dateRange.from, 'yyyy-MM-dd'),
                dateRangeEnd: format(dateRange.to, 'yyyy-MM-dd'),
              },
            });

            // Check for token expiration or missing token
            const responseError = data?.error || '';
            if (responseError.includes('Error validating access token') || 
                responseError.includes('session has been invalidated') ||
                responseError.includes('Meta access token not found') ||
                responseError.includes('Please reconnect')) {
              setMetaTokenExpired(true);
              return campaign;
            }

            if (error) {
              console.error(`Error fetching metrics for ${campaign.name}:`, error);
              return campaign;
            }

            // NEW: Check if campaign is not ACTIVE in Meta
            // Update local status to match Meta's real-time status
            if (data?.status && data.status !== 'ACTIVE') {
              const newStatus = data.status.toLowerCase();
              return {
                ...campaign,
                metrics: null, // No metrics for inactive campaigns
                previousMetrics: null,
                status: newStatus,
                userGoal: userGoals[campaign.id] || null,
              };
            }

            // Fetch previous period metrics for trend comparison (only for active campaigns)
            let previousMetrics = null;
            try {
              const { data: prevData } = await supabase.functions.invoke('fetch-meta-performance', {
                body: {
                  workspaceId: campaign.id,
                  dateRangeStart: format(prevDateRange.from, 'yyyy-MM-dd'),
                  dateRangeEnd: format(prevDateRange.to, 'yyyy-MM-dd'),
                },
              });
              // Only use previous metrics if campaign was also active then
              if (prevData?.status === 'ACTIVE' || !prevData?.status) {
                previousMetrics = prevData?.metrics || null;
              }
            } catch (prevErr) {
              // Silently fail for previous period - not critical
              console.log('Could not fetch previous period metrics');
            }

            return {
              ...campaign,
              metrics: data?.metrics || null,
              previousMetrics,
              status: 'active', // Confirmed active from Meta
              userGoal: userGoals[campaign.id] || null,
            };
          } catch (err: any) {
            console.error(`Error fetching metrics for ${campaign.name}:`, err);
            // Check for token expiration or missing token in thrown errors
            const errorMsg = err?.message || err?.toString() || '';
            if (errorMsg.includes('validating access token') || 
                errorMsg.includes('session has been invalidated') ||
                errorMsg.includes('OAuthException') ||
                errorMsg.includes('Meta access token not found') ||
                errorMsg.includes('Please reconnect')) {
              setMetaTokenExpired(true);
            }
            return campaign;
          }
        })
      );

      setCampaigns(updatedCampaigns);

      // Auto-verify tracking from live conversion data
      autoVerifyTracking(updatedCampaigns);
    } catch (error: any) {
      console.error('Error fetching metrics:', error);
      const errorMsg = error?.message || error?.toString() || '';
      if (errorMsg.includes('validating access token') || 
          errorMsg.includes('session has been invalidated') ||
          errorMsg.includes('OAuthException') ||
          errorMsg.includes('Meta access token not found') ||
          errorMsg.includes('Please reconnect')) {
        setMetaTokenExpired(true);
      }
    } finally {
      setSyncing(false);
    }
  };

  const fetchCampaignDetail = async (campaignId: string, dateRangeValue?: string) => {
    setSyncing(true);
    const dateRange = getDateRange(dateRangeValue || detailDateRange);

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
          responseError.includes('session has been invalidated') ||
          responseError.includes('Meta access token not found') ||
          responseError.includes('Please reconnect')) {
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
      const errorMsg = error?.message || error?.toString() || '';
      if (errorMsg.includes('validating access token') || 
          errorMsg.includes('session has been invalidated') ||
          errorMsg.includes('OAuthException') ||
          errorMsg.includes('non-2xx status code') || 
          errorMsg.includes('Edge Function') ||
          errorMsg.includes('Meta access token not found') ||
          errorMsg.includes('Please reconnect')) {
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
    setDetailDateRange(globalDateRange); // Start with global date range
    setView('detail');
  };

  const handleBackToHome = () => {
    setView('home');
    setSelectedCampaignId(null);
    setAnalysis(null);
  };

  // FIX: Persist user goals to database
  const handleUpdateGoal = async (campaignId: string, goal: number) => {
    setUserGoals(prev => ({ ...prev, [campaignId]: goal }));
    setCampaigns(prev => prev.map(c => 
      c.id === campaignId ? { ...c, userGoal: goal } : c
    ));
    
    // Save to database in final_answers
    try {
      const { data: workspace } = await supabase
        .from('campaign_workspaces')
        .select('final_answers')
        .eq('id', campaignId)
        .single();

      const currentAnswers = (workspace?.final_answers as any) || {};
      const updatedAnswers = { ...currentAnswers, userKpiGoal: goal };

      await supabase
        .from('campaign_workspaces')
        .update({ final_answers: updatedAnswers })
        .eq('id', campaignId);

      toast.success('Goal saved!');
    } catch (error) {
      console.error('Error saving goal:', error);
      toast.error('Failed to save goal');
    }
  };

  const handleDateRangeChange = (range: string) => {
    setGlobalDateRange(range);
  };

  const handleCustomDateRangeChange = (range: { from: Date; to: Date } | null) => {
    setCustomDateRange(range);
  };

  // FIX: Handle campaign-level date range change
  const handleDetailDateRangeChange = (range: string) => {
    setDetailDateRange(range);
    if (selectedCampaignId) {
      fetchCampaignDetail(selectedCampaignId, range);
    }
  };

  // Get selected campaign for detail view
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Page Header with Meta Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-display tracking-tight">Results</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Track performance and get smart recommendations</p>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Detail Level Toggle */}
            <div className="flex items-center rounded-lg border bg-card p-0.5 text-xs">
              <button
                onClick={() => { setDetailLevel('simple'); localStorage.setItem('lumi-insights-detail-level', 'simple'); }}
                className={`px-3 py-1.5 rounded-md transition-colors ${detailLevel === 'simple' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Simple
              </button>
              <button
                onClick={() => { setDetailLevel('detailed'); localStorage.setItem('lumi-insights-detail-level', 'detailed'); }}
                className={`px-3 py-1.5 rounded-md transition-colors ${detailLevel === 'detailed' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Detailed
              </button>
            </div>
            {/* Import from Ads Manager Button */}
            {metaConnected && !metaTokenExpired && brandId && metaAccountId && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 min-h-[44px] text-xs sm:text-sm"
                onClick={() => setImportModalOpen(true)}
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Import from Ads Manager</span>
                <span className="sm:hidden">Import</span>
              </Button>
            )}

            {/* Meta Connection Status Badge */}
            {metaConnected && !metaTokenExpired && (
              <Badge variant="outline" className="border-green-500/50 text-green-600 dark:text-green-400 gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3" />
                <span className="hidden sm:inline">Meta Connected</span>
                <span className="sm:hidden">Connected</span>
              </Badge>
            )}
            {metaConnected && metaTokenExpired && (
              <Button 
                variant="destructive" 
                size="sm" 
                className="gap-2 min-h-[44px]"
                onClick={() => navigate("/dashboard")}
              >
                <AlertTriangle className="h-4 w-4" />
                Reconnect
              </Button>
            )}
            {!metaConnected && !loading && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 min-h-[44px]"
                onClick={() => navigate("/dashboard")}
              >
                <Link2 className="h-4 w-4" />
                Connect Meta
              </Button>
            )}
          </div>
        </div>

        {/* Meta Token Expired - Modal popup */}
        {metaTokenExpired && (
          <MetaConnectionAlert 
            type="expired" 
            onDismiss={() => setMetaTokenExpired(false)}
          />
        )}

        {/* Main Content */}
        {!metaConnected && !loading ? (
          <ResultsEmptyState />
        ) : view === 'home' ? (
          <InsightsHome
            campaigns={campaigns}
            dateRange={globalDateRange}
            customDateRange={customDateRange}
            onDateRangeChange={handleDateRangeChange}
            onCustomDateRangeChange={handleCustomDateRangeChange}
            onViewInsights={handleViewInsights}
            onUpdateGoal={handleUpdateGoal}
            isLoading={loading || syncing}
            accountMetrics={accountMetrics}
            accountMetricsLoading={accountMetricsLoading}
            onOfferLinked={() => fetchCampaigns()}
          />
        ) : selectedCampaign ? (
          <CampaignInsightDetail
            campaign={selectedCampaign}
            analysis={analysis}
            globalDateRange={globalDateRange}
            onBack={handleBackToHome}
            onUpdateGoal={(goal) => handleUpdateGoal(selectedCampaign.id, goal)}
            onDateRangeChange={handleDetailDateRangeChange}
            onOfferLinked={() => {
              fetchCampaigns();
            }}
            isLoading={syncing}
            dateRangeStart={format(getDateRange(detailDateRange, customDateRange).from, 'yyyy-MM-dd')}
            dateRangeEnd={format(getDateRange(detailDateRange, customDateRange).to, 'yyyy-MM-dd')}
            detailLevel={detailLevel}
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Campaign not found</p>
            <Button onClick={handleBackToHome} className="mt-4">
              Back to Overview
            </Button>
          </div>
        )}

        {/* Import Campaigns Modal */}
        {brandId && metaAccountId && (
          <ImportCampaignsModal
            open={importModalOpen}
            onOpenChange={setImportModalOpen}
            brandId={brandId}
            metaAccountId={metaAccountId}
            dateRangeStart={globalDateRange !== 'custom' ? format(getDateRange(globalDateRange).from, 'yyyy-MM-dd') : customDateRange ? format(customDateRange.from, 'yyyy-MM-dd') : undefined}
            dateRangeEnd={globalDateRange !== 'custom' ? format(getDateRange(globalDateRange).to, 'yyyy-MM-dd') : customDateRange ? format(customDateRange.to, 'yyyy-MM-dd') : undefined}
            onImportComplete={fetchCampaigns}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
