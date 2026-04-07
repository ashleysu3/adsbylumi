import { useState, useEffect, useCallback } from 'react';
import { LumiEducationCard } from '@/components/LumiEducationCard';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { format, subDays, startOfDay, endOfDay, startOfYesterday, endOfYesterday } from 'date-fns';
import { RefreshCw, Link2Off, AlertTriangle, Link2, Calendar, BarChart2, Settings, Share2, Copy, ExternalLink, Loader2, Target, Bell } from 'lucide-react';
import { DateRangePicker } from '@/components/insights/DateRangePicker';
import { InsightsHome } from '@/components/insights/InsightsHome';
import { CampaignInsightDetail } from '@/components/insights/CampaignInsightDetail';
import { ResultsEmptyState } from '@/components/insights/ResultsEmptyState';
import { useLumiAssistant } from '@/components/LumiAssistant';
import { MetaConnectionAlert, MetaConnectionBanner } from '@/components/MetaConnectionAlert';
import { ImportCampaignsModal } from '@/components/insights/ImportCampaignsModal';
import { useBrand } from '@/contexts/BrandContext';
import { CampaignDetailDrawer } from '@/components/CampaignDetailDrawer';
import { ActionHistoryTimeline } from '@/components/insights/ActionHistoryTimeline';
import lumiLogo from '@/assets/lumi-logo.png';

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

const KPI_OPTIONS = [
  { value: 'cplpv', label: 'Cost per Landing Page View (CPLPV)', goalType: 'less_than', format: 'currency' },
  { value: 'cpc', label: 'Cost per Click (CPC)', goalType: 'less_than', format: 'currency' },
  { value: 'cpl', label: 'Cost per Lead (CPL)', goalType: 'less_than', format: 'currency' },
  { value: 'cppv', label: 'Cost per Profile Visit (CPPV)', goalType: 'less_than', format: 'currency' },
  { value: 'cp2sc', label: 'Cost per 2-Second Continuous View (CP2SC)', goalType: 'less_than', format: 'currency' },
  { value: 'roas', label: 'Return on Ad Spend (ROAS)', goalType: 'greater_than', format: 'multiplier' },
  { value: 'ctr', label: 'Click-Through Rate (CTR)', goalType: 'greater_than', format: 'percentage' },
  { value: 'cpm', label: 'Cost per 1,000 Impressions (CPM)', goalType: 'less_than', format: 'currency' },
  { value: 'purchases', label: 'Purchases (weekly count)', goalType: 'greater_than', format: 'number' },
];

function formatKpiValue(value: number, kpi: string) {
  if (['cpl', 'cpc', 'cplpv', 'cppv', 'cp2sc', 'cpm'].includes(kpi)) return `$${value.toFixed(2)}`;
  if (kpi === 'roas') return `${value.toFixed(1)}x`;
  if (kpi === 'ctr') return `${(value * 100).toFixed(1)}%`;
  return String(Math.round(value));
}

const ALL_DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

