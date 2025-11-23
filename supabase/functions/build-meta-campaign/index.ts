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
    const metaAccessToken = brand.meta_access_token;
    
    if (!metaAccountId) {
      throw new Error('Meta account not connected for this brand');
    }

    if (!metaAccessToken) {
      throw new Error('Meta access token not found. Please reconnect your Meta account.');
    }

    console.log('Building campaign for workspace:', workspaceId);
    console.log('Meta Account ID:', metaAccountId);
    console.log('Answers:', answers);

    // Get approved production items
    const approvedConcepts = workspace.production_items?.filter((item: any) => item.status === 'approved') || [];
    
    if (approvedConcepts.length < 3) {
      throw new Error('At least 3 approved concepts are required');
    }

    console.log(`Creating campaign with ${approvedConcepts.length} approved concepts`);

    try {
      // Step 1: Create Campaign
      const campaignResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${metaAccountId}/campaigns`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: answers.campaignName,
            objective: 'OUTCOME_LEADS',
            status: 'PAUSED',
            special_ad_categories: [],
            access_token: metaAccessToken
          })
        }
      );

      if (!campaignResponse.ok) {
        const error = await campaignResponse.json();
        console.error('Campaign creation failed:', error);
        throw new Error(`Failed to create campaign: ${error.error?.message || 'Unknown error'}`);
      }

      const campaignData = await campaignResponse.json();
      const campaignId = campaignData.id;
      console.log('Campaign created:', campaignId);

      // Step 2: Create Ad Sets
      const adSetIds: string[] = [];
      
      // Create Cold Audience Ad Set
      const coldAdSetResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${metaAccountId}/adsets`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaign_id: campaignId,
            name: `${answers.campaignName} - Cold`,
            optimization_goal: answers.optimizationEvent || 'LEAD_GENERATION',
            billing_event: 'IMPRESSIONS',
            bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
            daily_budget: Math.round(answers.budget * 100), // Convert to cents
            targeting: { 
              geo_locations: { countries: ['US'] },
              age_min: 18,
              age_max: 65
            },
            status: 'PAUSED',
            access_token: metaAccessToken
          })
        }
      );

      if (!coldAdSetResponse.ok) {
        const error = await coldAdSetResponse.json();
        console.error('Cold ad set creation failed:', error);
        throw new Error(`Failed to create cold ad set: ${error.error?.message || 'Unknown error'}`);
      }

      const coldAdSetData = await coldAdSetResponse.json();
      adSetIds.push(coldAdSetData.id);
      console.log('Cold ad set created:', coldAdSetData.id);

      // Create Warm Retargeting Ad Set (if enabled)
      if (answers.warmRetargeting) {
        const warmAdSetResponse = await fetch(
          `https://graph.facebook.com/v18.0/act_${metaAccountId}/adsets`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              campaign_id: campaignId,
              name: `${answers.campaignName} - Warm`,
              optimization_goal: answers.optimizationEvent || 'LEAD_GENERATION',
              billing_event: 'IMPRESSIONS',
              bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
              daily_budget: Math.round(answers.budget * 100 * 0.5), // 50% of budget
              targeting: { 
                geo_locations: { countries: ['US'] },
                age_min: 18,
                age_max: 65
              },
              status: 'PAUSED',
              access_token: metaAccessToken
            })
          }
        );

        if (!warmAdSetResponse.ok) {
          const error = await warmAdSetResponse.json();
          console.error('Warm ad set creation failed:', error);
          // Don't throw - warm ad set is optional
        } else {
          const warmAdSetData = await warmAdSetResponse.json();
          adSetIds.push(warmAdSetData.id);
          console.log('Warm ad set created:', warmAdSetData.id);
        }
      }

      // Step 3: Create Ads for each approved concept
      const adIds: string[] = [];
      const primaryAdSetId = adSetIds[0]; // Use cold ad set for all ads

      for (const concept of approvedConcepts) {
        const adName = concept.concept?.title || concept.title || `Ad ${adIds.length + 1}`;
        
        // Build creative from concept data
        const creative: any = {
          object_story_spec: {
            page_id: metaAccountId.replace('act_', ''), // Extract page ID
            link_data: {
              link: answers.finalUrl,
              message: concept.concept?.primaryCopy || concept.primaryCopy || '',
              name: concept.concept?.headline || concept.headline || adName,
              description: concept.concept?.description || concept.description || '',
              call_to_action: {
                type: 'LEARN_MORE'
              }
            }
          }
        };

        // Create ad creative first
        const creativeResponse = await fetch(
          `https://graph.facebook.com/v18.0/act_${metaAccountId}/adcreatives`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...creative,
              access_token: metaAccessToken
            })
          }
        );

        if (!creativeResponse.ok) {
          const error = await creativeResponse.json();
          console.error(`Creative creation failed for ${adName}:`, error);
          continue; // Skip this ad but continue with others
        }

        const creativeData = await creativeResponse.json();
        const creativeId = creativeData.id;
        console.log(`Creative created for ${adName}:`, creativeId);

        // Create the ad
        const adResponse = await fetch(
          `https://graph.facebook.com/v18.0/act_${metaAccountId}/ads`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adset_id: primaryAdSetId,
              name: adName,
              creative: { creative_id: creativeId },
              status: 'PAUSED',
              access_token: metaAccessToken
            })
          }
        );

        if (!adResponse.ok) {
          const error = await adResponse.json();
          console.error(`Ad creation failed for ${adName}:`, error);
          continue; // Skip this ad but continue with others
        }

        const adData = await adResponse.json();
        adIds.push(adData.id);
        console.log(`Ad created for ${adName}:`, adData.id);
      }

      if (adIds.length === 0) {
        throw new Error('Failed to create any ads. Please check your creative content.');
      }

      const campaignIds = {
        campaignId,
        adSetIds,
        adIds
      };

      console.log('Campaign created successfully:', campaignIds);

      return new Response(
        JSON.stringify({
          success: true,
          campaignIds,
          message: 'Campaign created successfully in Meta Ads Manager'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } catch (error: any) {
      console.error('Error during campaign creation:', error);
      
      // Return detailed error for debugging
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          details: error.toString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }
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
