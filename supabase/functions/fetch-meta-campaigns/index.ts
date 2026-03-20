import { getCorsHeaders } from '../_shared/cors.ts';

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
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { metaAccountId, metaAccessToken, dateRangeStart, dateRangeEnd, existingCampaignIds } = await req.json();
    
    if (!metaAccountId || !metaAccessToken) {
      throw new Error('metaAccountId and metaAccessToken are required');
    }

    console.log('Fetching campaigns from Meta for account:', metaAccountId);

    // Fetch all campaigns (any status)
    const campaignsUrl = `https://graph.facebook.com/v21.0/${metaAccountId}/campaigns?fields=id,name,status,objective,created_time,daily_budget,lifetime_budget&limit=500&access_token=${metaAccessToken}`;
    
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    if (!campaignsResponse.ok) {
      console.error('Failed to fetch campaigns from Meta:', campaignsData);
      throw new Error(campaignsData.error?.message || 'Failed to fetch campaigns from Meta');
    }

    const allCampaigns: MetaCampaign[] = campaignsData.data || [];
    console.log(`Fetched ${allCampaigns.length} total campaigns from Meta`);

    // If date range provided, filter to campaigns with spend > 0 during that period
    let campaignsWithActivity = allCampaigns;
    
    if (dateRangeStart && dateRangeEnd) {
      console.log(`Filtering campaigns with activity between ${dateRangeStart} and ${dateRangeEnd}`);
      
      // Fetch account-level insights grouped by campaign
      const insightsUrl = `https://graph.facebook.com/v21.0/${metaAccountId}/insights?level=campaign&time_range={"since":"${dateRangeStart}","until":"${dateRangeEnd}"}&fields=campaign_id,campaign_name,spend&filtering=[{"field":"spend","operator":"GREATER_THAN","value":"0"}]&limit=500&access_token=${metaAccessToken}`;
      
      try {
        const insightsResponse = await fetch(insightsUrl);
        const insightsData = await insightsResponse.json();
        
        if (insightsResponse.ok && insightsData.data) {
          const campaignIdsWithSpend = new Set(insightsData.data.map((i: any) => i.campaign_id));
          console.log(`Found ${campaignIdsWithSpend.size} campaigns with spend in date range`);
          
          // Filter to only campaigns with activity
          campaignsWithActivity = allCampaigns.filter(c => campaignIdsWithSpend.has(c.id));
        }
      } catch (insightsError) {
        console.error('Error fetching insights for filtering:', insightsError);
        // Fall back to all campaigns if insights fetch fails
      }
    }

    // Mark which campaigns are already imported
    const existingIds = new Set(existingCampaignIds || []);
    
    const enrichedCampaigns = campaignsWithActivity.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      createdTime: campaign.created_time,
      dailyBudget: campaign.daily_budget,
      lifetimeBudget: campaign.lifetime_budget,
      alreadyImported: existingIds.has(campaign.id),
    }));

    // Sort: Active first, then by name
    enrichedCampaigns.sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
      return a.name.localeCompare(b.name);
    });

    console.log(`Returning ${enrichedCampaigns.length} campaigns`);

    return new Response(
      JSON.stringify({ 
        success: true,
        campaigns: enrichedCampaigns,
        total: enrichedCampaigns.length,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in fetch-meta-campaigns:', error);
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