export default function AdPerformance() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workspaceIdFromUrl = searchParams.get('workspace');
  const { setRecommendation } = useLumiAssistant();
  const { activeBrand, isAgencyUser, loading: brandLoading } = useBrand();

  // View state: 'home' or 'detail'
  const [view, setView] = useState<'home' | 'detail'>(workspaceIdFromUrl ? 'detail' : 'home');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(workspaceIdFromUrl);

  // Detail level preference
  const [detailLevel, setDetailLevel] = useState<'simple' | 'detailed'>(() => {
    return localStorage.getItem('lumi-insights-detail-level') as 'simple' | 'detailed' || 'simple';
  });

  // Data state
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Meta connection state
  const metaConnected = !!activeBrand?.meta_account_id;
  const [metaTokenExpired, setMetaTokenExpired] = useState(false);
  const brandId = activeBrand?.id || null;
  const metaAccountId = activeBrand?.meta_account_id || null;
  const [tokenExpirationChecked, setTokenExpirationChecked] = useState(false);

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [goalSetupModalOpen, setGoalSetupModalOpen] = useState(false);
  const [campaignsNeedingGoals, setCampaignsNeedingGoals] = useState<any[]>([]);

  // Account metrics state
  const [accountMetrics, setAccountMetrics] = useState<AccountMetrics | null>(null);
  const [accountMetricsLoading, setAccountMetricsLoading] = useState(false);

  // Date range state
  const [globalDateRange, setGlobalDateRange] = useState<string>('7');
  const [detailDateRange, setDetailDateRange] = useState<string>('7');
  const [customDateRange, setCustomDateRange] = useState<{from: Date;to: Date;} | null>(null);

  // User goals
  const [userGoals, setUserGoals] = useState<Record<string, number>>({});

  // ─── Optimization Report State (merged from Weekly Check-In) ───
  const [optimizationReport, setOptimizationReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportLastUpdated, setReportLastUpdated] = useState<string | null>(null);
  const [reportAutoRunning, setReportAutoRunning] = useState(false);
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [sendingDigestEmail, setSendingDigestEmail] = useState(false);

  // Digest settings
  const [digestOpen, setDigestOpen] = useState(false);
  const [digestSettings, setDigestSettings] = useState({
    send_days: ['monday'] as string[],
    send_day: 'monday',
    send_time: '08:00',
    timezone: 'America/New_York',
    date_range_days: 7,
    additional_emails: [] as string[],
    enabled: true,
    alert_on_red: true,
    auto_optimize: false,
  });
  const [digestLoading, setDigestLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  // Pending optimizations
  const [pendingOptimizations, setPendingOptimizations] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // Campaign detail drawer (for report campaign cards)
  const [drawerCampaignId, setDrawerCampaignId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Contextual Lumi recommendations
  useEffect(() => {
    if (loading) return;

    if (!metaConnected) {
      setRecommendation({
        id: "data-connect-meta",
        title: "Connect Meta to See Insights",
        message: "Link your Meta ad account to unlock real-time performance data and AI-powered optimization recommendations.",
        actionLabel: "Go to Dashboard",
        onAction: () => navigate("/dashboard")
      });
      return;
    }

    if (metaTokenExpired) {
      setRecommendation({
        id: "data-reconnect-meta",
        title: "Meta Connection Expired",
        message: "Your access token has expired. Reconnect to continue tracking your campaign performance.",
        actionLabel: "Reconnect",
        onAction: () => navigate("/dashboard")
      });
      return;
    }

    if (campaigns.length === 0) {
      setRecommendation({
        id: "data-no-campaigns",
        title: "No Live Campaigns Yet",
        message: "Publish your first campaign to start tracking performance and get AI-powered insights.",
        actionLabel: "Create Campaign",
        onAction: () => navigate("/create")
      });
      return;
    }

    const campaignsWithMetrics = campaigns.filter((c) => c.metrics);
    if (campaignsWithMetrics.length > 0) {
      const lowCtrCampaign = campaignsWithMetrics.find((c) => {
        const ctr = c.metrics?.ctr || 0;
        return ctr < 1.0 && ctr > 0;
      });

      if (lowCtrCampaign) {
        setRecommendation({
          id: `data-low-ctr-${lowCtrCampaign.id}`,
          title: "CTR Below Benchmark",
          message: `"${lowCtrCampaign.name}" has a ${(lowCtrCampaign.metrics?.ctr || 0).toFixed(2)}% CTR. This is below the 1% benchmark — your creative might need a refresh.`,
          actionLabel: "View Insights",
          onAction: () => handleViewInsights(lowCtrCampaign.id)
        });
        return;
      }

      const fatigueRisk = campaignsWithMetrics.find((c) => {
        const frequency = c.metrics?.frequency || 0;
        return frequency >= 3;
      });

      if (fatigueRisk) {
        setRecommendation({
          id: `data-fatigue-${fatigueRisk.id}`,
          title: "Creative Fatigue Alert",
          message: `"${fatigueRisk.name}" has a frequency of ${(fatigueRisk.metrics?.frequency || 0).toFixed(1)}. Your audience is seeing ads too often — time to add fresh creative.`,
          actionLabel: "View Insights",
          onAction: () => handleViewInsights(fatigueRisk.id)
        });
        return;
      }

      const topPerformer = campaignsWithMetrics.find((c) => {
        const roas = c.metrics?.roas || 0;
        return roas >= 3;
      });

      if (topPerformer) {
        setRecommendation({
          id: `data-winning-${topPerformer.id}`,
          title: "You Have a Winner! 🎉",
          message: `"${topPerformer.name}" is crushing it with ${(topPerformer.metrics?.roas || 0).toFixed(1)}x ROAS! Consider scaling your budget to maximize returns.`,
          actionLabel: "View Insights",
          onAction: () => handleViewInsights(topPerformer.id)
        });
      }
    }
  }, [loading, metaConnected, metaTokenExpired, campaigns, setRecommendation, navigate]);

  // Convert date range string to actual dates
  const getDateRange = (rangeValue: string, custom?: {from: Date;to: Date;} | null): {from: Date;to: Date;} => {
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

  // Check token expiration
  useEffect(() => {
    const brandData = activeBrand as any;
    if (brandData && metaConnected && brandData.meta_token_expires_at && !tokenExpirationChecked) {
      const expiresAt = new Date(brandData.meta_token_expires_at);
      const now = new Date();
      if (expiresAt < now) {
        setMetaTokenExpired(true);
        toast.error("Meta connection expired", {
          description: "Reconnect to continue syncing your campaigns.",
          action: { label: "Reconnect", onClick: () => navigate("/meta-settings") },
          duration: 10000
        });
      }
      setTokenExpirationChecked(true);
    }
  }, [activeBrand, metaConnected, tokenExpirationChecked, navigate]);

  // Refetch when global date range changes
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

  // ─── Auto-run optimization report on load ───
  useEffect(() => {
    if (brandId && metaConnected && !metaTokenExpired && view === 'home') {
      loadOptimizationReport();
    }
  }, [brandId, metaConnected, metaTokenExpired, view]);

  // Load digest settings
  useEffect(() => {
    if (!brandId) return;
    supabase
      .from('digest_settings')
      .select('*')
      .eq('brand_id', brandId)
      .single()
      .then(({ data }) => {
        if (data) {
          const sendDays = (data as any).send_days?.length > 0 
            ? (data as any).send_days 
            : [data.send_day];
          setDigestSettings({
            send_days: sendDays,
            send_day: data.send_day,
            send_time: data.send_time,
            timezone: data.timezone,
            date_range_days: data.date_range_days,
            additional_emails: data.additional_emails || [],
            enabled: data.enabled ?? true,
            alert_on_red: (data as any).alert_on_red ?? true,
            auto_optimize: (data as any).auto_optimize ?? false,
          });
        }
      });
  }, [brandId]);

  // Load pending optimizations
  const fetchPendingOptimizations = useCallback(async () => {
    if (!brandId) return;
    setPendingLoading(true);
    try {
      const { data } = await supabase
        .from('pending_optimizations')
        .select('*')
        .eq('brand_id', brandId)
        .in('status', ['pending', 'applied'])
        .order('created_at', { ascending: false });
      setPendingOptimizations(data || []);
    } catch (e) {
      console.error('Error fetching pending optimizations:', e);
    } finally {
      setPendingLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    if (brandId) fetchPendingOptimizations();
  }, [brandId, fetchPendingOptimizations]);

  const handleOptimizationAction = async (id: string, action: 'approved' | 'rejected' | 'undone') => {
    try {
      const newStatus = action === 'undone' ? 'rejected' : action;
      const opt = pendingOptimizations.find(o => o.id === id);
      await supabase
        .from('pending_optimizations')
        .update({ status: newStatus, resolved_at: new Date().toISOString() } as any)
        .eq('id', id);

      // Log user action to ad_action_log
      if (opt && brandId) {
        await supabase.from('ad_action_log').insert({
          brand_id: brandId,
          workspace_id: opt.workspace_id,
          action_type: opt.recommendation_type || 'optimization_' + action,
          action_detail: { optimization_id: id, action, description: opt.action_description },
          source: action === 'approved' ? 'lumi_approved' : 'user',
          meta_entity_id: null,
        });
      }

      toast.success(action === 'approved' ? 'Optimization approved' : action === 'rejected' ? 'Optimization dismissed' : 'Optimization undone');
      fetchPendingOptimizations();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update optimization');
    }
  };

  const loadOptimizationReport = useCallback(async () => {
    if (!brandId) return;

    // Check for recent report
    const { data: latest } = await supabase
      .from('optimization_reports')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latest) {
      const createdAt = new Date(latest.created_at);
      const hoursDiff = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      setOptimizationReport(latest);
      setReportLastUpdated(format(createdAt, 'MMM d, h:mm a'));

      // If fresh enough, don't auto-run
      if (hoursDiff < 3) return;
    }

    // Auto-run report in background
    setReportAutoRunning(true);
    try {
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      const { data, error } = await supabase.functions.invoke('run-optimization-report', {
        body: { brandId, dateRangeStart: startDate, dateRangeEnd: endDate },
      });
      if (!error && data?.report) {
        setOptimizationReport(data.report);
        setReportLastUpdated(format(new Date(), 'MMM d, h:mm a'));
      }
    } catch (e) {
      console.error('Auto-run optimization report failed:', e);
    } finally {
      setReportAutoRunning(false);
    }
  }, [brandId]);

  const runReport = async () => {
    if (!brandId) return;
    setReportLoading(true);
    try {
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), parseInt(globalDateRange) || 7), 'yyyy-MM-dd');
      const { data, error } = await supabase.functions.invoke('run-optimization-report', {
        body: { brandId, dateRangeStart: startDate, dateRangeEnd: endDate },
      });
      if (error) throw error;
      if (data?.report) {
        setOptimizationReport(data.report);
        setReportLastUpdated(format(new Date(), 'MMM d, h:mm a'));
        toast.success('Performance report updated');
        setReportPreviewOpen(true);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    if (!activeBrand) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('campaign_workspaces')
        .select(`
          id, name, meta_campaign_ids, meta_campaign_status, template_id, final_answers,
          offer_id, offer_name, offer_price, brand_id, campaign_builder_answers, tracking_verified,
          campaign_templates!campaign_workspaces_template_id_fkey (id, name, objective, slug)
        `)
        .eq('brand_id', activeBrand.id)
        .not('meta_campaign_ids', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const publishedWorkspaces = (data || []).filter((workspace) => {
        if (!workspace.meta_campaign_ids) return false;
        const campaignId = (workspace.meta_campaign_ids as any)?.campaignId;
        if (!campaignId) return false;
        if (typeof campaignId === 'string' && campaignId.includes('_')) {
          const parts = campaignId.split('_');
          const numericPart = parts[parts.length - 1];
          const timestamp = parseInt(numericPart);
          const now = Date.now();
          const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
          if (timestamp > oneYearAgo && timestamp <= now) return false;
        }
        if (workspace.meta_campaign_status === 'draft') return false;
        return true;
      });

      const loadedGoals: Record<string, number> = {};
      publishedWorkspaces.forEach((w) => {
        const finalAnswers = w.final_answers as any;
        if (finalAnswers?.userKpiGoal) {
          loadedGoals[w.id] = finalAnswers.userKpiGoal;
        }
      });
      setUserGoals((prev) => ({ ...prev, ...loadedGoals }));

      const campaignData: CampaignData[] = publishedWorkspaces.map((w) => {
        const normalizedStatus = ((w.meta_campaign_status || 'unknown') as string).toLowerCase();
        return {
          id: w.id,
          name: w.name,
          templateName: (w.campaign_templates as any)?.name || null,
          objective: (w.campaign_templates as any)?.objective || null,
          metrics: null,
          userGoal: loadedGoals[w.id] || null,
          status: normalizedStatus,
          offerId: w.offer_id || null,
          offerName: w.offer_name || null,
          brandId: w.brand_id,
          dailyBudget: undefined,
          budgetLevel: null,
          trackingVerified: (w as any).tracking_verified ?? false,
          lastSyncedAt: (w as any).meta_insights_last_sync || null
        };
      });

      setCampaigns(campaignData);

      if (metaConnected && campaignData.length > 0) {
        await Promise.all([fetchAllMetrics(campaignData), fetchAccountOverview(activeBrand.id)]);
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
          dateRangeEnd: format(dateRange.to, 'yyyy-MM-dd')
        }
      });

      const responseError = data?.error || '';
      if (responseError.includes('Meta access token not found') || responseError.includes('Please reconnect')) {
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

  const getPreviousPeriodRange = (rangeValue: string, custom?: {from: Date;to: Date;} | null): {from: Date;to: Date;} => {
    const current = getDateRange(rangeValue, custom);
    const daysDiff = Math.ceil((current.to.getTime() - current.from.getTime()) / (1000 * 60 * 60 * 24));
    return { from: subDays(current.from, daysDiff), to: subDays(current.to, daysDiff) };
  };

  const autoVerifyTracking = (campaignList: CampaignData[]) => {
    campaignList.forEach((campaign) => {
      if (campaign.trackingVerified !== false || !campaign.metrics) return;
      const name = (campaign.name || '').toLowerCase();
      const obj = (campaign.objective || '').toLowerCase();
      const isLeadCampaign = obj.includes('lead') || name.includes('lead');
      const isSalesCampaign = obj.includes('sale') || obj.includes('purchase') || name.includes('sale');
      const isVideoCampaign = obj.includes('video') || name.includes('video') || name.includes('thruplay') || name.includes('views');
      const hasConversions =
        isLeadCampaign && (campaign.metrics.leads ?? 0) > 0 ||
        isSalesCampaign && (campaign.metrics.purchases ?? 0) > 0 ||
        isVideoCampaign && ((campaign.metrics.videoViews ?? 0) > 0 || (campaign.metrics.videoThruPlays ?? 0) > 0) ||
        !isLeadCampaign && !isSalesCampaign && !isVideoCampaign && ((campaign.metrics.leads ?? 0) > 0 || (campaign.metrics.purchases ?? 0) > 0);
      if (!hasConversions) return;
      campaign.trackingVerified = true;
      supabase.from('campaign_workspaces').update({ tracking_verified: true }).eq('id', campaign.id)
        .then(({ error }) => { if (error) console.error('Auto-verify tracking update failed:', error); });
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
            const { data, error } = await supabase.functions.invoke('fetch-meta-performance', {
              body: {
                workspaceId: campaign.id,
                dateRangeStart: format(dateRange.from, 'yyyy-MM-dd'),
                dateRangeEnd: format(dateRange.to, 'yyyy-MM-dd')
              }
            });

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

            const metaStatus = (data?.status || '').toString().toUpperCase();
            const metaDailyBudget = data?.dailyBudget != null ? Number(data.dailyBudget) : undefined;
            const metaBudgetLevel = data?.budgetLevel || null;
            const syncedAt = new Date().toISOString();

            if (metaStatus !== 'ACTIVE') {
              return {
                ...campaign, metrics: null, previousMetrics: null,
                status: metaStatus ? metaStatus.toLowerCase() : 'unknown',
                dailyBudget: metaDailyBudget, budgetLevel: metaBudgetLevel,
                userGoal: userGoals[campaign.id] || null, lastSyncedAt: syncedAt
              };
            }

            let previousMetrics = null;
            try {
              const { data: prevData } = await supabase.functions.invoke('fetch-meta-performance', {
                body: {
                  workspaceId: campaign.id,
                  dateRangeStart: format(prevDateRange.from, 'yyyy-MM-dd'),
                  dateRangeEnd: format(prevDateRange.to, 'yyyy-MM-dd')
                }
              });
              if (prevData?.status === 'ACTIVE' || !prevData?.status) {
                previousMetrics = prevData?.metrics || null;
              }
            } catch (prevErr) {
              console.log('Could not fetch previous period metrics');
            }

            return {
              ...campaign, metrics: data?.metrics || null, previousMetrics,
              status: 'active', dailyBudget: metaDailyBudget, budgetLevel: metaBudgetLevel,
              userGoal: userGoals[campaign.id] || null, lastSyncedAt: syncedAt
            };
          } catch (err: any) {
            console.error(`Error fetching metrics for ${campaign.name}:`, err);
            const errorMsg = err?.message || err?.toString() || '';
            if (errorMsg.includes('validating access token') || errorMsg.includes('session has been invalidated') ||
                errorMsg.includes('OAuthException') || errorMsg.includes('Meta access token not found') ||
                errorMsg.includes('Please reconnect')) {
              setMetaTokenExpired(true);
            }
            return campaign;
          }
        })
      );

      setCampaigns(updatedCampaigns);
      autoVerifyTracking(updatedCampaigns);
    } catch (error: any) {
      console.error('Error fetching metrics:', error);
      const errorMsg = error?.message || error?.toString() || '';
      if (errorMsg.includes('validating access token') || errorMsg.includes('session has been invalidated') ||
          errorMsg.includes('OAuthException') || errorMsg.includes('Meta access token not found') ||
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
      const { data: metricsData, error: metricsError } = await supabase.functions.invoke('fetch-meta-performance', {
        body: {
          workspaceId: campaignId,
          dateRangeStart: format(dateRange.from, 'yyyy-MM-dd'),
          dateRangeEnd: format(dateRange.to, 'yyyy-MM-dd')
        }
      });

      const responseError = metricsData?.error || '';
      if (responseError.includes('Error validating access token') || responseError.includes('session has been invalidated') ||
          responseError.includes('Meta access token not found') || responseError.includes('Please reconnect')) {
        setMetaTokenExpired(true);
        setSyncing(false);
        return;
      }

      if (metricsError) throw metricsError;

      if (metricsData?.metrics) {
        setCampaigns((prev) => prev.map((c) => c.id === campaignId ? { ...c, metrics: metricsData.metrics } : c));

        const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-performance', {
          body: { workspaceId: campaignId, metricsData: metricsData.metrics }
        });

        if (!analysisError && analysisData?.analysis) {
          setAnalysis(analysisData.analysis);
        }
      }

      setMetaTokenExpired(false);
    } catch (error: any) {
      console.error('Error fetching campaign detail:', error);
      const errorMsg = error?.message || error?.toString() || '';
      if (errorMsg.includes('validating access token') || errorMsg.includes('session has been invalidated') ||
          errorMsg.includes('OAuthException') || errorMsg.includes('non-2xx status code') ||
          errorMsg.includes('Edge Function') || errorMsg.includes('Meta access token not found') ||
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
    setDetailDateRange(globalDateRange);
    setView('detail');
  };

  const handleBackToHome = () => {
    setView('home');
    setSelectedCampaignId(null);
    setAnalysis(null);
  };

  const handleUpdateGoal = async (campaignId: string, goal: number) => {
    setUserGoals((prev) => ({ ...prev, [campaignId]: goal }));
    setCampaigns((prev) => prev.map((c) => c.id === campaignId ? { ...c, userGoal: goal } : c));

    try {
      const { data: workspace } = await supabase.from('campaign_workspaces').select('final_answers').eq('id', campaignId).single();
      const currentAnswers = workspace?.final_answers as any || {};
      const updatedAnswers = { ...currentAnswers, userKpiGoal: goal };
      await supabase.from('campaign_workspaces').update({ final_answers: updatedAnswers }).eq('id', campaignId);
      toast.success('Goal saved!');
    } catch (error) {
      console.error('Error saving goal:', error);
      toast.error('Failed to save goal');
    }
  };

  const handleDateRangeChange = (range: string) => {
    setGlobalDateRange(range);
  };

  const handleCustomDateRangeChange = (range: {from: Date;to: Date;} | null) => {
    setCustomDateRange(range);
  };

  const handleDetailDateRangeChange = (range: string) => {
    setDetailDateRange(range);
    if (selectedCampaignId) {
      fetchCampaignDetail(selectedCampaignId, range);
    }
  };

  const handleCampaignStatusChange = (campaignId: string, newStatus: string) => {
    setCampaigns(prev => prev.map(c =>
      c.id === campaignId
        ? { ...c, status: newStatus, metrics: newStatus !== 'active' ? null : c.metrics }
        : c
    ));
  };

  // ─── Digest Settings ───
  const toggleDay = (day: string) => {
    setDigestSettings(p => {
      const current = p.send_days;
      if (current.includes(day)) {
        if (current.length <= 1) return p;
        return { ...p, send_days: current.filter(d => d !== day), send_day: current.filter(d => d !== day)[0] };
      }
      if (current.length >= 3) return p;
      const next = [...current, day];
      return { ...p, send_days: next, send_day: next[0] };
    });
  };

  const saveDigestSettings = async () => {
    if (!brandId) return;
    setDigestLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('digest_settings')
        .upsert({
          brand_id: brandId,
          created_by: user.id,
          send_day: digestSettings.send_days[0] || digestSettings.send_day,
          send_days: digestSettings.send_days,
          send_time: digestSettings.send_time,
          timezone: digestSettings.timezone,
          date_range_days: digestSettings.date_range_days,
          additional_emails: digestSettings.additional_emails,
          enabled: digestSettings.enabled,
          alert_on_red: digestSettings.alert_on_red,
          auto_optimize: digestSettings.auto_optimize,
        } as any, { onConflict: 'brand_id' });

      if (error) throw error;
      toast.success('Digest settings saved');
      setDigestOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save settings');
    } finally {
      setDigestLoading(false);
    }
  };

  // ─── Optimization report data ───
  const reportData = (optimizationReport?.report_data || []) as any[];
  const reportSummary = (optimizationReport?.summary || { green: 0, yellow: 0, red: 0, unconfigured: 0, total: 0 }) as any;
  const redCampaignCount = reportSummary.red || 0;

  const configuredCampaigns = reportData.filter(c => c.has_goals && !['unconfigured', 'error', 'no_data'].includes(c.status));
  const unconfiguredReportCampaigns = reportData.filter(c => !c.has_goals || c.status === 'unconfigured');

  const sortedReportCampaigns = [...configuredCampaigns].sort((a, b) => {
    const order: Record<string, number> = { red: 0, yellow: 1, green: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  const statusDotClass = (status: string) => {
    if (status === 'green') return 'bg-green-500 animate-pulse';
    if (status === 'yellow') return 'bg-amber-400 animate-pulse';
    if (status === 'red') return 'bg-red-500 animate-pulse';
    return 'bg-muted-foreground/30';
  };

  const kpiStatusIcon = (value: number, threshold: number, goalType: string) => {
    const met = goalType === 'less_than' ? value <= threshold : value >= threshold;
    const close = goalType === 'less_than' ? value <= threshold * 1.25 : value >= threshold * 0.75;
    if (met) return '✅';
    if (close) return '🟡';
    return '🔴';
  };

  const openDrawer = (workspaceId: string) => {
    setDrawerCampaignId(workspaceId);
    setDrawerOpen(true);
  };

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4">

        {/* ─── Red Alert Banner ─── */}
        {redCampaignCount > 0 && view === 'home' && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {redCampaignCount} campaign{redCampaignCount > 1 ? 's' : ''} need{redCampaignCount === 1 ? 's' : ''} your attention
            </AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>LUMI has recommendations ready to optimize performance.</span>
            </AlertDescription>
          </Alert>
        )}

        {/* ─── Auto-running indicator ─── */}
        {reportAutoRunning && view === 'home' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <img src={lumiLogo} className="h-4 w-4 animate-pulse" alt="" />
            <span>LUMI is checking your campaigns...</span>
          </div>
        )}


        {/* ─── Page Header ─── */}
        <div className="mb-4 sm:mb-6">
          {reportLastUpdated && view === 'home' && (
            <div className="text-xs text-muted-foreground text-right">
              LUMI last checked: {reportLastUpdated}
            </div>
          )}
        </div>

        {/* Meta Token Expired */}
        {metaTokenExpired &&
          <MetaConnectionAlert type="expired" onDismiss={() => setMetaTokenExpired(false)} />
        }

        {/* ─── Campaign Health Summary (from optimization report) ─── */}
        {optimizationReport && view === 'home' && reportData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{reportSummary.total}</div>
              <div className="text-xs text-muted-foreground">Tracked campaigns</div>
            </CardContent></Card>
            <Card className="border-green-200 dark:border-green-800"><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{reportSummary.green}</div>
              <div className="text-xs text-muted-foreground">🟢 On track</div>
            </CardContent></Card>
            <Card className="border-amber-200 dark:border-amber-800"><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{reportSummary.yellow}</div>
              <div className="text-xs text-muted-foreground">🟡 Watch</div>
            </CardContent></Card>
            <Card className="border-red-200 dark:border-red-800"><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{reportSummary.red}</div>
              <div className="text-xs text-muted-foreground">🔴 Need attention</div>
            </CardContent></Card>
          </div>
        )}

        {/* ─── Main Content ─── */}
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
            onCampaignStatusChange={handleCampaignStatusChange}
            brandId={brandId || undefined}
            dateRangeStart={format(getDateRange(globalDateRange, customDateRange).from, 'yyyy-MM-dd')}
            dateRangeEnd={format(getDateRange(globalDateRange, customDateRange).to, 'yyyy-MM-dd')}
          />
        ) : selectedCampaign ? (
          <CampaignInsightDetail
            campaign={selectedCampaign}
            analysis={analysis}
            globalDateRange={globalDateRange}
            onBack={handleBackToHome}
            onUpdateGoal={(goal) => handleUpdateGoal(selectedCampaign.id, goal)}
            onDateRangeChange={handleDetailDateRangeChange}
            onOfferLinked={() => { fetchCampaigns(); }}
            isLoading={syncing}
            dateRangeStart={format(getDateRange(detailDateRange, customDateRange).from, 'yyyy-MM-dd')}
            dateRangeEnd={format(getDateRange(detailDateRange, customDateRange).to, 'yyyy-MM-dd')}
            detailLevel={detailLevel}
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Campaign not found</p>
            <Button onClick={handleBackToHome} className="mt-4">Back to Overview</Button>
          </div>
        )}

        {/* ─── LUMI Recommendations Section (from optimization report) ─── */}
        {optimizationReport && view === 'home' && (sortedReportCampaigns.length > 0 || unconfiguredReportCampaigns.length > 0) && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <img src={lumiLogo} className="h-5 w-5" alt="" />
              <h2 className="text-lg font-bold text-foreground">LUMI Recommendations</h2>
            </div>

            {/* Cross-Campaign Insights */}
            {(optimizationReport?.summary as any)?.cross_campaign_insights?.length > 0 && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Link2 className="h-4 w-4" />
                    Cross-Campaign Impact Detected
                  </div>
                  {((optimizationReport.summary as any).cross_campaign_insights as any[]).map((insight: any, idx: number) => (
                    <p key={idx} className="text-sm text-muted-foreground">{insight.action}</p>
                  ))}
                </CardContent>
              </Card>
            )}

            {sortedReportCampaigns.map((c, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${statusDotClass(c.status)}`} />
                      <CardTitle className="text-lg">{c.workspace_name}</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs">LIVE</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {c.goals && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{c.goals.primary_kpi_label}</span>
                        <span>
                          <span className="font-semibold">{formatKpiValue(c.primary_kpi_value, c.goals.primary_kpi)}</span>
                          <span className="text-muted-foreground ml-2">
                            Goal: {c.goals.primary_kpi_goal_type === 'less_than' ? '<' : '>'}{formatKpiValue(c.goals.primary_kpi_threshold, c.goals.primary_kpi)}
                          </span>
                          <span className="ml-2">{kpiStatusIcon(c.primary_kpi_value, c.goals.primary_kpi_threshold, c.goals.primary_kpi_goal_type)}</span>
                        </span>
                      </div>
                      {c.goals.secondary_kpi && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">{c.goals.secondary_kpi_label}</span>
                          <span>
                            <span className="font-semibold">{formatKpiValue(c.secondary_kpi_value || 0, c.goals.secondary_kpi)}</span>
                            <span className="text-muted-foreground ml-2">
                              Goal: {c.goals.secondary_kpi_goal_type === 'less_than' ? '<' : '>'}{formatKpiValue(c.goals.secondary_kpi_threshold, c.goals.secondary_kpi)}
                            </span>
                            <span className="ml-2">{kpiStatusIcon(c.secondary_kpi_value || 0, c.goals.secondary_kpi_threshold, c.goals.secondary_kpi_goal_type)}</span>
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Frequency</span>
                        <span>
                          <span className="font-semibold">{c.metrics?.frequency?.toFixed(1) || '0'}</span>
                          <span className="text-muted-foreground ml-2">Goal: &lt;{c.goals.frequency_threshold || 4}</span>
                          <span className="ml-2">{(c.metrics?.frequency || 0) < (c.goals.frequency_threshold || 4) ? '✅' : '⚠️'}</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {c.recommendations?.length > 0 && (
                    <div className="border-t pt-3">
                      <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                        <img src={lumiLogo} className="h-4 w-4" alt="" /> LUMI RECOMMENDS
                      </div>
                      {c.recommendations.map((r: any, ri: number) => (
                        <div key={ri} className="text-sm flex gap-2 mb-1">
                          <span>{r.icon}</span>
                          <span>{r.action}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {c.budget_hogs?.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                      {c.budget_hogs.map((h: any, hi: number) => (
                        <div key={hi} className="text-sm text-amber-800 dark:text-amber-200">
                          ⚠️ "{h.name}" spending {((h.spend / (c.metrics?.spend || 1)) * 100).toFixed(0)}% of budget at ${h.costPerResult.toFixed(2)} CPR
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button variant="ghost" size="sm" onClick={() => openDrawer(c.workspace_id)}>
                      View Campaign <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Unconfigured Campaigns */}
            {unconfiguredReportCampaigns.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Unconfigured</h3>
                {unconfiguredReportCampaigns.map((c, i) => (
                  <Card key={i} className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
                          <span className="font-medium">{c.workspace_name}</span>
                          <Badge variant="outline" className="text-xs">LIVE</Badge>
                        </div>
                      </div>

                      {c.metrics && c.metrics.spend > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                          <div>
                            <span className="text-muted-foreground text-xs">Spend</span>
                            <div className="font-semibold">${c.metrics.spend?.toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">CTR</span>
                            <div className="font-semibold">{(c.metrics.ctr * 100)?.toFixed(2)}%</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">CPC</span>
                            <div className="font-semibold">${c.metrics.cpc?.toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Frequency</span>
                            <div className="font-semibold">{c.metrics.frequency?.toFixed(1)}</div>
                          </div>
                          {c.metrics.leads > 0 && (
                            <div>
                              <span className="text-muted-foreground text-xs">Leads</span>
                              <div className="font-semibold">{c.metrics.leads}</div>
                            </div>
                          )}
                          {c.metrics.cpl > 0 && (
                            <div>
                              <span className="text-muted-foreground text-xs">CPL</span>
                              <div className="font-semibold">${c.metrics.cpl?.toFixed(2)}</div>
                            </div>
                          )}
                          {c.metrics.roas > 0 && (
                            <div>
                              <span className="text-muted-foreground text-xs">ROAS</span>
                              <div className="font-semibold">{c.metrics.roas?.toFixed(1)}x</div>
                            </div>
                          )}
                          {c.metrics.reach > 0 && (
                            <div>
                              <span className="text-muted-foreground text-xs">Reach</span>
                              <div className="font-semibold">{c.metrics.reach?.toLocaleString()}</div>
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-sm text-muted-foreground mt-3">
                        {c.metrics && c.metrics.spend > 0
                          ? 'Set performance goals so LUMI can diagnose this campaign and give you recommendations.'
                          : 'No performance goals set for this campaign. LUMI can\'t track performance without a target.'}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => openDrawer(c.workspace_id)}>
                          <Target className="h-3 w-3 mr-1" /> Set Goals →
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openDrawer(c.workspace_id)}>View Campaign →</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Pending Optimizations ─── */}
        {pendingOptimizations.length > 0 && view === 'home' && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2">
              <img src={lumiLogo} className="h-5 w-5" alt="" />
              <h2 className="text-lg font-bold text-foreground">Pending Actions</h2>
              <Badge variant="outline" className="text-xs">{pendingOptimizations.filter(o => o.status === 'pending').length} pending</Badge>
            </div>
            {pendingOptimizations.map((opt) => (
              <Card key={opt.id} className={opt.auto_applied ? 'border-primary/30 bg-primary/5' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={opt.auto_applied ? 'default' : 'outline'} className="text-xs">
                          {opt.auto_applied ? '✦ Auto-applied' : opt.recommendation_type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm">{opt.action_description}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {opt.status === 'pending' && (
                        <>
                          <Button size="sm" variant="default" onClick={() => handleOptimizationAction(opt.id, 'approved')}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleOptimizationAction(opt.id, 'rejected')}>
                            Dismiss
                          </Button>
                        </>
                      )}
                      {opt.status === 'applied' && opt.auto_applied && (
                        <Button size="sm" variant="outline" onClick={() => handleOptimizationAction(opt.id, 'undone')}>
                          Undo
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ─── Action History Timeline ─── */}
        {brandId && view === 'home' && (
          <div className="pt-4 border-t">
            <ActionHistoryTimeline brandId={brandId} />
          </div>
        )}

        {brandId && metaAccountId &&
          <ImportCampaignsModal
            open={importModalOpen}
            onOpenChange={setImportModalOpen}
            brandId={brandId}
            metaAccountId={metaAccountId}
            dateRangeStart={globalDateRange !== 'custom' ? format(getDateRange(globalDateRange).from, 'yyyy-MM-dd') : customDateRange ? format(customDateRange.from, 'yyyy-MM-dd') : undefined}
            dateRangeEnd={globalDateRange !== 'custom' ? format(getDateRange(globalDateRange).to, 'yyyy-MM-dd') : customDateRange ? format(customDateRange.to, 'yyyy-MM-dd') : undefined}
            onImportComplete={fetchCampaigns}
          />
        }

        {/* ─── Sync from Meta (subtle, at bottom) ─── */}
        {metaConnected && !metaTokenExpired && brandId && metaAccountId && view === 'home' && (
          <div className="flex justify-center pt-4">
            <button
              onClick={() => setImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Sync latest from Meta
            </button>
          </div>
        )}

        {/* ─── Report Preview Dialog ─── */}
        <Dialog open={reportPreviewOpen} onOpenChange={setReportPreviewOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-3 shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <img src={lumiLogo} className="h-5 w-5" alt="" />
                Performance Report
              </DialogTitle>
              <DialogDescription>
                {optimizationReport?.date_range_start} — {optimizationReport?.date_range_end}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 space-y-4">
              {/* Summary bar */}
              {reportSummary && (
                <div className="flex gap-3 text-sm flex-wrap">
                  <span>🟢 {reportSummary.green || 0} on track</span>
                  <span>🟡 {reportSummary.yellow || 0} need attention</span>
                  <span>🔴 {reportSummary.red || 0} need action</span>
                </div>
              )}

              {/* Campaign cards */}
              {sortedReportCampaigns.map((c, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${statusDotClass(c.status)}`} />
                      <span className="font-semibold">{c.workspace_name}</span>
                    </div>

                    {c.goals && (
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">{c.goals.primary_kpi_label}</span>
                          <span>
                            <span className="font-semibold">{formatKpiValue(c.primary_kpi_value, c.goals.primary_kpi)}</span>
                            <span className="text-muted-foreground ml-2">
                              Goal: {c.goals.primary_kpi_goal_type === 'less_than' ? '<' : '>'}{formatKpiValue(c.goals.primary_kpi_threshold, c.goals.primary_kpi)}
                            </span>
                            <span className="ml-2">{kpiStatusIcon(c.primary_kpi_value, c.goals.primary_kpi_threshold, c.goals.primary_kpi_goal_type)}</span>
                          </span>
                        </div>
                        {c.goals.secondary_kpi && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{c.goals.secondary_kpi_label}</span>
                            <span>
                              <span className="font-semibold">{formatKpiValue(c.secondary_kpi_value || 0, c.goals.secondary_kpi)}</span>
                              <span className="text-muted-foreground ml-2">
                                Goal: {c.goals.secondary_kpi_goal_type === 'less_than' ? '<' : '>'}{formatKpiValue(c.goals.secondary_kpi_threshold, c.goals.secondary_kpi)}
                              </span>
                              <span className="ml-2">{kpiStatusIcon(c.secondary_kpi_value || 0, c.goals.secondary_kpi_threshold, c.goals.secondary_kpi_goal_type)}</span>
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Frequency</span>
                          <span>
                            <span className="font-semibold">{c.metrics?.frequency?.toFixed(1) || '0'}</span>
                            <span className="text-muted-foreground ml-2">Goal: &lt;{c.goals.frequency_threshold || 4}</span>
                            <span className="ml-2">{(c.metrics?.frequency || 0) < (c.goals.frequency_threshold || 4) ? '✅' : '⚠️'}</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {c.recommendations?.length > 0 && (
                      <div className="border-t pt-2">
                        <div className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                          <img src={lumiLogo} className="h-3.5 w-3.5" alt="" /> LUMI RECOMMENDS
                        </div>
                        {c.recommendations.map((r: any, ri: number) => (
                          <div key={ri} className="text-sm flex gap-2 mb-1">
                            <span>{r.icon}</span>
                            <span>{r.action}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {c.budget_hogs?.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200 dark:border-amber-800 text-sm">
                        {c.budget_hogs.map((h: any, hi: number) => (
                          <div key={hi} className="text-amber-800 dark:text-amber-200">
                            ⚠️ "{h.name}" at ${h.costPerResult.toFixed(2)} CPR
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {unconfiguredReportCampaigns.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  + {unconfiguredReportCampaigns.length} campaign{unconfiguredReportCampaigns.length > 1 ? 's' : ''} without goals configured
                </div>
              )}
            </div>

            {/* Fixed footer */}
            <div className="flex items-center justify-between p-6 pt-3 border-t shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={runReport}
                disabled={reportLoading}
                className="text-xs"
              >
                {reportLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Refresh Report
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setReportPreviewOpen(false)}>Close</Button>
                <Button
                  disabled={sendingDigestEmail}
                  onClick={async () => {
                    if (!brandId || !optimizationReport?.id) return;
                    setSendingDigestEmail(true);
                    try {
                      const { error } = await supabase.functions.invoke('send-optimization-digest', {
                        body: { brandId, reportId: optimizationReport.id },
                      });
                      if (error) throw error;
                      toast.success('Report sent to your email');
                    } catch (e: any) {
                      toast.error(e.message || 'Failed to send email');
                    } finally {
                      setSendingDigestEmail(false);
                    }
                  }}
                >
                  {sendingDigestEmail ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Send via Email
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ─── Digest Settings Dialog ─── */}
        <Dialog open={digestOpen} onOpenChange={setDigestOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Notification Settings</DialogTitle>
              <DialogDescription>Configure how LUMI monitors your campaigns and sends you updates.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Urgent alert toggle */}
              <div className="flex items-center justify-between bg-destructive/5 rounded-lg p-3 border border-destructive/20">
                <div>
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5 text-destructive" />
                    Urgent campaign alerts
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Email me immediately when LUMI detects a campaign needs urgent action
                  </p>
                </div>
                <Switch checked={digestSettings.alert_on_red}
                  onCheckedChange={v => setDigestSettings(p => ({ ...p, alert_on_red: v }))} />
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Scheduled Digest</p>
              </div>

              <div>
                <Label className="text-sm">Send check-in on</Label>
                <p className="text-xs text-muted-foreground mb-2">Pick 1–3 days. LUMI will check your accounts and email you each selected day.</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {ALL_DAYS.map(day => (
                    <Button key={day} size="sm" variant={digestSettings.send_days.includes(day) ? 'default' : 'outline'}
                      onClick={() => toggleDay(day)}>
                      {day.slice(0, 3).charAt(0).toUpperCase() + day.slice(1, 3)}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm">Send time</Label>
                <Select value={digestSettings.send_time} onValueChange={v => setDigestSettings(p => ({ ...p, send_time: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const h = String(i).padStart(2, '0');
                      const label = i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`;
                      return <SelectItem key={h} value={`${h}:00`}>{label}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Timezone</Label>
                <Select value={digestSettings.timezone} onValueChange={v => setDigestSettings(p => ({ ...p, timezone: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu','UTC','Europe/London'].map(tz => (
                      <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Review the last</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input type="number" min={1} max={30} value={digestSettings.date_range_days}
                    onChange={e => setDigestSettings(p => ({ ...p, date_range_days: parseInt(e.target.value) || 7 }))}
                    className="w-20" />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>
              <div>
                <Label className="text-sm">Additional recipients</Label>
                <div className="flex gap-2 mt-1">
                  <Input placeholder="email@example.com" value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newEmail.includes('@')) {
                        setDigestSettings(p => ({ ...p, additional_emails: [...p.additional_emails, newEmail] }));
                        setNewEmail('');
                      }
                    }} />
                  <Button size="sm" variant="outline" onClick={() => {
                    if (newEmail.includes('@')) {
                      setDigestSettings(p => ({ ...p, additional_emails: [...p.additional_emails, newEmail] }));
                      setNewEmail('');
                    }
                  }}>Add</Button>
                </div>
                {digestSettings.additional_emails.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {digestSettings.additional_emails.map((e, i) => (
                      <Badge key={i} variant="secondary" className="cursor-pointer"
                        onClick={() => setDigestSettings(p => ({
                          ...p, additional_emails: p.additional_emails.filter((_, idx) => idx !== i)
                        }))}>
                        {e} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Enable digest</Label>
                <Switch checked={digestSettings.enabled}
                  onCheckedChange={v => setDigestSettings(p => ({ ...p, enabled: v }))} />
              </div>
              <div className="flex items-center justify-between bg-primary/5 rounded-lg p-3 border border-primary/20">
                <div>
                  <Label className="text-sm font-medium">Auto-optimize</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Let LUMI auto-apply high-priority actions (pause budget hogs, scale winners)
                  </p>
                </div>
                <Switch checked={digestSettings.auto_optimize}
                  onCheckedChange={v => setDigestSettings(p => ({ ...p, auto_optimize: v }))} />
              </div>
              <Button onClick={saveDigestSettings} disabled={digestLoading} className="w-full">
                {digestLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Campaign Detail Drawer (for report cards) */}
        <CampaignDetailDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          campaignId={drawerCampaignId}
          onUpdate={loadOptimizationReport}
        />
      </div>
    </DashboardLayout>
  );
}
