import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId, dateRangeStart, dateRangeEnd } = await req.json();

    if (!brandId) {
      throw new Error('brandId is required');
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch brand to verify ownership and get Meta account + token
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, meta_account_id, meta_access_token, user_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      throw new Error('Brand not found');
    }

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
          JSON.stringify({ error: 'Access denied' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }
    }

    if (!brand.meta_account_id) {
      throw new Error('Meta account not connected');
    }

    const metaAccessToken = brand.meta_access_token;
    if (!metaAccessToken) {
      throw new Error('Meta access token not found. Please reconnect your Meta account.');
    }

    console.log(`Fetching account overview for brand ${brandId}, date range: ${dateRangeStart} to ${dateRangeEnd}`);

    // Fetch account-level insights from Meta
    // IMPORTANT: Add filtering to only include ACTIVE campaigns
    const timeRange = dateRangeStart && dateRangeEnd 
      ? `time_range={"since":"${dateRangeStart}","until":"${dateRangeEnd}"}`
      : 'date_preset=last_7d';

    // URL-encode the filtering parameter to only include active campaigns
    const filtering = encodeURIComponent('[{"field":"campaign.delivery_info","operator":"IN","value":["active"]}]');
    
    const insightsUrl = `https://graph.facebook.com/v25.0/${brand.meta_account_id}/insights?${timeRange}&fields=spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type,purchase_roas&level=account&filtering=${filtering}&access_token=${metaAccessToken}`;

    console.log('Fetching insights with active-only filter');
    const insightsResponse = await fetch(insightsUrl);
    const insightsData = await insightsResponse.json();

    if (!insightsResponse.ok) {
      console.error('Meta API error:', insightsData);
      throw new Error(insightsData.error?.message || 'Failed to fetch account insights');
    }

    const metrics = insightsData.data?.[0] || {};

    // Extract helper functions
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

    const accountMetrics = {
      spend: extractMetric(metrics, 'spend'),
      impressions: extractMetric(metrics, 'impressions'),
      reach: extractMetric(metrics, 'reach'),
      clicks: extractMetric(metrics, 'clicks'),
      ctr: extractMetric(metrics, 'ctr'),
      cpc: extractMetric(metrics, 'cpc'),
      cpm: extractMetric(metrics, 'cpm'),
      frequency: extractMetric(metrics, 'frequency'),
      leads: extractAction(metrics.actions, 'lead'),
      purchases: extractAction(metrics.actions, 'purchase'),
      linkClicks: extractAction(metrics.actions, 'link_click'),
      cpl: extractCostPerAction(metrics.cost_per_action_type, 'lead'),
      cpp: extractCostPerAction(metrics.cost_per_action_type, 'purchase'),
      roas: metrics.purchase_roas?.[0]?.value ? parseFloat(metrics.purchase_roas[0].value) : null,
    };

    console.log('Account metrics fetched (active campaigns only):', accountMetrics);

    return new Response(
      JSON.stringify({
        success: true,
        metrics: accountMetrics,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error in fetch-account-overview:', error);
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
