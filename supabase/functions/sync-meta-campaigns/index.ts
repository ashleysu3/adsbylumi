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
    const { brandId, metaAccountId, metaAccessToken } = await req.json();
    
    if (!brandId || !metaAccountId || !metaAccessToken) {
      throw new Error('brandId, metaAccountId, and metaAccessToken are required');
    }

    console.log('Starting campaign sync for brand:', brandId);

    // Fetch campaigns from Meta API
    const campaignsUrl = `https://graph.facebook.com/v18.0/${metaAccountId}/campaigns?fields=id,name,status,objective,created_time,daily_budget,lifetime_budget&limit=100&access_token=${metaAccessToken}`;
    
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    if (!campaignsResponse.ok) {
      console.error('Failed to fetch campaigns from Meta:', campaignsData);
      throw new Error(campaignsData.error?.message || 'Failed to fetch campaigns from Meta');
    }

    const campaigns: MetaCampaign[] = campaignsData.data || [];
    console.log(`Fetched ${campaigns.length} total campaigns from Meta`);

    // Filter for active campaigns only
    const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'ACTIVE');
    console.log(`Found ${activeCampaigns.length} active campaigns`);

    if (activeCampaigns.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          synced: 0,
          skipped: 0,
          message: 'No active campaigns found to sync'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Sync campaigns
    let synced = 0;
    let skipped = 0;
    const syncedCampaigns = [];

    for (const campaign of activeCampaigns) {
      // Check if campaign already exists
      if (existingCampaignIds.has(campaign.id)) {
        console.log(`Skipping duplicate campaign: ${campaign.name} (${campaign.id})`);
        skipped++;
        continue;
      }

      // Create new workspace record
      const { data: newWorkspace, error: insertError } = await supabase
        .from('campaign_workspaces')
        .insert({
          brand_id: brandId,
          name: campaign.name,
          meta_campaign_ids: { campaignId: campaign.id },
          meta_campaign_status: 'active',
          progress_status: 'live',
          published_at: new Date().toISOString(),
          // Leave strategy_json and creative_json as null initially
        })
        .select()
        .single();

      if (insertError) {
        console.error(`Failed to create workspace for campaign ${campaign.id}:`, insertError);
        skipped++;
        continue;
      }

      console.log(`Synced campaign: ${campaign.name} (${campaign.id})`);
      synced++;
      syncedCampaigns.push({
        id: campaign.id,
        name: campaign.name,
        workspaceId: newWorkspace.id,
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
