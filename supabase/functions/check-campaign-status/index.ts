import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignStatus {
  campaignId: string;
  status: string;
  effectiveStatus: string;
  deliveryStatus?: string;
  adSets?: Array<{
    id: string;
    name: string;
    status: string;
    effectiveStatus: string;
  }>;
  ads?: Array<{
    id: string;
    name: string;
    status: string;
    effectiveStatus: string;
    reviewStatus?: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, action, entityId, entityType } = await req.json();

    if (!workspaceId) {
      throw new Error('Missing workspaceId');
    }

    console.log('Request:', { workspaceId, action, entityId, entityType });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch workspace and brand data
    const { data: workspace, error: workspaceError } = await supabase
      .from('campaign_workspaces')
      .select('*, brand:brands(id, meta_account_id)')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      throw new Error('Workspace not found');
    }

    const brand = workspace.brand;
    if (!brand?.meta_account_id) {
      throw new Error('Meta account not connected');
    }

    // Get token securely from vault
    const { data: metaAccessToken, error: tokenError } = await supabase
      .rpc('get_meta_token', { p_brand_id: brand.id });

    if (tokenError || !metaAccessToken) {
      throw new Error('Meta access token not found. Please reconnect your Meta account.');
    }

    const metaCampaignIds = workspace.meta_campaign_ids;

    if (!metaCampaignIds?.campaignId && !metaCampaignIds?.campaign_id) {
      throw new Error('No Meta campaign ID found');
    }

    const campaignId = metaCampaignIds.campaignId || metaCampaignIds.campaign_id;

    // Check if this is a status check or an action (pause/unpause)
    if (action === 'pause' || action === 'unpause') {
      // Perform pause/unpause action
      const newStatus = action === 'pause' ? 'PAUSED' : 'ACTIVE';
      const targetId = entityId || campaignId;
      const targetType = entityType || 'campaign';

      let endpoint = '';
      if (targetType === 'campaign') {
        endpoint = `https://graph.facebook.com/v21.0/${targetId}`;
      } else if (targetType === 'adset') {
        endpoint = `https://graph.facebook.com/v21.0/${targetId}`;
      } else if (targetType === 'ad') {
        endpoint = `https://graph.facebook.com/v21.0/${targetId}`;
      }

      console.log(`Setting ${targetType} ${targetId} to ${newStatus}`);

      const updateResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          access_token: metaAccessToken,
        }),
      });

      const updateResult = await updateResponse.json();

      if (updateResult.error) {
        console.error('Meta API error:', updateResult.error);
        throw new Error(updateResult.error.message || 'Failed to update status');
      }

      console.log('Update result:', updateResult);

      // Update workspace with new status
      await supabase
        .from('campaign_workspaces')
        .update({ 
          meta_campaign_status: newStatus.toLowerCase(),
          updated_at: new Date().toISOString()
        })
        .eq('id', workspaceId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          newStatus,
          message: `Campaign ${action}d successfully`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch campaign status from Meta
    console.log('Fetching campaign status for:', campaignId);

    const campaignResponse = await fetch(
      `https://graph.facebook.com/v21.0/${campaignId}?fields=id,name,status,effective_status&access_token=${metaAccessToken}`
    );
    const campaignData = await campaignResponse.json();

    if (campaignData.error) {
      console.error('Meta API error:', campaignData.error);
      throw new Error(campaignData.error.message || 'Failed to fetch campaign status');
    }

    // Fetch ad sets
    const adSetsResponse = await fetch(
      `https://graph.facebook.com/v21.0/${campaignId}/adsets?fields=id,name,status,effective_status&access_token=${metaAccessToken}`
    );
    const adSetsData = await adSetsResponse.json();

    // Fetch ads
    const adsResponse = await fetch(
      `https://graph.facebook.com/v21.0/${campaignId}/ads?fields=id,name,status,effective_status,review_feedback&access_token=${metaAccessToken}`
    );
    const adsData = await adsResponse.json();

    const status: CampaignStatus = {
      campaignId: campaignData.id,
      status: campaignData.status,
      effectiveStatus: campaignData.effective_status,
      adSets: adSetsData.data?.map((adSet: any) => ({
        id: adSet.id,
        name: adSet.name,
        status: adSet.status,
        effectiveStatus: adSet.effective_status,
      })) || [],
      ads: adsData.data?.map((ad: any) => ({
        id: ad.id,
        name: ad.name,
        status: ad.status,
        effectiveStatus: ad.effective_status,
        reviewStatus: ad.review_feedback?.global?.status,
      })) || [],
    };

    // Determine delivery status
    if (status.effectiveStatus === 'ACTIVE') {
      status.deliveryStatus = 'Delivering';
    } else if (status.effectiveStatus === 'PAUSED') {
      status.deliveryStatus = 'Paused';
    } else if (status.effectiveStatus === 'PENDING_REVIEW' || status.effectiveStatus === 'IN_PROCESS') {
      status.deliveryStatus = 'In Review';
    } else if (status.effectiveStatus === 'WITH_ISSUES') {
      status.deliveryStatus = 'Issues Detected';
    } else if (status.effectiveStatus === 'CAMPAIGN_PAUSED') {
      status.deliveryStatus = 'Campaign Paused';
    } else if (status.effectiveStatus === 'ADSET_PAUSED') {
      status.deliveryStatus = 'Ad Set Paused';
    } else if (status.effectiveStatus === 'DISAPPROVED') {
      status.deliveryStatus = 'Rejected';
    } else {
      status.deliveryStatus = status.effectiveStatus;
    }

    console.log('Campaign status:', status);

    // Update workspace with status
    await supabase
      .from('campaign_workspaces')
      .update({ 
        meta_campaign_status: status.effectiveStatus.toLowerCase(),
        updated_at: new Date().toISOString()
      })
      .eq('id', workspaceId);

    return new Response(
      JSON.stringify({ status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in check-campaign-status:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
