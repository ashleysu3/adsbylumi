import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

interface AdMetrics {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  purchases: number;
  cpl: number;
  cpp: number;
  roas: number | null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, dateRangeStart, dateRangeEnd } = await req.json();

    if (!workspaceId) {
      throw new Error('workspaceId is required');
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

    // Fetch workspace with brand including meta_access_token
    const { data: workspace, error: workspaceError } = await supabase
      .from('campaign_workspaces')
      .select('*, brands!inner(id, meta_account_id, meta_access_token, user_id)')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      throw new Error('Workspace not found');
    }

    const brand = workspace.brands as any;
    if (brand.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const metaCampaignIds = workspace.meta_campaign_ids as any;
    if (!metaCampaignIds?.campaignId) {
      throw new Error('Campaign not published to Meta');
    }

    const metaAccessToken = brand.meta_access_token;
    if (!metaAccessToken) {
      throw new Error('Meta access token not found. Please reconnect your Meta account.');
    }

    const campaignId = metaCampaignIds.campaignId;
    console.log(`Fetching ad breakdown for campaign ${campaignId}`);

    // Time range
    const timeRange = dateRangeStart && dateRangeEnd 
      ? `time_range={"since":"${dateRangeStart}","until":"${dateRangeEnd}"}`
      : 'date_preset=last_7d';

    // Fetch ads within this campaign
    const adsUrl = `https://graph.facebook.com/v25.0/${campaignId}/ads?fields=id,name,status&limit=100&access_token=${metaAccessToken}`;
    const adsResponse = await fetch(adsUrl);
    const adsData = await adsResponse.json();

    if (!adsResponse.ok) {
      console.error('Failed to fetch ads:', adsData);
      const errorCode = adsData.error?.code;
      const errorMsg = adsData.error?.message || 'Failed to fetch ads';
      // Rate limit error - return friendly message with 429 status
      if (errorCode === 17 || errorCode === 32 || adsData.error?.error_subcode === 2446079) {
        return new Response(
          JSON.stringify({ error: 'Meta API rate limit reached. Please wait a few minutes and try again.', success: false, rateLimited: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      }
      throw new Error(errorMsg);
    }

    const ads = adsData.data || [];
    console.log(`Found ${ads.length} ads in campaign`);

    // Fetch insights at ad level
    const insightsUrl = `https://graph.facebook.com/v25.0/${campaignId}/insights?level=ad&${timeRange}&fields=ad_id,ad_name,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,purchase_roas&limit=100&access_token=${metaAccessToken}`;
    const insightsResponse = await fetch(insightsUrl);
    const insightsData = await insightsResponse.json();

    if (!insightsResponse.ok) {
      console.error('Failed to fetch ad insights:', insightsData);
      throw new Error(insightsData.error?.message || 'Failed to fetch ad insights');
    }

    // Helper functions
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

    // Map insights to ads
    const adMetrics: AdMetrics[] = (insightsData.data || []).map((insight: any) => {
      const ad = ads.find((a: any) => a.id === insight.ad_id);
      return {
        id: insight.ad_id,
        name: insight.ad_name || ad?.name || 'Unknown Ad',
        status: ad?.status || 'UNKNOWN',
        spend: parseFloat(insight.spend) || 0,
        impressions: parseInt(insight.impressions) || 0,
        clicks: parseInt(insight.clicks) || 0,
        ctr: parseFloat(insight.ctr) || 0,
        cpc: parseFloat(insight.cpc) || 0,
        leads: extractAction(insight.actions, 'lead'),
        purchases: extractAction(insight.actions, 'purchase'),
        cpl: extractCostPerAction(insight.cost_per_action_type, 'lead'),
        cpp: extractCostPerAction(insight.cost_per_action_type, 'purchase'),
        roas: insight.purchase_roas?.[0]?.value ? parseFloat(insight.purchase_roas[0].value) : null,
      };
    });

    // Sort by spend descending
    adMetrics.sort((a, b) => b.spend - a.spend);

    console.log(`Returning ${adMetrics.length} ads with metrics`);

    return new Response(
      JSON.stringify({
        success: true,
        ads: adMetrics,
        totalAds: ads.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error in fetch-ad-breakdown:', error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
