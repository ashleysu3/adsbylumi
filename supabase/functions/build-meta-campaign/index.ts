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
    fileName?: string;
  };
  // New field naming (preferred)
  finalCopy?: {
    headline: string;
    primaryText: string;
    description: string;
    cta: string;
  };
  // Legacy field naming (backward compatibility)
  final_copy?: {
    headline: string;
    primary_text?: string;
    primaryText?: string;
    description: string;
    call_to_action?: string;
    cta?: string;
  };
  // Legacy asset linking
  uploaded_asset_id?: string;
}

// Helper to normalize production item copy fields
function normalizeCopy(item: ProductionItem): { headline: string; primaryText: string; description: string; cta: string } | null {
  // Try new naming first
  if (item.finalCopy) {
    return {
      headline: item.finalCopy.headline || '',
      primaryText: item.finalCopy.primaryText || '',
      description: item.finalCopy.description || '',
      cta: item.finalCopy.cta || 'LEARN_MORE',
    };
  }
  // Fall back to legacy naming
  if (item.final_copy) {
    return {
      headline: item.final_copy.headline || '',
      primaryText: item.final_copy.primaryText || item.final_copy.primary_text || '',
      description: item.final_copy.description || '',
      cta: item.final_copy.cta || item.final_copy.call_to_action || 'LEARN_MORE',
    };
  }
  return null;
}

interface BuildResult {
  success: boolean;
  campaignId?: string;
  adSetIds: string[];
  adIds: string[];
  failedAds: Array<{ conceptId: string; conceptTitle: string; error: string }>;
  warnings: string[];
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

    // Fetch workspace with brand data including page_id (without token - get from vault)
    const { data: workspace, error: workspaceError } = await supabase
      .from('campaign_workspaces')
      .select(`
        *,
        brands!inner(id, name, meta_account_id, page_id, page_name)
      `)
      .eq('id', workspaceId)
      .single();

    if (workspaceError) throw workspaceError;

    const brand = workspace.brands;
    const metaAccountId = brand.meta_account_id;
    const pageId = brand.page_id;
    
    if (!metaAccountId) {
      throw new Error('Meta account not connected. Please connect your Meta ad account first.');
    }

    // Get token securely from vault
    const { data: metaAccessToken, error: tokenError } = await supabase
      .rpc('get_meta_token', { p_brand_id: brand.id });

    if (tokenError || !metaAccessToken) {
      throw new Error('Meta access token not found. Please reconnect your Meta account.');
    }

    if (!pageId) {
      throw new Error('Facebook Page not selected. Please select a Facebook Page in your brand settings to create ads.');
    }

    console.log('Building campaign for workspace:', workspaceId);
    console.log('Meta Account ID:', metaAccountId);
    console.log('Facebook Page ID:', pageId);

    // Initialize result tracking for partial success
    const result: BuildResult = {
      success: false,
      adSetIds: [],
      adIds: [],
      failedAds: [],
      warnings: []
    };

