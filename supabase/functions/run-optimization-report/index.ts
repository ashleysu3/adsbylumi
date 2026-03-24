import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[run-optimization-report] Request received');
    const body = await req.json();
    const { brandId, dateRangeStart, dateRangeEnd } = body;
    console.log('[run-optimization-report] Params:', { brandId, dateRangeStart, dateRangeEnd });
    if (!brandId || !dateRangeStart || !dateRangeEnd) {
      throw new Error('brandId, dateRangeStart, and dateRangeEnd are required');
    }

    // Auth — support both user JWT and service-role key for cron context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const isServiceRole = token === serviceRoleKey;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let userId: string;

    if (isServiceRole) {
      // Service-role mode (called from schedule-digests cron)
      // Look up userId from the brand
      const { data: brandLookup, error: brandLookupError } = await supabase
        .from('brands')
        .select('user_id')
        .eq('id', brandId)
        .single();
      if (brandLookupError || !brandLookup) {
        throw new Error('Brand not found');
      }
      userId = brandLookup.user_id;
      console.log('[run-optimization-report] Service-role mode, userId from brand:', userId);
    } else {
      // User JWT mode (called from dashboard)
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
      if (userError || !user) {
        console.error('Auth error:', userError?.message);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
        });
      }
      userId = user.id;
      console.log('[run-optimization-report] Authenticated user:', userId);
    }

    // Verify brand ownership (skip in service-role mode — already trusted)
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, user_id, meta_account_id, meta_access_token, name')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) throw new Error('Brand not found');
    console.log('[run-optimization-report] Brand found:', brand.name, 'meta_account_id:', brand.meta_account_id);
    if (!isServiceRole && brand.user_id !== userId) {
      // Check if user is admin — admins can access any brand
      const { data: roleCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      if (!roleCheck) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403,
        });
      }
      console.log('[run-optimization-report] Admin access granted for user:', userId);
    }

    if (!brand.meta_account_id || !brand.meta_access_token) {
      console.error('[run-optimization-report] Meta not connected for brand:', brand.name);
      throw new Error('Meta account not connected');
    }

    // Fetch active workspaces
    const { data: workspaces } = await supabase
      .from('campaign_workspaces')
      .select('*')
      .eq('brand_id', brandId)
      .in('progress_status', ['live', 'ready_to_publish'])
      .eq('archived', false);

    // Fetch recent ad actions for cross-campaign correlation
    const actionLookbackStart = new Date(new Date(dateRangeStart).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentActions } = await supabase
      .from('ad_action_log')
      .select('*')
      .eq('brand_id', brandId)
      .gte('created_at', actionLookbackStart)
      .order('created_at', { ascending: false });

    console.log('[run-optimization-report] Found', recentActions?.length || 0, 'recent ad actions for correlation');

    console.log('[run-optimization-report] Found', workspaces?.length || 0, 'active workspaces');
    if (!workspaces || workspaces.length === 0) {
      // No active campaigns — save empty report
      const { data: report } = await supabase
        .from('optimization_reports')
        .insert({
          brand_id: brandId,
          created_by: userId,
          date_range_start: dateRangeStart,
          date_range_end: dateRangeEnd,
          report_data: [],
          summary: { green: 0, yellow: 0, red: 0, unconfigured: 0, total: 0 },
        })
        .select()
        .single();

      return new Response(JSON.stringify({ success: true, report }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch goals for all workspaces
    const workspaceIds = workspaces.map(w => w.id);
    const { data: allGoals } = await supabase
      .from('campaign_goals')
      .select('*')
      .in('workspace_id', workspaceIds);

    const goalsMap = new Map((allGoals || []).map(g => [g.workspace_id, g]));

    const campaignResults: any[] = [];
    let greenCount = 0, yellowCount = 0, redCount = 0, unconfiguredCount = 0;

    for (const workspace of workspaces) {
      const goals = goalsMap.get(workspace.id);
      const metaCampaignIds = workspace.meta_campaign_ids as any;

      if (!metaCampaignIds?.campaignId) {
        unconfiguredCount++;
        campaignResults.push({
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          status: 'unconfigured',
          has_goals: !!goals,
          message: 'Campaign not published to Meta',
        });
        continue;
      }

      let campaignId = metaCampaignIds.campaignId;

      if (typeof campaignId === 'string' && campaignId.includes('_')) {
        const parts = campaignId.split('_');
        const numericPart = parts[parts.length - 1];
        const timestamp = parseInt(numericPart);
        const now = Date.now();
        const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
        if (timestamp > oneYearAgo && timestamp <= now) {
          unconfiguredCount++;
          campaignResults.push({
            workspace_id: workspace.id,
            workspace_name: workspace.name,
            status: 'unconfigured',
            has_goals: !!goals,
            message: 'Campaign uses a placeholder ID — not yet published to Meta.',
          });
          continue;
        }
        campaignId = numericPart;
      }

      if (!campaignId || !/^\d+$/.test(campaignId)) {
        unconfiguredCount++;
        campaignResults.push({
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          status: 'unconfigured',
          has_goals: !!goals,
          message: 'Invalid campaign ID',
        });
        continue;
      }

      // Fetch Meta campaign insights
      try {
        console.log('[run-optimization-report] Fetching Meta insights for campaign:', campaignId);
        const insightsUrl = `https://graph.facebook.com/v21.0/${campaignId}/insights?fields=spend,impressions,clicks,ctr,cpm,cpc,actions,cost_per_action_type,frequency,reach&time_range={'since':'${dateRangeStart}','until':'${dateRangeEnd}'}&access_token=${brand.meta_access_token}`;
        const insightsRes = await fetch(insightsUrl);
        const insightsData = await insightsRes.json();
        console.log('[run-optimization-report] Meta response for', campaignId, ':', JSON.stringify(insightsData).slice(0, 500));

        if (insightsData.error) {
          console.error('Meta insights error for campaign', campaignId, insightsData.error);
          campaignResults.push({
            workspace_id: workspace.id,
            workspace_name: workspace.name,
            status: 'error',
            has_goals: !!goals,
            message: insightsData.error.message,
          });
          continue;
        }

        const insight = insightsData.data?.[0];
        if (!insight) {
          campaignResults.push({
            workspace_id: workspace.id,
            workspace_name: workspace.name,
            status: 'no_data',
            has_goals: !!goals,
            message: 'No data for this date range',
          });
          continue;
        }

        // Parse metrics
        const spend = parseFloat(insight.spend || '0');
        const impressions = parseInt(insight.impressions || '0');
        const clicks = parseInt(insight.clicks || '0');
        const ctr = parseFloat(insight.ctr || '0') / 100; // Meta returns as percentage
        const cpm = parseFloat(insight.cpm || '0');
        const cpc = parseFloat(insight.cpc || '0');
        const frequency = parseFloat(insight.frequency || '0');
        const reach = parseInt(insight.reach || '0');

        // Parse actions for conversions
        const actions = insight.actions || [];
        const costPerAction = insight.cost_per_action_type || [];

        const leads = actions.find((a: any) => a.action_type === 'lead')?.value || 0;
        const purchases = actions.find((a: any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')?.value || 0;
        const landingPageViews = actions.find((a: any) => a.action_type === 'landing_page_view')?.value || 0;
        const linkClicks = actions.find((a: any) => a.action_type === 'link_click')?.value || 0;

        const cpl = costPerAction.find((a: any) => a.action_type === 'lead')?.value ? parseFloat(costPerAction.find((a: any) => a.action_type === 'lead').value) : (leads > 0 ? spend / leads : 0);
        const cplpv = landingPageViews > 0 ? spend / landingPageViews : 0;
        const roas = purchases > 0 ? (purchases * parseFloat(workspace.offer_price?.replace(/[^0-9.]/g, '') || '0')) / spend : 0;

        // Build KPI value map
        const kpiValues: Record<string, number> = {
          cplpv, cpc, cpl, cppv: 0, cp2sc: 0, roas, ctr, cpm, purchases: parseInt(String(purchases)),
        };

        // Fetch ad-level breakdown
        let adLevelData: any[] = [];
        try {
          const adsUrl = `https://graph.facebook.com/v21.0/${campaignId}/ads?fields=name,insights.time_range({"since":"${dateRangeStart}","until":"${dateRangeEnd}"}){spend,actions,cost_per_action_type}&limit=50&access_token=${brand.meta_access_token}`;
          const adsRes = await fetch(adsUrl);
          const adsData = await adsRes.json();

          if (adsData.data) {
            adLevelData = adsData.data
              .filter((ad: any) => ad.insights?.data?.[0])
              .map((ad: any) => {
                const adInsight = ad.insights.data[0];
                const adSpend = parseFloat(adInsight.spend || '0');
                const adActions = adInsight.actions || [];
                const adCostPerAction = adInsight.cost_per_action_type || [];
                const adResults = adActions.find((a: any) => a.action_type === 'lead' || a.action_type === 'landing_page_view' || a.action_type === 'link_click')?.value || 0;
                const adCPR = adCostPerAction.find((a: any) => a.action_type === 'lead' || a.action_type === 'landing_page_view')?.value || (adResults > 0 ? adSpend / adResults : 0);
                return {
                  name: ad.name,
                  spend: adSpend,
                  results: parseInt(String(adResults)),
                  costPerResult: parseFloat(String(adCPR)),
                };
              });
          }
        } catch (e) {
          console.error('Ad-level fetch error:', e);
        }

        // Run diagnostic
        if (!goals) {
          unconfiguredCount++;
          campaignResults.push({
            workspace_id: workspace.id,
            workspace_name: workspace.name,
            status: 'unconfigured',
            has_goals: false,
            metrics: { spend, impressions, clicks, ctr, cpm, cpc, frequency, reach, leads, purchases, roas, cpl, cplpv },
            message: 'No performance goals configured',
          });
          continue;
        }

        const primaryKpiValue = kpiValues[goals.primary_kpi] || 0;
        const secondaryKpiValue = goals.secondary_kpi ? (kpiValues[goals.secondary_kpi] || 0) : undefined;

        const diagnosis = diagnoseCampaign(
          { name: workspace.name },
          {
            primaryThreshold: parseFloat(String(goals.primary_kpi_threshold)),
            primaryGoalType: goals.primary_kpi_goal_type,
            secondaryThreshold: goals.secondary_kpi_threshold ? parseFloat(String(goals.secondary_kpi_threshold)) : undefined,
            secondaryGoalType: goals.secondary_kpi_goal_type,
            secondaryKpi: goals.secondary_kpi,
            frequencyThreshold: goals.frequency_threshold ? parseFloat(String(goals.frequency_threshold)) : 4,
          },
          { primaryKpiValue, secondaryKpiValue, frequency, ctr, adLevelData }
        );

        if (diagnosis.status === 'green') greenCount++;
        else if (diagnosis.status === 'yellow') yellowCount++;
        else redCount++;

        campaignResults.push({
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          status: diagnosis.status,
          has_goals: true,
          goals: {
            primary_kpi: goals.primary_kpi,
            primary_kpi_label: goals.primary_kpi_label,
            primary_kpi_goal_type: goals.primary_kpi_goal_type,
            primary_kpi_threshold: goals.primary_kpi_threshold,
            secondary_kpi: goals.secondary_kpi,
            secondary_kpi_label: goals.secondary_kpi_label,
            secondary_kpi_goal_type: goals.secondary_kpi_goal_type,
            secondary_kpi_threshold: goals.secondary_kpi_threshold,
            frequency_threshold: goals.frequency_threshold,
          },
          metrics: { spend, impressions, clicks, ctr, cpm, cpc, frequency, reach, leads, purchases, roas, cpl, cplpv },
          primary_kpi_value: primaryKpiValue,
          secondary_kpi_value: secondaryKpiValue,
          recommendations: diagnosis.recommendations,
          budget_hogs: diagnosis.budgetHogs,
          ad_level_flags: diagnosis.adLevelFlags,
        });
      } catch (e) {
        console.error('Error processing workspace', workspace.id, e);
        campaignResults.push({
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          status: 'error',
          has_goals: !!goals,
          message: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    const summary = { green: greenCount, yellow: yellowCount, red: redCount, unconfigured: unconfiguredCount, total: workspaces.length };

    // Cross-campaign cause-effect analysis
    const crossCampaignInsights: any[] = [];
    if (recentActions && recentActions.length > 0 && campaignResults.length > 1) {
      // Find paused campaigns/ads and check if other campaigns degraded
      const pauseActions = recentActions.filter(a => 
        ['paused_ad', 'campaign_paused', 'creative_swap'].includes(a.action_type)
      );
      
      for (const pauseAction of pauseActions) {
        const pausedWorkspace = campaignResults.find(c => c.workspace_id === pauseAction.workspace_id);
        if (!pausedWorkspace) continue;
        
        // Check if any other campaigns went from good to bad after this action
        const otherCampaigns = campaignResults.filter(c => 
          c.workspace_id !== pauseAction.workspace_id && 
          ['yellow', 'red'].includes(c.status) &&
          c.metrics
        );
        
        for (const degraded of otherCampaigns) {
          crossCampaignInsights.push({
            type: 'cross_campaign_impact',
            priority: 'medium',
            action: `You ${pauseAction.action_type.replace('_', ' ')} in "${pausedWorkspace.workspace_name}" on ${new Date(pauseAction.created_at).toLocaleDateString()}. "${degraded.workspace_name}" may be underperforming as a result — consider whether removing top-of-funnel activity affected downstream campaigns.`,
            icon: '🔗',
            related_workspace: pauseAction.workspace_id,
            affected_workspace: degraded.workspace_id,
          });
        }
      }
    }

    const { data: report, error: reportError } = await supabase
      .from('optimization_reports')
      .insert({
        brand_id: brandId,
        created_by: userId,
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
        report_data: campaignResults,
        summary: { ...summary, cross_campaign_insights: crossCampaignInsights, recent_actions_count: recentActions?.length || 0 },
      })
      .select()
      .single();

    if (reportError) {
      console.error('Error saving report:', reportError);
      throw new Error('Failed to save report');
    }

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error running optimization report:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    });
  }
});

function diagnoseCampaign(
  campaign: { name: string },
  goals: {
    primaryThreshold: number;
    primaryGoalType: string;
    secondaryThreshold?: number;
    secondaryGoalType?: string | null;
    secondaryKpi?: string | null;
    frequencyThreshold: number;
  },
  metaData: {
    primaryKpiValue: number;
    secondaryKpiValue?: number;
    frequency: number;
    ctr: number;
    adLevelData: any[];
  }
) {
  const { primaryKpiValue, secondaryKpiValue, frequency, ctr, adLevelData } = metaData;
  const { primaryThreshold, primaryGoalType, secondaryThreshold, frequencyThreshold } = goals;

  const primaryMet = primaryGoalType === 'less_than'
    ? primaryKpiValue <= primaryThreshold
    : primaryKpiValue >= primaryThreshold;

  const primaryClose = primaryGoalType === 'less_than'
    ? primaryKpiValue <= primaryThreshold * 1.25
    : primaryKpiValue >= primaryThreshold * 0.75;

  const secondaryMet = !secondaryThreshold || (
    goals.secondaryGoalType === 'less_than'
      ? (secondaryKpiValue || 0) <= secondaryThreshold
      : (secondaryKpiValue || 0) >= secondaryThreshold
  );

  const frequencyHigh = frequency >= (frequencyThreshold || 4);

  // Budget hogs
  const avgCPR = adLevelData.length > 0 ? adLevelData.reduce((sum, ad) => sum + ad.costPerResult, 0) / adLevelData.length : 0;
  const totalSpend = adLevelData.reduce((sum, ad) => sum + ad.spend, 0);
  const budgetHogs = totalSpend > 0 ? adLevelData.filter(ad =>
    (ad.spend / totalSpend) > 0.20 && ad.costPerResult > avgCPR * 1.5
  ) : [];

  let status: 'green' | 'yellow' | 'red';
  if (primaryMet && secondaryMet && !frequencyHigh) status = 'green';
  else if (primaryMet && secondaryMet && frequencyHigh) status = 'green';
  else if (primaryClose || (primaryMet && !secondaryMet)) status = 'yellow';
  else status = 'red';

  const recommendations: any[] = [];

  if (status === 'green' && !frequencyHigh) {
    recommendations.push({
      type: 'scale', priority: 'low',
      action: 'Consider scaling budget 20% — campaign is hitting goals with healthy frequency.',
      icon: '📈',
    });
  }
  if (frequencyHigh && status === 'green') {
    recommendations.push({
      type: 'creative_refresh', priority: 'medium',
      action: `Frequency is at ${frequency.toFixed(1)} — results are still good but launch fresh creative soon before performance drops.`,
      icon: '🔄',
    });
  }
  if (frequencyHigh && status !== 'green') {
    recommendations.push({
      type: 'creative_urgent', priority: 'high',
      action: `Frequency at ${frequency.toFixed(1)} with underperforming results — audience is saturated. New creative is urgent. Pause worst-performing ads now.`,
      icon: '🚨',
    });
  }
  if (status === 'yellow' && !frequencyHigh && budgetHogs.length > 0) {
    recommendations.push({
      type: 'budget_hog', priority: 'high',
      action: `${budgetHogs.length} ad(s) are consuming budget without results. Review and pause: ${budgetHogs.map((a: any) => a.name).join(', ')}.`,
      icon: '⚠️',
    });
  }
  if (status === 'red' && ctr < 0.01) {
    recommendations.push({
      type: 'creative_signals', priority: 'high',
      action: "Low CTR suggests the hook and copy aren't pulling the right people. Meta needs stronger signals in your creative — review angles and positioning.",
      icon: '🎯',
    });
  }
  if (status === 'red' && ctr >= 0.01) {
    recommendations.push({
      type: 'ad_level_review', priority: 'high',
      action: "CTR is decent but cost per result is too high. Drill into ad-level breakdown, pause underperformers, and test new audiences or targeting adjustments.",
      icon: '🔍',
    });
  }
  if (goals.secondaryKpi === 'roas' && secondaryKpiValue !== undefined && primaryMet && !secondaryMet) {
    recommendations.push({
      type: 'roas_gap', priority: 'medium',
      action: "Your CPL is at goal but ROAS isn't — the ads are doing their job. Consider testing a purchase-optimized campaign or adjusting your audience to reach higher-intent buyers.",
      icon: '💡',
    });
  }

  return { status, recommendations, budgetHogs, adLevelFlags: budgetHogs };
}
