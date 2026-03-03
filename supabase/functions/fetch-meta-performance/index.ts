import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, dateRangeStart, dateRangeEnd } = await req.json();

    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    // Validate date format to prevent URL injection
    const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRangeStart && !dateFormatRegex.test(dateRangeStart)) {
      throw new Error('Invalid dateRangeStart format. Expected YYYY-MM-DD');
    }
    if (dateRangeEnd && !dateFormatRegex.test(dateRangeEnd)) {
      throw new Error('Invalid dateRangeEnd format. Expected YYYY-MM-DD');
    }
    
    // Additional validation: ensure dates are valid and in reasonable range
    if (dateRangeStart) {
      const startDate = new Date(dateRangeStart);
      if (isNaN(startDate.getTime())) {
        throw new Error('Invalid dateRangeStart value');
      }
    }
    if (dateRangeEnd) {
      const endDate = new Date(dateRangeEnd);
      if (isNaN(endDate.getTime())) {
        throw new Error('Invalid dateRangeEnd value');
      }
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('User authenticated:', user.id);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch workspace with brand to verify ownership
    const { data: workspace, error: workspaceError } = await supabase
      .from('campaign_workspaces')
      .select('*, brands!inner(id, meta_account_id, meta_access_token, user_id)')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      throw new Error('Workspace not found');
    }

    // Verify user owns this workspace via the brand (or is admin)
    const brand = workspace.brands as any;
    if (brand.user_id !== user.id) {
      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        return new Response(
          JSON.stringify({ error: 'Access denied: You do not own this workspace' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }
      console.log('Admin bypass granted for user:', user.id);
    }

    console.log('Ownership verified for workspace:', workspaceId);

    if (!brand.meta_account_id) {
      throw new Error('Meta account not connected. Please connect your Meta ad account in the Dashboard first.');
    }

    const metaAccessToken = brand.meta_access_token;
    if (!metaAccessToken) {
      throw new Error('Meta access token not found. Please reconnect your Meta account.');
    }

    // Check if campaign is actually published to Meta
    if (!workspace.meta_campaign_status || workspace.meta_campaign_status === 'draft') {
      throw new Error('Campaign has not been published to Meta yet. Please publish your campaign first.');
    }

    const metaCampaignIds = workspace.meta_campaign_ids as any;
    if (!metaCampaignIds || !metaCampaignIds.campaignId) {
      throw new Error('Campaign not published to Meta yet');
    }

    let campaignId = metaCampaignIds.campaignId;
    
    // Strip any prefixes (like 'camp_') if present - these are placeholder IDs
    if (typeof campaignId === 'string' && campaignId.includes('_')) {
      const parts = campaignId.split('_');
      const numericPart = parts[parts.length - 1];
      
      // Check if this looks like a timestamp (placeholder ID) rather than a real Meta campaign ID
      const timestamp = parseInt(numericPart);
      const now = Date.now();
      const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
      
      if (timestamp > oneYearAgo && timestamp <= now) {
        throw new Error('This campaign uses a placeholder ID and has not been published to Meta yet. Please build and publish your campaign first.');
      }
      
      // Use the numeric part
      campaignId = numericPart;
    }
    
    // Validate campaign ID format (Meta campaign IDs should be numeric)
    if (!campaignId || !/^\d+$/.test(campaignId)) {
      throw new Error('Invalid Meta campaign ID format. This campaign may not have been properly published to Meta.');
    }

    console.log('Fetching Meta performance for campaign:', campaignId);

    // ============================================
    // STEP 1: Fetch real-time campaign status from Meta
    // ============================================
    const statusUrl = `https://graph.facebook.com/v18.0/${campaignId}?fields=status,effective_status,daily_budget,lifetime_budget&access_token=${metaAccessToken}`;
    const statusResponse = await fetch(statusUrl);
    const statusData = await statusResponse.json();

    if (statusData.error) {
      console.error('Meta API status error:', statusData.error);
      throw new Error(`Meta API error: ${statusData.error.message}`);
    }

    const effectiveStatus = statusData.effective_status || statusData.status || 'UNKNOWN';
    // daily_budget from Meta is in cents (minor units), convert to dollars
    const metaDailyBudget = statusData.daily_budget ? parseFloat(statusData.daily_budget) / 100 : null;
    const metaLifetimeBudget = statusData.lifetime_budget ? parseFloat(statusData.lifetime_budget) / 100 : null;
    console.log(`Campaign ${campaignId} effective_status: ${effectiveStatus}, daily_budget: ${metaDailyBudget}`);

    // Update workspace status if it changed
    const newStatus = effectiveStatus.toLowerCase();
    if (workspace.meta_campaign_status !== newStatus) {
      console.log(`Updating workspace status from ${workspace.meta_campaign_status} to ${newStatus}`);
      await supabase
        .from('campaign_workspaces')
        .update({ meta_campaign_status: newStatus })
        .eq('id', workspaceId);
    }

    // If campaign is not ACTIVE, return early with status info
    if (effectiveStatus !== 'ACTIVE') {
      console.log(`Campaign ${campaignId} is ${effectiveStatus}, not ACTIVE - skipping metrics fetch`);
      return new Response(
        JSON.stringify({
          success: true,
          metrics: null,
          status: effectiveStatus,
          dailyBudget: metaDailyBudget,
          lifetimeBudget: metaLifetimeBudget,
          message: `Campaign is ${effectiveStatus}, not ACTIVE`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ============================================
    // STEP 2: Fetch insights for ACTIVE campaigns
    // ============================================
    const adSetIds = metaCampaignIds.adSetIds || [];
    const adIds = metaCampaignIds.adIds || [];

    // Build date range params
    const timeRange = dateRangeStart && dateRangeEnd
      ? `time_range={'since':'${dateRangeStart}','until':'${dateRangeEnd}'}`
      : `date_preset=last_7d`;

    // Fetch Campaign-level insights - including video_p100_watched_actions for thruplay data
    const campaignInsightsUrl = `https://graph.facebook.com/v18.0/${campaignId}/insights?fields=spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type,video_p100_watched_actions&${timeRange}&access_token=${metaAccessToken}`;
    
    const campaignResponse = await fetch(campaignInsightsUrl);
    const campaignData = await campaignResponse.json();

    if (campaignData.error) {
      console.error('Meta API error:', campaignData.error);
      throw new Error(`Meta API error: ${campaignData.error.message}`);
    }

    const campaignMetrics = campaignData.data?.[0] || {};

    // Fetch Ad Set-level insights
    const adSetMetrics = [];
    for (const adSetId of adSetIds) {
      const adSetUrl = `https://graph.facebook.com/v18.0/${adSetId}/insights?fields=spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type&${timeRange}&access_token=${metaAccessToken}`;
      const adSetResponse = await fetch(adSetUrl);
      const adSetData = await adSetResponse.json();
      
      if (adSetData.data?.[0]) {
        adSetMetrics.push({
          adSetId,
          ...adSetData.data[0]
        });
      }
    }

    // Fetch Ad-level insights
    const adMetrics = [];
    for (const adId of adIds) {
      const adUrl = `https://graph.facebook.com/v18.0/${adId}/insights?fields=spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type&${timeRange}&access_token=${metaAccessToken}`;
      const adResponse = await fetch(adUrl);
      const adData = await adResponse.json();
      
      if (adData.data?.[0]) {
        adMetrics.push({
          adId,
          ...adData.data[0]
        });
      }
    }

    // Extract key metrics with safe parsing
    const extractMetric = (obj: any, field: string, defaultVal = 0) => {
      return parseFloat(obj[field]) || defaultVal;
    };

    const extractAction = (actions: any[], actionType: string) => {
      if (!Array.isArray(actions)) return 0;
      const action = actions.find((a: any) => a.action_type === actionType);
      return action ? parseFloat(action.value) || 0 : 0;
    };

    const extractCostPerAction = (costPerActions: any[], actionType: string) => {
      if (!Array.isArray(costPerActions)) return 0;
      const action = costPerActions.find((a: any) => a.action_type === actionType);
      return action ? parseFloat(action.value) || 0 : 0;
    };

    // FIX: Extract video thruplay count from video_p100_watched_actions array
    const extractVideoThruPlays = (videoActions: any[]) => {
      if (!Array.isArray(videoActions)) return 0;
      // The video_p100_watched_actions is an array with action_type and value
      const thruPlayAction = videoActions.find((a: any) => a.action_type === 'video_view');
      return thruPlayAction ? parseFloat(thruPlayAction.value) || 0 : 0;
    };

    // Get video thruplay count - check both dedicated field and actions
    const videoThruPlays = campaignMetrics.video_p100_watched_actions
      ? extractVideoThruPlays(campaignMetrics.video_p100_watched_actions)
      : extractAction(campaignMetrics.actions, 'video_view'); // Fallback to video_view if no thruplay data

    const spend = extractMetric(campaignMetrics, 'spend');

    const processedMetrics = {
      spend,
      impressions: extractMetric(campaignMetrics, 'impressions'),
      reach: extractMetric(campaignMetrics, 'reach'),
      clicks: extractMetric(campaignMetrics, 'clicks'),
      ctr: extractMetric(campaignMetrics, 'ctr'),
      cpc: extractMetric(campaignMetrics, 'cpc'),
      cpm: extractMetric(campaignMetrics, 'cpm'),
      frequency: extractMetric(campaignMetrics, 'frequency'),
      
      // Conversion actions
      leads: extractAction(campaignMetrics.actions, 'lead'),
      purchases: extractAction(campaignMetrics.actions, 'purchase'),
      addToCart: extractAction(campaignMetrics.actions, 'add_to_cart'),
      linkClicks: extractAction(campaignMetrics.actions, 'link_click'),
      videoViews: extractAction(campaignMetrics.actions, 'video_view'),
      videoThruPlays,
      profileVisits: extractAction(campaignMetrics.actions, 'onsite_conversion.messaging_first_reply') || 
                     extractAction(campaignMetrics.actions, 'landing_page_view'),
      
      // Cost per actions
      cpl: extractCostPerAction(campaignMetrics.cost_per_action_type, 'lead'),
      cpp: extractCostPerAction(campaignMetrics.cost_per_action_type, 'purchase'),
      costPerAddToCart: extractCostPerAction(campaignMetrics.cost_per_action_type, 'add_to_cart'),
      
      // Calculate cost per thruplay
      costPerThruPlay: videoThruPlays > 0 ? spend / videoThruPlays : 0,
      
      // ROAS calculation
      roas: campaignMetrics.purchase_roas ? extractMetric(campaignMetrics, 'purchase_roas') : null,
    };

    // Save to performance_history
    const performanceSnapshot = {
      metrics: processedMetrics,
      rawCampaignData: campaignMetrics,
      adSetMetrics,
      adMetrics,
      dateRange: {
        start: dateRangeStart || 'last_7d',
        end: dateRangeEnd || 'last_7d',
      },
      syncedAt: new Date().toISOString(),
    };

    const currentHistory = workspace.performance_history || [];
    const updatedHistory = [...currentHistory, performanceSnapshot];

    await supabase
      .from('campaign_workspaces')
      .update({
        performance_history: updatedHistory,
        meta_insights_last_sync: new Date().toISOString(),
      })
      .eq('id', workspaceId);

    console.log('Performance data saved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        metrics: processedMetrics,
        status: effectiveStatus,
        dailyBudget: metaDailyBudget,
        lifetimeBudget: metaLifetimeBudget,
        snapshot: performanceSnapshot,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error fetching Meta performance:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
