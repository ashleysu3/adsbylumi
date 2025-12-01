import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductionItem {
  id: string;
  concept: any;
  status: string;
  linkedAsset?: {
    id: string;
    url: string;
    storagePath?: string;
    type: string;
  };
  finalCopy?: {
    headline: string;
    primaryText: string;
    description: string;
    cta: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, answers } = await req.json();

    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Building Meta campaign for workspace:', workspaceId);

    // Fetch workspace with brand data including page_id
    const { data: workspace, error: workspaceError } = await supabase
      .from('campaign_workspaces')
      .select(`
        *,
        brands!inner(id, name, meta_account_id, meta_access_token, page_id, page_name)
      `)
      .eq('id', workspaceId)
      .single();

    if (workspaceError) throw workspaceError;

    const brand = workspace.brands;
    const metaAccountId = brand.meta_account_id;
    const metaAccessToken = brand.meta_access_token;
    const pageId = brand.page_id;
    
    if (!metaAccountId) {
      throw new Error('Meta account not connected. Please connect your Meta ad account first.');
    }

    if (!metaAccessToken) {
      throw new Error('Meta access token not found. Please reconnect your Meta account.');
    }

    if (!pageId) {
      throw new Error('Facebook Page not selected. Please select a Facebook Page in your brand settings to create ads.');
    }

    console.log('Building campaign for workspace:', workspaceId);
    console.log('Meta Account ID:', metaAccountId);
    console.log('Facebook Page ID:', pageId);

    // Get approved production items with linked assets and final copy
    const approvedConcepts: ProductionItem[] = (workspace.production_items || []).filter(
      (item: ProductionItem) => item.status === 'approved' && item.linkedAsset && item.finalCopy
    );
    
    if (approvedConcepts.length < 1) {
      throw new Error('At least 1 approved creative with linked asset and finalized copy is required. Please complete the Production workflow first.');
    }

    console.log(`Creating campaign with ${approvedConcepts.length} approved concepts`);

    // Build campaign names using YAA format
    const productName = workspace.offer_name || 'Campaign';
    const startDate = answers?.startDate || new Date().toISOString().split('T')[0];
    
    const objectiveMap: { [key: string]: string } = {
      'LEAD_GENERATION': 'Leads',
      'LEAD': 'Leads',
      'CONVERSIONS': 'Conversions',
      'PURCHASE': 'Conversions',
      'LINK_CLICKS': 'Traffic',
      'LANDING_PAGE_VIEWS': 'Landing Page Views',
    };
    const objectiveName = objectiveMap[answers?.optimizationEvent] || 'Traffic';
    
    const campaignBaseName = `YAA // ${objectiveName} - ${productName} - ${startDate}`;

    // Determine Meta API objective
    let metaObjective = 'OUTCOME_TRAFFIC';
    let optimizationGoal = 'LINK_CLICKS';
    
    if (answers?.optimizationEvent === 'PURCHASE' || answers?.optimizationEvent === 'CONVERSIONS') {
      metaObjective = 'OUTCOME_SALES';
      optimizationGoal = 'OFFSITE_CONVERSIONS';
    } else if (answers?.optimizationEvent === 'LEAD' || answers?.optimizationEvent === 'LEAD_GENERATION') {
      metaObjective = 'OUTCOME_LEADS';
      optimizationGoal = 'LEAD_GENERATION';
    } else if (answers?.optimizationEvent === 'LANDING_PAGE_VIEWS') {
      metaObjective = 'OUTCOME_TRAFFIC';
      optimizationGoal = 'LANDING_PAGE_VIEWS';
    }

    // Parse budget (default to $20/day)
    const dailyBudgetCents = Math.round((parseInt(String(answers?.budget || '20').replace(/\D/g, '')) || 20) * 100);

    // Step 1: Upload all assets to Meta
    console.log('Uploading creative assets to Meta...');
    const uploadedAssets: Array<{ item: ProductionItem; assetId: string; assetType: 'image' | 'video' }> = [];

    for (const item of approvedConcepts) {
      if (!item.linkedAsset) continue;

      try {
        console.log(`Uploading asset for concept ${item.id}...`);
        
        const uploadResponse = await fetch(`${supabaseUrl}/functions/v1/upload-creative-to-meta`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            assetUrl: item.linkedAsset.url,
            assetStoragePath: item.linkedAsset.storagePath,
            metaAccountId: metaAccountId,
            metaAccessToken: metaAccessToken,
            fileName: item.linkedAsset.url?.split('/').pop(),
          }),
        });

        const uploadResult = await uploadResponse.json();

        if (uploadResult.success && uploadResult.assetId) {
          uploadedAssets.push({
            item,
            assetId: uploadResult.assetId,
            assetType: uploadResult.assetType,
          });
          console.log(`Asset uploaded: ${uploadResult.assetType} - ${uploadResult.assetId}`);
        } else {
          console.error(`Failed to upload asset for ${item.id}:`, uploadResult.error);
        }
      } catch (uploadError) {
        console.error(`Error uploading asset for ${item.id}:`, uploadError);
      }
    }

    if (uploadedAssets.length === 0) {
      throw new Error('Failed to upload any creative assets to Meta. Please check your files and try again.');
    }

    console.log(`Successfully uploaded ${uploadedAssets.length} assets`);

    // Step 2: Create Campaign
    const accountId = metaAccountId.replace('act_', '');
    
    const campaignResponse = await fetch(
      `https://graph.facebook.com/v18.0/act_${accountId}/campaigns`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          name: campaignBaseName,
          objective: metaObjective,
          status: 'PAUSED',
          special_ad_categories: '[]',
          access_token: metaAccessToken
        })
      }
    );

    const campaignData = await campaignResponse.json();
    
    if (campaignData.error) {
      console.error('Campaign creation failed:', campaignData.error);
      throw new Error(`Failed to create campaign: ${campaignData.error.message || 'Unknown error'}`);
    }

    const campaignId = campaignData.id;
    console.log('Campaign created:', campaignId);

    // Step 3: Create Ad Sets
    const adSetIds: string[] = [];
    
    // Create Cold Audience Ad Set
    const coldAdSetResponse = await fetch(
      `https://graph.facebook.com/v18.0/act_${accountId}/adsets`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          campaign_id: campaignId,
          name: `Cold - Broad - ${productName}`,
          optimization_goal: optimizationGoal,
          billing_event: 'IMPRESSIONS',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
          daily_budget: dailyBudgetCents.toString(),
          targeting: JSON.stringify({ 
            geo_locations: { countries: ['US'] },
            age_min: 18,
            age_max: 65
          }),
          status: 'PAUSED',
          access_token: metaAccessToken
        })
      }
    );

    const coldAdSetData = await coldAdSetResponse.json();
    
    if (coldAdSetData.error) {
      console.error('Cold ad set creation failed:', coldAdSetData.error);
      throw new Error(`Failed to create ad set: ${coldAdSetData.error.message || 'Unknown error'}`);
    }

    adSetIds.push(coldAdSetData.id);
    console.log('Cold ad set created:', coldAdSetData.id);

    // Create Warm Retargeting Ad Set (if enabled)
    let warmAdSetId: string | null = null;
    if (answers?.warmRetargeting) {
      const warmAdSetResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${accountId}/adsets`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            campaign_id: campaignId,
            name: `Warm - Engaged - ${productName}`,
            optimization_goal: optimizationGoal,
            billing_event: 'IMPRESSIONS',
            bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
            daily_budget: Math.round(dailyBudgetCents * 0.5).toString(),
            targeting: JSON.stringify({ 
              geo_locations: { countries: ['US'] },
              age_min: 18,
              age_max: 65
            }),
            status: 'PAUSED',
            access_token: metaAccessToken
          })
        }
      );

      const warmAdSetData = await warmAdSetResponse.json();
      if (!warmAdSetData.error) {
        warmAdSetId = warmAdSetData.id;
        adSetIds.push(warmAdSetData.id);
        console.log('Warm ad set created:', warmAdSetData.id);
      } else {
        console.log('Warm ad set skipped:', warmAdSetData.error.message);
      }
    }

    // Step 4: Create Ads for each uploaded asset
    const adIds: string[] = [];
    const primaryAdSetId = adSetIds[0];

    for (let i = 0; i < uploadedAssets.length; i++) {
      const { item, assetId, assetType } = uploadedAssets[i];
      const adName = `Ad ${i + 1} - ${item.concept?.hookLabel || item.concept?.title || 'Creative'}`;
      
      // Build object_story_spec based on asset type
      let objectStorySpec: any;
      
      if (assetType === 'video') {
        objectStorySpec = {
          page_id: pageId,
          video_data: {
            video_id: assetId,
            title: item.finalCopy?.headline || 'Watch Now',
            message: item.finalCopy?.primaryText || '',
            link_description: item.finalCopy?.description || '',
            call_to_action: {
              type: (item.finalCopy?.cta || 'LEARN_MORE').toUpperCase().replace(/ /g, '_'),
              value: { link: answers?.finalUrl || workspace.offer_url || '' }
            }
          }
        };
      } else {
        objectStorySpec = {
          page_id: pageId,
          link_data: {
            image_hash: assetId,
            link: answers?.finalUrl || workspace.offer_url || '',
            message: item.finalCopy?.primaryText || '',
            name: item.finalCopy?.headline || '',
            description: item.finalCopy?.description || '',
            call_to_action: {
              type: (item.finalCopy?.cta || 'LEARN_MORE').toUpperCase().replace(/ /g, '_')
            }
          }
        };
      }

      // Create ad creative
      const creativeResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${accountId}/adcreatives`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            name: `Creative - ${adName}`,
            object_story_spec: JSON.stringify(objectStorySpec),
            access_token: metaAccessToken
          })
        }
      );

      const creativeData = await creativeResponse.json();
      
      if (creativeData.error) {
        console.error(`Creative creation failed for ${adName}:`, creativeData.error);
        continue;
      }

      const creativeId = creativeData.id;
      console.log(`Creative created for ${adName}:`, creativeId);

      // Create the ad
      const adResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${accountId}/ads`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            adset_id: primaryAdSetId,
            name: adName,
            creative: JSON.stringify({ creative_id: creativeId }),
            status: 'PAUSED',
            access_token: metaAccessToken
          })
        }
      );

      const adData = await adResponse.json();
      
      if (adData.error) {
        console.error(`Ad creation failed for ${adName}:`, adData.error);
        continue;
      }

      adIds.push(adData.id);
      console.log(`Ad created: ${adData.id}`);
    }

    if (adIds.length === 0) {
      throw new Error('Failed to create any ads. Please check your creative content and try again.');
    }

    // Update workspace with campaign IDs
    const campaignIds = {
      campaign_id: campaignId,
      ad_set_id: primaryAdSetId,
      warm_ad_set_id: warmAdSetId,
      ad_set_ids: adSetIds,
      ad_ids: adIds
    };

    await supabase
      .from('campaign_workspaces')
      .update({
        meta_campaign_ids: campaignIds,
        meta_campaign_status: 'paused',
        progress_status: 'live',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', workspaceId);

    console.log('Campaign created successfully:', campaignIds);

    return new Response(
      JSON.stringify({
        success: true,
        campaignId,
        adSetId: primaryAdSetId,
        warmAdSetId,
        adIds,
        totalAdsCreated: adIds.length,
        status: 'paused',
        message: `Campaign created with ${adIds.length} ads. Campaign is paused - activate it in Ads Manager when ready.`
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
