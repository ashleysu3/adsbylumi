import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, answers } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaAppId = Deno.env.get('META_APP_ID');
    const metaAppSecret = Deno.env.get('META_APP_SECRET');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch workspace with brand data
    const { data: workspace, error: workspaceError } = await supabase
      .from('campaign_workspaces')
      .select(`
        *,
        brands!inner(*)
      `)
      .eq('id', workspaceId)
      .single();

    if (workspaceError) throw workspaceError;

    const brand = workspace.brands;
    const metaAccountId = brand.meta_account_id;
    
    if (!metaAccountId) {
      throw new Error('Meta account not connected for this brand');
    }

    console.log('Building campaign for workspace:', workspaceId);
    console.log('Answers:', answers);

    // Get approved production items
    const approvedConcepts = workspace.production_items?.filter((item: any) => item.status === 'approved') || [];
    
    if (approvedConcepts.length < 3) {
      throw new Error('At least 3 approved concepts are required');
    }

    // For this MVP, we'll simulate campaign creation
    // In production, you would:
    // 1. Upload creative assets to Meta
    // 2. Create Campaign via Meta Graph API
    // 3. Create Ad Set(s)
    // 4. Create Ads

    // Simulated campaign IDs
    const campaignIds = {
      campaignId: `camp_${Date.now()}`,
      adSetIds: [
        `adset_cold_${Date.now()}`,
        answers.warmRetargeting ? `adset_warm_${Date.now()}` : null
      ].filter(Boolean),
      adIds: approvedConcepts.map((_: any, i: number) => `ad_${Date.now()}_${i}`)
    };

    console.log('Campaign created (simulated):', campaignIds);

    // In production, you would make these Meta API calls:
    /*
    // 1. Create Campaign
    const campaignResponse = await fetch(`https://graph.facebook.com/v18.0/act_${metaAccountId}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: answers.campaignName,
        objective: 'OUTCOME_LEADS',
        status: 'PAUSED',
        special_ad_categories: [],
        access_token: metaAccessToken
      })
    });

    // 2. Create Ad Set
    const adSetResponse = await fetch(`https://graph.facebook.com/v18.0/act_${metaAccountId}/adsets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: campaignId,
        name: `${answers.campaignName} - Cold`,
        optimization_goal: answers.optimizationEvent,
        billing_event: 'IMPRESSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: answers.budget * 100, // cents
        targeting: { geo_locations: { countries: ['US'] } },
        status: 'PAUSED',
        access_token: metaAccessToken
      })
    });

    // 3. Create Ads (for each concept)
    for (const concept of approvedConcepts) {
      await fetch(`https://graph.facebook.com/v18.0/act_${metaAccountId}/ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adset_id: adSetId,
          name: concept.concept.title,
          creative: {
            // ... creative spec
          },
          status: 'PAUSED',
          access_token: metaAccessToken
        })
      });
    }
    */

    return new Response(
      JSON.stringify({
        success: true,
        campaignIds,
        message: 'Campaign created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error building campaign:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
