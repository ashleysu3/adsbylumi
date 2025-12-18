import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  created_time: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      brandId,
      metaAccountId: metaAccountIdFromBody,
      metaAccessToken: metaAccessTokenFromBody,
      campaignIds,
    } = (body || {}) as {
      brandId?: string;
      metaAccountId?: string;
      metaAccessToken?: string;
      campaignIds?: string[];
    };

    if (!brandId) {
      throw new Error('brandId is required');
    }

    // Initialize Supabase client (service role)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolve Meta account ID (can be provided, or pulled from the brand)
    let metaAccountId = metaAccountIdFromBody;
    if (!metaAccountId) {
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('meta_account_id')
        .eq('id', brandId)
        .maybeSingle();

      if (brandError) {
        console.error('Error fetching brand meta_account_id:', brandError);
      }

      metaAccountId = brand?.meta_account_id ?? undefined;
    }

    if (!metaAccountId) {
      throw new Error('Meta account not connected. Please select an ad account.');
    }

    // Resolve Meta access token (can be provided, or pulled server-side)
    let metaAccessToken = metaAccessTokenFromBody;
    if (!metaAccessToken) {
      const { data: tokenData, error: tokenError } = await supabase.rpc('get_meta_token', {
        p_brand_id: brandId,
      });

      if (tokenError) {
        console.error('Error retrieving Meta token via get_meta_token:', tokenError);
      }

      metaAccessToken = (tokenData as string | null) ?? undefined;
    }

    if (!metaAccessToken) {
      throw new Error('Meta access token not found. Please reconnect your Meta account.');
    }

    console.log('Starting campaign sync for brand:', brandId);
    console.log('Meta account:', metaAccountId);
    console.log('Specific campaign IDs to sync:', campaignIds || 'all active');

    // Fetch campaigns from Meta API
    const campaignsUrl = `https://graph.facebook.com/v18.0/${metaAccountId}/campaigns?fields=id,name,status,objective,created_time,daily_budget,lifetime_budget&limit=500&access_token=${metaAccessToken}`;

    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    if (!campaignsResponse.ok) {
      console.error('Failed to fetch campaigns from Meta:', campaignsData);
      throw new Error(campaignsData.error?.message || 'Failed to fetch campaigns from Meta');
    }

    const allCampaigns: MetaCampaign[] = campaignsData.data || [];
    console.log(`Fetched ${allCampaigns.length} total campaigns from Meta`);

    // Filter campaigns based on whether specific IDs were provided
    let campaignsToSync: MetaCampaign[];

    if (campaignIds && Array.isArray(campaignIds) && campaignIds.length > 0) {
      // Sync only the specified campaigns (any status)
      const campaignIdSet = new Set(campaignIds);
      campaignsToSync = allCampaigns.filter((campaign) => campaignIdSet.has(campaign.id));
      console.log(`Found ${campaignsToSync.length} campaigns matching specified IDs`);
    } else {
      // Default behavior: sync only active campaigns
      campaignsToSync = allCampaigns.filter((campaign) => campaign.status === 'ACTIVE');
      console.log(`Found ${campaignsToSync.length} active campaigns`);
    }

    if (campaignsToSync.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          synced: 0,
          skipped: 0,
          message: campaignIds ? 'No matching campaigns found' : 'No active campaigns found to sync',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Fetch existing workspaces for this brand to check for duplicates
    const { data: existingWorkspaces, error: fetchError } = await supabase
      .from('campaign_workspaces')
      .select('id, meta_campaign_ids')
      .eq('brand_id', brandId);

    if (fetchError) {
      console.error('Error fetching existing workspaces:', fetchError);
      throw fetchError;
    }

    // Create a set of existing campaign IDs for quick lookup
    const existingCampaignIds = new Set(
      (existingWorkspaces || [])
        .map((w) => (w.meta_campaign_ids as any)?.campaignId)
        .filter(Boolean)
    );

    console.log(`Found ${existingCampaignIds.size} existing campaign workspaces`);

    // Helper function to fetch performance data for a campaign
    const fetchCampaignPerformance = async (campaignId: string, accessToken: string) => {
      try {
        const timeRange = 'date_preset=last_7d';
        const insightsUrl = `https://graph.facebook.com/v18.0/${campaignId}/insights?fields=spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type&${timeRange}&access_token=${accessToken}`;
        
        const response = await fetch(insightsUrl);
        const data = await response.json();
        
        if (data.error) {
          console.error(`Performance fetch error for ${campaignId}:`, data.error);
          return null;
        }
        
        const metrics = data.data?.[0] || {};
        
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
        
        return {
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
          addToCart: extractAction(metrics.actions, 'add_to_cart'),
          cpl: extractCostPerAction(metrics.cost_per_action_type, 'lead'),
          cpp: extractCostPerAction(metrics.cost_per_action_type, 'purchase'),
          roas: metrics.purchase_roas ? extractMetric(metrics, 'purchase_roas') : null,
        };
      } catch (error) {
        console.error(`Failed to fetch performance for campaign ${campaignId}:`, error);
        return null;
      }
    };

    // Sync campaigns
    let synced = 0;
    let skipped = 0;
    const syncedCampaigns = [];

    for (const campaign of campaignsToSync) {
      // Check if campaign already exists
      if (existingCampaignIds.has(campaign.id)) {
        console.log(`Skipping duplicate campaign: ${campaign.name} (${campaign.id})`);
        skipped++;
        continue;
      }

      // Determine campaign status based on Meta status
      const metaStatus = campaign.status === 'ACTIVE' ? 'active' : 
                         campaign.status === 'PAUSED' ? 'paused' : 
                         campaign.status === 'ARCHIVED' ? 'archived' : 'unknown';

      // Fetch initial performance data
      console.log(`Fetching performance data for: ${campaign.name} (${campaign.id})`);
      const performanceMetrics = await fetchCampaignPerformance(campaign.id, metaAccessToken);
      
      // Prepare initial performance snapshot if data was fetched
      const initialPerformanceHistory = performanceMetrics ? [{
        metrics: performanceMetrics,
        dateRange: {
          start: 'last_7d',
          end: 'last_7d',
        },
        syncedAt: new Date().toISOString(),
      }] : [];

      // Create new workspace record with initial performance data
      // Mark as 'imported' to indicate it needs an offer linked before creative generation
      const { data: newWorkspace, error: insertError } = await supabase
        .from('campaign_workspaces')
        .insert({
          brand_id: brandId,
          name: campaign.name,
          meta_campaign_ids: { campaignId: campaign.id },
          meta_campaign_status: metaStatus,
          progress_status: 'imported', // Always 'imported' - needs offer link for creative
          published_at: new Date().toISOString(),
          performance_history: initialPerformanceHistory,
          meta_insights_last_sync: performanceMetrics ? new Date().toISOString() : null,
          // Leave strategy_json, creative_json, and offer fields null initially
          // User will link an offer later to enable creative generation
        })
        .select()
        .single();

      if (insertError) {
        console.error(`Failed to create workspace for campaign ${campaign.id}:`, insertError);
        skipped++;
        continue;
      }

      console.log(`Synced campaign with performance data: ${campaign.name} (${campaign.id})`);
      synced++;
      syncedCampaigns.push({
        id: campaign.id,
        name: campaign.name,
        workspaceId: newWorkspace.id,
        hasPerformanceData: !!performanceMetrics,
      });
    }

    console.log(`Campaign sync complete: ${synced} synced, ${skipped} skipped`);

    return new Response(
      JSON.stringify({ 
        success: true,
        synced,
        skipped,
        campaigns: syncedCampaigns,
        message: `Successfully synced ${synced} campaign${synced !== 1 ? 's' : ''}`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in sync-meta-campaigns:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
