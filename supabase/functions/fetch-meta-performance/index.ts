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
    
    // Retry auth up to 3 times to handle transient TLS errors
    let user = null;
    let authError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await supabaseAuth.auth.getUser(token);
      authError = result.error;
      user = result.data?.user ?? null;
      if (!authError && user) break;
      if (attempt < 2) {
        console.warn(`[fetch-meta-performance] Auth attempt ${attempt + 1} failed:`, authError?.message);
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    
    if (authError || !user) {
      console.error('[fetch-meta-performance] Auth failed after retries:', authError?.message);
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

    // Check if campaign is actually published to Meta. Return a soft 200
    // so the UI can skip metrics for this workspace without crashing the page.
    const metaCampaignIds = workspace.meta_campaign_ids as any;
    const notPublished =
      !workspace.meta_campaign_status ||
      workspace.meta_campaign_status === 'draft' ||
      !metaCampaignIds ||
      !metaCampaignIds.campaignId;

    if (notPublished) {
      console.log('Campaign not published to Meta yet — returning soft response');
      return new Response(
        JSON.stringify({
          success: false,
          notPublished: true,
          error: 'CAMPAIGN_NOT_PUBLISHED',
          message: 'Campaign has not been published to Meta yet.',
          metrics: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
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
        return new Response(
          JSON.stringify({
            success: false,
            notPublished: true,
            error: 'CAMPAIGN_NOT_PUBLISHED',
            message: 'Campaign uses a placeholder ID and has not been published to Meta yet.',
            metrics: null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      // Use the numeric part
      campaignId = numericPart;
    }
    
    // Validate campaign ID format (Meta campaign IDs should be numeric)
    if (!campaignId || !/^\d+$/.test(campaignId)) {
      return new Response(
        JSON.stringify({
          success: false,
          notPublished: true,
          error: 'CAMPAIGN_NOT_PUBLISHED',
          message: 'Invalid Meta campaign ID format. This campaign may not have been properly published to Meta.',
          metrics: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('Fetching Meta performance for campaign:', campaignId);

    // Safe JSON parser for Meta API responses
    const safeJson = async (response: Response): Promise<any> => {
      const text = await response.text();
      if (!text || !text.trim()) return {};
      try { return JSON.parse(text); } catch { console.error('Failed to parse Meta response:', text.substring(0, 200)); return {}; }
    };

    // ============================================
    // STEP 1: Fetch real-time campaign status from Meta
    // ============================================
    const statusUrl = `https://graph.facebook.com/v21.0/${campaignId}?fields=status,effective_status,daily_budget,lifetime_budget&access_token=${metaAccessToken}`;
    const statusResponse = await fetch(statusUrl);
    const statusData = await safeJson(statusResponse);

    if (statusData.error) {
      console.error('Meta API status error:', statusData.error);
      throw new Error(`Meta API error: ${statusData.error.message}`);
    }

    const effectiveStatus = statusData.effective_status || statusData.status || 'UNKNOWN';

    // ============================================
    // BUDGET RESOLUTION: Campaign-level first, then ad set aggregation (ABO)
    // ============================================
    let resolvedDailyBudget: number | null = null;
    let resolvedLifetimeBudget: number | null = null;
    let budgetLevel: 'campaign' | 'adset' | null = null;

    // Campaign-level budget (Meta returns cents/minor units)
    if (statusData.daily_budget) {
      resolvedDailyBudget = parseFloat(statusData.daily_budget) / 100;
      budgetLevel = 'campaign';
    }
    if (statusData.lifetime_budget) {
      resolvedLifetimeBudget = parseFloat(statusData.lifetime_budget) / 100;
      if (!budgetLevel) budgetLevel = 'campaign';
    }

    // If no campaign-level budget, fetch ad set budgets (ABO campaigns)
    if (!resolvedDailyBudget && !resolvedLifetimeBudget) {
      try {
        const adSetsUrl = `https://graph.facebook.com/v21.0/${campaignId}/adsets?fields=daily_budget,lifetime_budget,status&limit=100&access_token=${metaAccessToken}`;
        const adSetsResponse = await fetch(adSetsUrl);
        const adSetsData = await safeJson(adSetsResponse);

        if (adSetsData.data && Array.isArray(adSetsData.data)) {
          let totalDailyBudget = 0;
          let totalLifetimeBudget = 0;
          let hasDaily = false;
          let hasLifetime = false;

          for (const adSet of adSetsData.data) {
            // Only sum ACTIVE ad sets
            if (adSet.status !== 'ACTIVE') continue;
            if (adSet.daily_budget) {
              totalDailyBudget += parseFloat(adSet.daily_budget) / 100;
              hasDaily = true;
            }
            if (adSet.lifetime_budget) {
              totalLifetimeBudget += parseFloat(adSet.lifetime_budget) / 100;
              hasLifetime = true;
            }
          }

          if (hasDaily) {
            resolvedDailyBudget = totalDailyBudget;
            budgetLevel = 'adset';
          }
          if (hasLifetime) {
            resolvedLifetimeBudget = totalLifetimeBudget;
            if (!budgetLevel) budgetLevel = 'adset';
          }
          console.log(`ABO budget aggregation: daily=${resolvedDailyBudget}, lifetime=${resolvedLifetimeBudget}, adsets=${adSetsData.data.length}`);
        }
      } catch (adSetErr) {
        console.error('Error fetching ad set budgets:', adSetErr);
      }
    }

    console.log(`Campaign ${campaignId} effective_status: ${effectiveStatus}, daily_budget: ${resolvedDailyBudget}, budget_level: ${budgetLevel}`);

    // Update workspace status if it changed
    const newStatus = effectiveStatus.toLowerCase();
    if (workspace.meta_campaign_status !== newStatus) {
      console.log(`Updating workspace status from ${workspace.meta_campaign_status} to ${newStatus}`);
      await supabase
        .from('campaign_workspaces')
        .update({ meta_campaign_status: newStatus })
        .eq('id', workspaceId);
    }

    // NOTE: We used to return early here when the campaign wasn't currently
    // ACTIVE. That was wrong — a campaign that was paused yesterday still
    // spent real money during the selected window, and excluding it caused
    // LUMI to hallucinate budgets / spend (e.g. saying $25/day when the
    // user is actually spending $185/day). We now ALWAYS fetch insights for
    // the requested date range; status is reported alongside but does not
    // gate the metrics.
    console.log(`Campaign ${campaignId} effective_status=${effectiveStatus} — fetching insights for requested range regardless of current status`);

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
    // (safeJson helper defined above)

    const campaignInsightsUrl = `https://graph.facebook.com/v21.0/${campaignId}/insights?fields=spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type,video_p100_watched_actions,purchase_roas&${timeRange}&access_token=${metaAccessToken}`;
    
    const campaignResponse = await fetch(campaignInsightsUrl);
    const campaignData = await safeJson(campaignResponse);

    if (campaignData.error) {
      console.error('Meta API error:', campaignData.error);
      throw new Error(`Meta API error: ${campaignData.error.message}`);
    }

    const campaignMetrics = campaignData.data?.[0] || {};

    // Fetch Ad Set-level insights
    const adSetMetrics = [];
    for (const adSetId of adSetIds) {
      try {
        const adSetUrl = `https://graph.facebook.com/v21.0/${adSetId}/insights?fields=spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type&${timeRange}&access_token=${metaAccessToken}`;
        const adSetResponse = await fetch(adSetUrl);
        const adSetData = await safeJson(adSetResponse);
        if (adSetData.data?.[0]) {
          adSetMetrics.push({ adSetId, ...adSetData.data[0] });
        }
      } catch (e) { console.error(`Error fetching ad set ${adSetId}:`, e); }
    }

    // Fetch Ad-level insights
    const adMetrics = [];
    for (const adId of adIds) {
      try {
        const adUrl = `https://graph.facebook.com/v21.0/${adId}/insights?fields=spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type&${timeRange}&access_token=${metaAccessToken}`;
        const adResponse = await fetch(adUrl);
        const adData = await safeJson(adResponse);
        if (adData.data?.[0]) {
          adMetrics.push({ adId, ...adData.data[0] });
        }
      } catch (e) { console.error(`Error fetching ad ${adId}:`, e); }
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

    const rawMetrics = {
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
      
      // ROAS calculation — purchase_roas is an array like [{action_type: "omni_purchase", value: "2.5"}]
      roas: (() => {
        const roasArr = campaignMetrics.purchase_roas;
        if (Array.isArray(roasArr) && roasArr.length > 0) {
          return parseFloat(roasArr[0].value) || null;
        }
        // Fallback: compute from purchase value / spend
        const purchaseValue = extractAction(campaignMetrics.actions, 'omni_purchase') || extractAction(campaignMetrics.actions, 'purchase');
        const costPerPurchase = extractCostPerAction(campaignMetrics.cost_per_action_type, 'purchase');
        if (purchaseValue > 0 && spend > 0) {
          return purchaseValue / spend;
        }
        return null;
      })(),
    };

    // ============================================
    // METRIC INTEGRITY VALIDATION
    // ============================================
    const validateMetric = (value: any): number | null => {
      if (value === null || value === undefined) return null;
      const num = Number(value);
      if (isNaN(num) || num < 0) return null;
      return num;
    };

    const processedMetrics: Record<string, number | null> = {};
    for (const [key, value] of Object.entries(rawMetrics)) {
      processedMetrics[key] = validateMetric(value);
    }

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
        dailyBudget: resolvedDailyBudget,
        lifetimeBudget: resolvedLifetimeBudget,
        budgetLevel,
        snapshot: performanceSnapshot,
        dataIntegrity: { verified: true, source: 'meta_api', fetchedAt: new Date().toISOString() },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error fetching Meta performance:', error);
    const message = error?.message || 'Unknown error';
    const isTokenInvalid =
      message.includes('Error validating access token') ||
      message.includes('session has been invalidated') ||
      message.includes('OAuthException');

    if (isTokenInvalid) {
      return new Response(
        JSON.stringify({
          success: false,
          tokenInvalid: true,
          error: 'META_TOKEN_INVALID',
          message: 'Your Meta connection has expired. Please reconnect your Meta account.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ error: message, success: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