    // Get approved production items with linked assets and final copy
    const approvedConcepts: ProductionItem[] = (workspace.production_items || []).filter(
      (item: ProductionItem) => {
        // Check status
        if (item.status !== 'approved') return false;
        // Check for asset (new or legacy)
        const hasAsset = item.linkedAsset || item.uploaded_asset_id;
        // Check for copy (new or legacy)
        const hasCopy = item.finalCopy || item.final_copy;
        return hasAsset && hasCopy;
      }
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
    
    const campaignBaseName = `LUMI // ${objectiveName} - ${productName} - ${startDate}`;

    // Determine Meta API objective
    // Note: LEAD_GENERATION optimization_goal is for Facebook Instant Forms only.
    // For offsite lead conversions, use OFFSITE_CONVERSIONS with LEAD event.
    let metaObjective = 'OUTCOME_TRAFFIC';
    let optimizationGoal = 'LINK_CLICKS';
    let needsPixel = false;
    let conversionEvent = 'PURCHASE';
    
    if (answers?.optimizationEvent === 'PURCHASE' || answers?.optimizationEvent === 'CONVERSIONS') {
      metaObjective = 'OUTCOME_SALES';
      optimizationGoal = 'OFFSITE_CONVERSIONS';
      needsPixel = true;
      conversionEvent = 'PURCHASE';
    } else if (answers?.optimizationEvent === 'LEAD' || answers?.optimizationEvent === 'LEAD_GENERATION') {
      // For offsite leads (landing page forms), use OUTCOME_LEADS with OFFSITE_CONVERSIONS
      metaObjective = 'OUTCOME_LEADS';
      optimizationGoal = 'OFFSITE_CONVERSIONS';
      needsPixel = true;
      conversionEvent = 'LEAD';
    } else if (answers?.optimizationEvent === 'LANDING_PAGE_VIEWS') {
      metaObjective = 'OUTCOME_TRAFFIC';
      optimizationGoal = 'LANDING_PAGE_VIEWS';
    }

    // Fetch pixel if needed for conversion optimization
    let pixelId: string | null = null;
    if (needsPixel) {
      console.log('Fetching Meta pixel for conversion tracking...');
      try {
        const pixelResponse = await fetch(
          `https://graph.facebook.com/v18.0/act_${metaAccountId.replace('act_', '')}/adspixels?fields=id,name&access_token=${metaAccessToken}`
        );
        const pixelData = await pixelResponse.json();
        
        if (pixelData.data && pixelData.data.length > 0) {
          pixelId = pixelData.data[0].id;
          console.log('Found Meta pixel:', pixelId, pixelData.data[0].name);
        } else {
          console.log('No pixel found, falling back to traffic optimization');
          // Fall back to traffic optimization if no pixel is set up
          metaObjective = 'OUTCOME_TRAFFIC';
          optimizationGoal = 'LINK_CLICKS';
          needsPixel = false;
          result.warnings.push('No Meta Pixel found on your ad account. Campaign will optimize for link clicks instead of conversions. Set up a pixel in Meta Ads Manager for conversion tracking.');
        }
      } catch (pixelError) {
        console.error('Error fetching pixel:', pixelError);
        // Fall back to traffic optimization
        metaObjective = 'OUTCOME_TRAFFIC';
        optimizationGoal = 'LINK_CLICKS';
        needsPixel = false;
        result.warnings.push('Could not fetch Meta Pixel. Campaign will optimize for link clicks instead of conversions.');
      }
    }

    // Parse budget (default to $20/day) - improved parsing
    const budgetString = String(answers?.budget || '20').replace(/[$,\s]/g, '');
    const dailyBudgetCents = Math.round((parseInt(budgetString) || 20) * 100);

    // Step 1: Upload all assets to Meta
    console.log('Uploading creative assets to Meta...');
    const uploadedAssets: Array<{ item: ProductionItem; assetId: string; assetType: 'image' | 'video' }> = [];

    for (const item of approvedConcepts) {
      if (!item.linkedAsset) {
        result.failedAds.push({
          conceptId: item.id,
          conceptTitle: item.concept?.title || 'Unknown',
          error: 'No linked asset found'
        });
        continue;
      }

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
          result.failedAds.push({
            conceptId: item.id,
            conceptTitle: item.concept?.title || 'Unknown',
            error: `Asset upload failed: ${uploadResult.error || 'Unknown error'}`
          });
        }
      } catch (uploadError: any) {
        console.error(`Error uploading asset for ${item.id}:`, uploadError);
        result.failedAds.push({
          conceptId: item.id,
          conceptTitle: item.concept?.title || 'Unknown',
          error: `Asset upload error: ${uploadError.message}`
        });
      }
    }

    if (uploadedAssets.length === 0) {
      throw new Error('Failed to upload any creative assets to Meta. Please check your files and try again.');
    }

    console.log(`Successfully uploaded ${uploadedAssets.length} of ${approvedConcepts.length} assets`);
    
    if (result.failedAds.length > 0) {
      result.warnings.push(`${result.failedAds.length} asset(s) failed to upload and will be skipped.`);
    }

    // Determine launch status (ACTIVE or PAUSED)
    const launchStatus = answers?.launchStatus === 'active' ? 'ACTIVE' : 'PAUSED';
    console.log('Launch status:', launchStatus);

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
          status: launchStatus,
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

    result.campaignId = campaignData.id;
    console.log('Campaign created:', result.campaignId);

    // Step 3: Create Ad Sets
    // Build promoted_object if we have a pixel
    const promotedObject = pixelId ? {
      pixel_id: pixelId,
      custom_event_type: conversionEvent
    } : null;

    // Create Cold Audience Ad Set
    const coldAdSetParams: Record<string, string> = {
      campaign_id: result.campaignId!,
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
      status: launchStatus,
      access_token: metaAccessToken
    };

    // Add promoted_object if we have a pixel for conversion tracking
    if (promotedObject) {
      coldAdSetParams.promoted_object = JSON.stringify(promotedObject);
    }

    const coldAdSetResponse = await fetch(
      `https://graph.facebook.com/v18.0/act_${accountId}/adsets`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(coldAdSetParams)
      }
    );

    const coldAdSetData = await coldAdSetResponse.json();
    
    if (coldAdSetData.error) {
      console.error('Cold ad set creation failed:', coldAdSetData.error);
      throw new Error(`Failed to create ad set: ${coldAdSetData.error.message || 'Unknown error'}`);
    }

    result.adSetIds.push(coldAdSetData.id);
    console.log('Cold ad set created:', coldAdSetData.id);

    // Create Warm Retargeting Ad Set (if enabled)
    let warmAdSetId: string | null = null;
    if (answers?.warmRetargeting) {
      // Build targeting with selected custom audiences
      let warmTargeting: any = { 
        geo_locations: { countries: ['US'] },
        age_min: 18,
        age_max: 65
      };
      
      // Add custom audiences if selected
      const selectedAudiences = answers?.selectedAudiences || [];
      if (selectedAudiences.length > 0 && selectedAudiences[0] !== '') {
        warmTargeting.custom_audiences = selectedAudiences.map((id: string) => ({ id }));
        console.log(`Using ${selectedAudiences.length} custom audience(s) for warm targeting`);
      } else {
        // Default to engaged IG/FB audience if no custom audiences
        // This uses flexible_spec for engagement-based targeting
        console.log('No custom audiences selected, using default warm targeting');
      }
      
      const warmAdSetParams: Record<string, string> = {
        campaign_id: result.campaignId!,
        name: `Warm - Retargeting - ${productName}`,
        optimization_goal: optimizationGoal,
        billing_event: 'IMPRESSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: Math.round(dailyBudgetCents * 0.5).toString(),
        targeting: JSON.stringify(warmTargeting),
        status: launchStatus,
        access_token: metaAccessToken
      };

      // Add promoted_object if we have a pixel for conversion tracking
      if (promotedObject) {
        warmAdSetParams.promoted_object = JSON.stringify(promotedObject);
      }

      const warmAdSetResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${accountId}/adsets`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(warmAdSetParams)
        }
      );

      const warmAdSetData = await warmAdSetResponse.json();
      if (!warmAdSetData.error) {
        warmAdSetId = warmAdSetData.id;
        result.adSetIds.push(warmAdSetData.id);
        console.log('Warm ad set created:', warmAdSetData.id);
      } else {
        console.log('Warm ad set skipped:', warmAdSetData.error.message);
        result.warnings.push(`Warm audience ad set could not be created: ${warmAdSetData.error.message}`);
      }
    }

    // Step 4: Create Ads for each uploaded asset
    const primaryAdSetId = result.adSetIds[0];

    for (let i = 0; i < uploadedAssets.length; i++) {
      const { item, assetId, assetType } = uploadedAssets[i];
      const adName = `Ad ${i + 1} - ${item.concept?.hookLabel || item.concept?.title || 'Creative'}`;
      
      // Normalize copy fields (handles both old and new naming)
      const copy = normalizeCopy(item);
      if (!copy) {
        console.error(`No copy found for ${adName}, skipping...`);
        result.failedAds.push({
          conceptId: item.id,
          conceptTitle: item.concept?.title || 'Unknown',
          error: 'No ad copy found'
        });
        continue;
      }
      
      try {
        // Build object_story_spec based on asset type
        let objectStorySpec: any;
        
        if (assetType === 'video') {
          objectStorySpec = {
            page_id: pageId,
            video_data: {
              video_id: assetId,
              title: copy.headline || 'Watch Now',
              message: copy.primaryText || '',
              link_description: copy.description || '',
              call_to_action: {
                type: (copy.cta || 'LEARN_MORE').toUpperCase().replace(/ /g, '_'),
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
              message: copy.primaryText || '',
              name: copy.headline || '',
              description: copy.description || '',
              call_to_action: {
                type: (copy.cta || 'LEARN_MORE').toUpperCase().replace(/ /g, '_')
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
          result.failedAds.push({
            conceptId: item.id,
            conceptTitle: item.concept?.title || 'Unknown',
            error: `Creative creation failed: ${creativeData.error.message || 'Unknown error'}`
          });
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
          result.failedAds.push({
            conceptId: item.id,
            conceptTitle: item.concept?.title || 'Unknown',
            error: `Ad creation failed: ${adData.error.message || 'Unknown error'}`
          });
          continue;
        }

        result.adIds.push(adData.id);
        console.log(`Ad created: ${adData.id}`);
      } catch (adError: any) {
        console.error(`Error creating ad for ${adName}:`, adError);
        result.failedAds.push({
          conceptId: item.id,
          conceptTitle: item.concept?.title || 'Unknown',
          error: `Ad creation error: ${adError.message}`
        });
      }
    }

    // Determine overall success - we need at least 1 ad
    result.success = result.adIds.length > 0;

    if (!result.success) {
      // Complete failure - no ads created
      throw new Error('Failed to create any ads. Please check your creative content and try again.');
    }

    // Partial success - save what we have
    const campaignIds = {
      campaign_id: result.campaignId,
      ad_set_id: primaryAdSetId,
      warm_ad_set_id: warmAdSetId,
      ad_set_ids: result.adSetIds,
      ad_ids: result.adIds,
      failed_ads: result.failedAds,
      warnings: result.warnings
    };

    await supabase
      .from('campaign_workspaces')
      .update({
        meta_campaign_ids: campaignIds,
        meta_campaign_status: 'paused',
        meta_errors: result.failedAds.length > 0 ? result.failedAds : null,
        progress_status: 'live',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', workspaceId);

    console.log('Campaign created successfully:', campaignIds);

    // Build response message
    let message = `Campaign created with ${result.adIds.length} ads.`;
    if (result.failedAds.length > 0) {
      message += ` ${result.failedAds.length} ad(s) failed to create.`;
    }
    message += ` Campaign is paused - activate it in Ads Manager when ready.`;

    return new Response(
      JSON.stringify({
        success: true,
        campaignId: result.campaignId,
        adSetId: primaryAdSetId,
        warmAdSetId,
        adIds: result.adIds,
        totalAdsCreated: result.adIds.length,
        totalAdsFailed: result.failedAds.length,
        failedAds: result.failedAds,
        warnings: result.warnings,
        status: 'paused',
        message
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
