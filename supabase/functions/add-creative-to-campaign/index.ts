import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { workspaceId, assets, copyVariations } = await req.json();

    if (!workspaceId || !assets?.length || !copyVariations?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'workspaceId, assets, and copyVariations are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: workspace, error: wsError } = await supabase
      .from('campaign_workspaces')
      .select('*, brands!inner(id, name, user_id, meta_account_id, page_id, meta_access_token)')
      .eq('id', workspaceId)
      .single();

    if (wsError || !workspace) {
      return new Response(
        JSON.stringify({ success: false, error: 'Workspace not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const brand = workspace.brands;

    if (brand.user_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metaCampaignIds = workspace.meta_campaign_ids as any;
    const metaAccountId = brand.meta_account_id;
    const pageId = brand.page_id;

    if (!metaAccountId || !pageId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Meta account or Page not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the campaign ID — could be stored as ad_set_id, campaignId, or campaign_id
    const campaignId = metaCampaignIds?.campaignId || metaCampaignIds?.campaign_id;

    if (!metaCampaignIds?.ad_set_id && !campaignId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No existing campaign found. Use Build Campaign instead.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metaAccessToken = brand.meta_access_token;

    if (!metaAccessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Meta token not found. Please reconnect your Meta account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve ad set ID — use stored one or fetch from Meta campaign
    let adSetId = metaCampaignIds?.ad_set_id;

    if (!adSetId && campaignId) {
      console.log(`No ad_set_id stored, resolving from campaign ${campaignId}...`);

      // First try: get ad set from an existing ad (avoids extra API call)
      const existingAdIds = metaCampaignIds?.ad_ids || [];
      if (existingAdIds.length > 0) {
        try {
          const adInfoRes = await fetch(
            `https://graph.facebook.com/v18.0/${existingAdIds[0]}?fields=adset_id&access_token=${metaAccessToken}`
          );
          const adInfo = await adInfoRes.json();
          if (adInfo.adset_id) {
            adSetId = adInfo.adset_id;
            console.log(`Resolved ad set from existing ad: ${adSetId}`);
          }
        } catch (e) {
          console.warn('Could not resolve ad set from existing ad, falling back to campaign fetch');
        }
      }

      // Second try: fetch ad sets from campaign
      if (!adSetId) {
        const adSetsRes = await fetch(
          `https://graph.facebook.com/v18.0/${campaignId}/adsets?fields=id,name,status&limit=5&access_token=${metaAccessToken}`
        );
        const adSetsData = await adSetsRes.json();

        if (adSetsData.error) {
          // Rate limit — suggest retry
          const isRateLimit = adSetsData.error.message?.includes('request limit') || adSetsData.error.code === 32;
          console.error('Failed to fetch ad sets:', adSetsData.error);
          return new Response(
            JSON.stringify({
              success: false,
              error: isRateLimit
                ? 'Meta API rate limit reached. Please wait a few minutes and try again.'
                : `Failed to fetch ad sets: ${adSetsData.error.message}`,
            }),
            { status: isRateLimit ? 429 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const activeAdSet = adSetsData.data?.find((s: any) => s.status === 'ACTIVE') || adSetsData.data?.[0];
        if (!activeAdSet) {
          return new Response(
            JSON.stringify({ success: false, error: 'No ad sets found in this campaign.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        adSetId = activeAdSet.id;
        console.log(`Resolved ad set from campaign: ${adSetId} (${activeAdSet.name})`);
      }

      // Cache for future use
      await supabase
        .from('campaign_workspaces')
        .update({
          meta_campaign_ids: { ...metaCampaignIds, ad_set_id: adSetId },
        })
        .eq('id', workspaceId);
    }

    const accountId = metaAccountId.replace('act_', '');

    // ── Fetch existing ad's creative settings to clone ──
    let referenceSettings: any = null;
    try {
      // Get ads in this ad set
      const adsRes = await fetch(
        `https://graph.facebook.com/v18.0/${adSetId}/ads?fields=creative{object_story_spec,url_tags,tracking_specs,asset_feed_spec}&limit=1&access_token=${metaAccessToken}`
      );
      const adsData = await adsRes.json();
      
      if (adsData.data?.length > 0 && adsData.data[0].creative) {
        const existingCreative = adsData.data[0].creative;
        const spec = existingCreative.object_story_spec;
        
        if (spec) {
          // Extract reusable settings from the existing ad
          const linkData = spec.link_data || {};
          const videoData = spec.video_data || {};
          const source = linkData.link ? linkData : videoData;
          
          referenceSettings = {
            link: source.link || linkData.link || workspace.offer_url || '',
            call_to_action_type: source.call_to_action?.type || linkData.call_to_action?.type || videoData.call_to_action?.type || 'LEARN_MORE',
            url_tags: existingCreative.url_tags || null,
            tracking_specs: adsData.data[0].tracking_specs || null,
          };
          
          console.log('Cloned settings from existing ad:', JSON.stringify(referenceSettings));
        }
      }
    } catch (e) {
      console.warn('Could not fetch existing ad settings, using defaults:', e);
    }

    // Fallback defaults
    const link = referenceSettings?.link || workspace.offer_url || '';
    const ctaType = referenceSettings?.call_to_action_type || 'LEARN_MORE';

    console.log(`Adding ${assets.length} creative(s) with ${copyVariations.length} copy variation(s) to ad set ${adSetId}`);
    console.log(`Using link: ${link}, CTA: ${ctaType}`);

    const createdAdIds: string[] = [];
    const failedAds: Array<{ assetName: string; error: string }> = [];

    for (const asset of assets) {
      console.log(`Processing asset: ${asset.name}`);

      let uploadResult: any;
      try {
        const uploadResponse = await fetch(`${supabaseUrl}/functions/v1/upload-creative-to-meta`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            assetStoragePath: asset.storage_path,
            brandId: brand.id,
            fileName: asset.name,
          }),
        });

        uploadResult = await uploadResponse.json();

        if (!uploadResult.success || !uploadResult.assetId) {
          failedAds.push({ assetName: asset.name, error: `Upload failed: ${uploadResult.error || 'Unknown'}` });
          continue;
        }
      } catch (e: any) {
        failedAds.push({ assetName: asset.name, error: `Upload error: ${e.message}` });
        continue;
      }

      const { assetId, assetType } = uploadResult;
      console.log(`Asset uploaded to Meta: ${assetType} ${assetId}`);

      // Build ONE ad per asset with all copy variations as text options
      const adName = `Ad - ${asset.name.replace(/\.[^/.]+$/, '')}`;

      try {
        // Collect all copy variations as arrays for asset_feed_spec
        const bodies = copyVariations
          .map((c: any) => c.primary_text)
          .filter(Boolean)
          .map((text: string) => ({ text }));

        const titles = copyVariations
          .map((c: any) => c.headline)
          .filter(Boolean)
          .map((text: string) => ({ text }));

        const descriptions = copyVariations
          .map((c: any) => c.description)
          .filter(Boolean)
          .map((text: string) => ({ text }));

        // Deduplicate
        const uniqueBodies = [...new Map(bodies.map((b: any) => [b.text, b])).values()];
        const uniqueTitles = [...new Map(titles.map((t: any) => [t.text, t])).values()];
        const uniqueDescriptions = [...new Map(descriptions.map((d: any) => [d.text, d])).values()];

        // Build asset_feed_spec with the creative + all copy options
        const assetFeedSpec: any = {
          bodies: uniqueBodies.length > 0 ? uniqueBodies : [{ text: '' }],
          titles: uniqueTitles.length > 0 ? uniqueTitles : [{ text: 'Learn More' }],
          descriptions: uniqueDescriptions.length > 0 ? uniqueDescriptions : undefined,
          call_to_action_types: [ctaType],
          link_urls: [{ website_url: link }],
          ad_formats: ['SINGLE_IMAGE'],
        };

        if (assetType === 'video') {
          assetFeedSpec.videos = [{ video_id: assetId }];
          assetFeedSpec.ad_formats = ['SINGLE_VIDEO'];
        } else {
          assetFeedSpec.images = [{ hash: assetId }];
        }

        // Remove undefined fields
        if (!assetFeedSpec.descriptions) delete assetFeedSpec.descriptions;

        // Build creative params
        const creativeParams: Record<string, string> = {
          name: `Creative - ${adName}`,
          asset_feed_spec: JSON.stringify(assetFeedSpec),
          object_story_spec: JSON.stringify({ page_id: pageId }),
          access_token: metaAccessToken,
        };

        // Clone URL tags from existing ad if present
        if (referenceSettings?.url_tags) {
          creativeParams.url_tags = referenceSettings.url_tags;
        }

        const creativeResponse = await fetch(
          `https://graph.facebook.com/v18.0/act_${accountId}/adcreatives`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(creativeParams),
          }
        );

        const creativeData = await creativeResponse.json();
        if (creativeData.error) {
          console.error(`Creative failed for ${adName}:`, creativeData.error);
          failedAds.push({ assetName: asset.name, error: `Creative: ${creativeData.error.message}` });
          continue;
        }

        // Build ad params (do not pass tracking_specs; Meta often rejects it on create)
        const adParams: Record<string, string> = {
          adset_id: adSetId,
          name: adName,
          creative: JSON.stringify({ creative_id: creativeData.id }),
          status: 'PAUSED',
          access_token: metaAccessToken,
        };

        const adResponse = await fetch(
          `https://graph.facebook.com/v18.0/act_${accountId}/ads`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(adParams),
          }
        );

        const adData = await adResponse.json();
        if (adData.error) {
          console.error(`Ad creation failed for ${adName}:`, adData.error);
          failedAds.push({
            assetName: asset.name,
            error: `Ad: ${adData.error.message} (code ${adData.error.code}${adData.error.error_subcode ? `/${adData.error.error_subcode}` : ''})`,
          });
          continue;
        }

        createdAdIds.push(adData.id);
        console.log(`Ad created: ${adData.id} (${adName}) with ${uniqueBodies.length} body options, ${uniqueTitles.length} title options`);
      } catch (adError: any) {
        console.error(`Error creating ad ${adName}:`, adError);
        failedAds.push({ assetName: asset.name, error: adError.message });
      }
    }

    // Update workspace with new ad IDs
    const existingAdIds = metaCampaignIds.ad_ids || [];
    const allAdIds = [...existingAdIds, ...createdAdIds];

    await supabase
      .from('campaign_workspaces')
      .update({
        meta_campaign_ids: { ...metaCampaignIds, ad_ids: allAdIds },
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId);

    const success = createdAdIds.length > 0;
    const message = success
      ? `${createdAdIds.length} new ad(s) added to your campaign.${failedAds.length > 0 ? ` ${failedAds.length} failed.` : ''} Ads are paused — activate in Ads Manager when ready.`
      : 'Failed to create any ads. Please check your assets and try again.';

    return new Response(
      JSON.stringify({ success, adIds: createdAdIds, totalCreated: createdAdIds.length, totalFailed: failedAds.length, failedAds, message }),
      { status: success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('add-creative-to-campaign error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
