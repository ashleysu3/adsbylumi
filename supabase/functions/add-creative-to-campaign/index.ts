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

    const { workspaceId, assets, copyVariations, instagramActorId } = await req.json();

    if (!workspaceId || !assets?.length || !copyVariations?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'workspaceId, assets, and copyVariations are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: workspace, error: wsError } = await supabase
      .from('campaign_workspaces')
      .select('*, brands!inner(id, name, user_id, meta_account_id, page_id, meta_access_token, instagram_account_id, multi_advertiser_ads)')
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

    const accountId = metaAccountId.replace('act_', '');

    const normalizeAccountId = (value?: string | null) => value?.replace(/^act_/, '');

    const isAdSetValidForAccount = async (candidateAdSetId: string): Promise<boolean> => {
      try {
        const adSetCheckRes = await fetch(
          `https://graph.facebook.com/v18.0/${candidateAdSetId}?fields=id,account_id,status,effective_status,campaign_id&access_token=${metaAccessToken}`
        );
        const adSetCheck = await adSetCheckRes.json();

        if (adSetCheck.error) {
          console.warn(`Ad set validation failed for ${candidateAdSetId}:`, adSetCheck.error);
          return false;
        }

        // Guard against accidentally using campaign IDs as ad_set_id values.
        // A real ad set has campaign_id; campaign objects do not.
        if (!adSetCheck.campaign_id) {
          console.warn(`ID ${candidateAdSetId} is not an ad set (missing campaign_id).`);
          return false;
        }

        const adSetAccountId = normalizeAccountId(adSetCheck.account_id);
        const effectiveStatuses = Array.isArray(adSetCheck.effective_status)
          ? adSetCheck.effective_status
          : [adSetCheck.effective_status].filter(Boolean);
        const isDeleted =
          adSetCheck.status === 'DELETED' ||
          adSetCheck.status === 'ARCHIVED' ||
          effectiveStatuses.includes('DELETED') ||
          effectiveStatuses.includes('ARCHIVED');

        if (adSetAccountId !== accountId || isDeleted) {
          console.warn(
            `Ad set ${candidateAdSetId} is invalid for connected account. adSetAccountId=${adSetAccountId}, expected=${accountId}, deleted=${isDeleted}`
          );
          return false;
        }

        return true;
      } catch (e) {
        console.warn(`Could not validate ad set ${candidateAdSetId}:`, e);
        return false;
      }
    };

    // Resolve ad set ID — use stored one if still valid, otherwise resolve from Meta campaign/ad IDs
    let adSetId = metaCampaignIds?.ad_set_id;

    // Guard against bad cache where campaignId was accidentally saved as ad_set_id
    if (adSetId && campaignId && String(adSetId) === String(campaignId)) {
      console.warn(`Stored ad_set_id matches campaignId (${adSetId}); treating as stale and re-resolving.`);
      adSetId = undefined;
    }

    if (adSetId) {
      const stillValid = await isAdSetValidForAccount(adSetId);
      if (!stillValid) {
        console.warn(`Stored ad_set_id ${adSetId} is stale/invalid; attempting re-resolve.`);
        adSetId = undefined;
      }
    }

    if (!adSetId && campaignId) {
      console.log(`No valid ad_set_id stored, resolving from campaign ${campaignId}...`);

      // First try: get ad set from existing ads
      const existingAdIds = metaCampaignIds?.ad_ids || [];
      if (existingAdIds.length > 0) {
        for (const adId of existingAdIds) {
          try {
            const adInfoRes = await fetch(
              `https://graph.facebook.com/v18.0/${adId}?fields=adset_id&access_token=${metaAccessToken}`
            );
            const adInfo = await adInfoRes.json();
            if (adInfo.adset_id && await isAdSetValidForAccount(adInfo.adset_id)) {
              adSetId = adInfo.adset_id;
              console.log(`Resolved ad set from existing ad ${adId}: ${adSetId}`);
              break;
            }
          } catch (e) {
            console.warn(`Could not resolve ad set from existing ad ${adId}`);
          }
        }
      }

      // Second try: fetch ad sets from campaign
      if (!adSetId) {
        const adSetsRes = await fetch(
          `https://graph.facebook.com/v18.0/${campaignId}/adsets?fields=id,name,status,effective_status&limit=10&access_token=${metaAccessToken}`
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

        const candidates = adSetsData.data || [];
        const preferredCandidates = [
          ...candidates.filter((s: any) => s.status === 'ACTIVE'),
          ...candidates.filter((s: any) => s.status !== 'ACTIVE'),
        ];

        for (const candidate of preferredCandidates) {
          if (await isAdSetValidForAccount(candidate.id)) {
            adSetId = candidate.id;
            console.log(`Resolved ad set from campaign: ${adSetId} (${candidate.name})`);
            break;
          }
        }

        if (!adSetId) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'No valid ad set found for the connected Meta ad account. Please rebuild the campaign or reconnect the correct ad account.',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Cache for future use
      await supabase
        .from('campaign_workspaces')
        .update({
          meta_campaign_ids: { ...metaCampaignIds, ad_set_id: adSetId },
        })
        .eq('id', workspaceId);
    }

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
    
    // Resolve Instagram actor ID: prefer explicit param, fall back to brand setting
    const igActorId = instagramActorId || brand.instagram_account_id || null;
    // Multi-advertiser ads: default OFF unless brand explicitly enabled it
    const multiAdvertiserAds = brand.multi_advertiser_ads === true;

    console.log(`Adding ${assets.length} creative(s) with ${copyVariations.length} copy variation(s) to ad set ${adSetId}`);
    console.log(`Using link: ${link}, CTA: ${ctaType}, IG actor: ${igActorId}, multi_advertiser: ${multiAdvertiserAds}`);

    const createdAdIds: string[] = [];
    const failedAds: Array<{ assetName: string; error: string }> = [];


    // Detect dynamic creative ad set restrictions (Meta allows only one ad in certain dynamic ad sets)
    let isDynamicCreativeAdSet = false;
    let forceClonePerAsset = false;
    try {
      const adSetMetaRes = await fetch(
        `https://graph.facebook.com/v18.0/${adSetId}?fields=id,is_dynamic_creative&access_token=${metaAccessToken}`
      );
      const adSetMeta = await adSetMetaRes.json();
      isDynamicCreativeAdSet = Boolean(adSetMeta?.is_dynamic_creative);
      console.log(`Ad set ${adSetId} dynamic creative mode: ${isDynamicCreativeAdSet}`);
    } catch (e) {
      console.warn('Could not determine ad set dynamic mode, proceeding with standard flow:', e);
    }

    const getAdSetDynamicMode = async (candidateAdSetId: string): Promise<boolean | null> => {
      try {
        const modeRes = await fetch(
          `https://graph.facebook.com/v18.0/${candidateAdSetId}?fields=id,is_dynamic_creative&access_token=${metaAccessToken}`
        );
        const modeData = await modeRes.json();
        if (modeData?.error) {
          console.warn(`Could not get dynamic mode for ad set ${candidateAdSetId}:`, modeData.error);
          return null;
        }
        return Boolean(modeData?.is_dynamic_creative);
      } catch (e) {
        console.warn(`Failed dynamic mode fetch for ad set ${candidateAdSetId}:`, e);
        return null;
      }
    };

    // Dynamic creative ad sets allow only one ad per ad set.
    // To support one-ad-per-creative, clone the base ad set per asset when needed.
    const cloneAdSetForAsset = async (assetName: string): Promise<string | null> => {
      try {
        const cloneRes = await fetch(
          `https://graph.facebook.com/v18.0/${adSetId}/copies`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              access_token: metaAccessToken,
              deep_copy: 'false',
            }),
          }
        );

        const cloneData = await cloneRes.json();
        if (cloneData.error) {
          console.error(`Failed to clone ad set for ${assetName}:`, cloneData.error);
          return null;
        }

        const clonedId =
          cloneData?.copied_adsets?.[0]?.id ||
          cloneData?.copied_adset_id ||
          cloneData?.id ||
          null;

        if (!clonedId) {
          console.error(`Ad set clone response missing ID for ${assetName}:`, cloneData);
          return null;
        }

        const valid = await isAdSetValidForAccount(String(clonedId));
        if (!valid) {
          console.error(`Cloned ad set ${clonedId} is invalid for connected account`);
          return null;
        }

        return String(clonedId);
      } catch (e) {
        console.error(`Error cloning ad set for ${assetName}:`, e);
        return null;
      }
    };

    for (const asset of assets) {
      console.log(`Processing asset: ${asset.name}`);

      // Default to resolved ad set; for dynamic creative, clone a fresh ad set per asset.
      let targetAdSetId = adSetId;
      if (isDynamicCreativeAdSet || forceClonePerAsset) {
        const clonedAdSetId = await cloneAdSetForAsset(asset.name);
        if (!clonedAdSetId) {
          failedAds.push({
            assetName: asset.name,
            error: 'Could not create dedicated ad set for dynamic creative campaign.',
          });
          continue;
        }
        targetAdSetId = clonedAdSetId;
        console.log(`Using cloned ad set ${targetAdSetId} for asset ${asset.name}`);
      }

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

        // Force standard (non-dynamic) creative payload per ad to avoid Meta 1885998 mismatches.
        // One-creative-per-ad is still supported via ad set cloning fallback on 1885553.
        const targetAdSetDynamicMode = false;

        const buildCreativeForMode = async (dynamicMode: boolean): Promise<string> => {
          const creativeParams: Record<string, string> = {
            name: `Creative - ${adName}`,
            access_token: metaAccessToken,
          };

          if (dynamicMode) {
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

            if (!assetFeedSpec.descriptions) delete assetFeedSpec.descriptions;

            creativeParams.asset_feed_spec = JSON.stringify(assetFeedSpec);
            const storySpec: any = { page_id: pageId };
            if (igActorId) storySpec.instagram_actor_id = igActorId;
            creativeParams.object_story_spec = JSON.stringify(storySpec);
          } else {
            const selectedCopy = copyVariations[0] || {};
            const message = selectedCopy.primary_text || '';
            const name = selectedCopy.headline || 'Learn More';
            const description = selectedCopy.description || '';

            const objectStorySpec: any = assetType === 'video'
              ? {
                  page_id: pageId,
                  ...(igActorId ? { instagram_actor_id: igActorId } : {}),
                  video_data: {
                    video_id: assetId,
                    message,
                    title: name,
                    ...(description ? { description } : {}),
                    call_to_action: {
                      type: ctaType,
                      value: { link },
                    },
                  },
                }
              : {
                  page_id: pageId,
                  ...(igActorId ? { instagram_actor_id: igActorId } : {}),
                  link_data: {
                    link,
                    message,
                    name,
                    ...(description ? { description } : {}),
                    image_hash: assetId,
                    call_to_action: {
                      type: ctaType,
                      value: { link },
                    },
                    multi_share_optimized: false,
                  },
                };

            creativeParams.object_story_spec = JSON.stringify(objectStorySpec);
          }

          // Disable personalized destinations (Advantage+ creative destinations)
          creativeParams.degrees_of_freedom_spec = JSON.stringify({
            creative_features_spec: {
              standard_enhancements: { enroll_status: 'OPT_OUT' }
            }
          });

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
            throw new Error(
              `Creative: ${creativeData.error.message} (code ${creativeData.error.code}${creativeData.error.error_subcode ? `/${creativeData.error.error_subcode}` : ''})`
            );
          }

          return creativeData.id;
        };

        let creativeId: string;
        try {
          creativeId = await buildCreativeForMode(targetAdSetDynamicMode);
        } catch (creativeError: any) {
          console.error(`Creative failed for ${adName}:`, creativeError);
          failedAds.push({ assetName: asset.name, error: creativeError.message || 'Creative creation failed' });
          continue;
        }

        // Build ad params (do not pass tracking_specs; Meta often rejects it on create)
        const adParams: Record<string, string> = {
          adset_id: targetAdSetId,
          name: adName,
          creative: JSON.stringify({ creative_id: creativeId }),
          status: 'ACTIVE',
          access_token: metaAccessToken,
        };

        // Disable multi-advertiser ads unless brand explicitly opted in
        if (!multiAdvertiserAds) {
          adParams.multi_advertiser_ads = 'false';
        }

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
          const isDynamicRestriction = adData.error?.error_subcode === 1885553;

          // If Meta enforces one-ad-per-dynamic-ad-set, retry this asset in a cloned ad set.
          if (isDynamicRestriction) {
            console.warn(
              `Dynamic creative restriction hit for ad set ${targetAdSetId}. Falling back to cloned ad set flow for ${asset.name}.`
            );

            forceClonePerAsset = true;

            const fallbackAdSetId = await cloneAdSetForAsset(`${asset.name}-fallback`);
            if (!fallbackAdSetId) {
              failedAds.push({
                assetName: asset.name,
                error: 'Ad set is dynamic-creative restricted and fallback clone failed.',
              });
              continue;
            }

            const retryAdParams: Record<string, string> = {
              adset_id: fallbackAdSetId,
              name: adName,
              creative: JSON.stringify({ creative_id: creativeId }),
              status: 'ACTIVE',
              access_token: metaAccessToken,
            };

            if (!multiAdvertiserAds) {
              retryAdParams.multi_advertiser_ads = 'false';
            }

            const retryAdResponse = await fetch(
              `https://graph.facebook.com/v18.0/act_${accountId}/ads`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(retryAdParams),
              }
            );

            const retryAdData = await retryAdResponse.json();
            if (retryAdData.error) {
              console.error(`Fallback ad creation failed for ${adName}:`, retryAdData.error);
              failedAds.push({
                assetName: asset.name,
                error: `Ad fallback: ${retryAdData.error.message} (code ${retryAdData.error.code}${retryAdData.error.error_subcode ? `/${retryAdData.error.error_subcode}` : ''})`,
              });
              continue;
            }

            createdAdIds.push(retryAdData.id);
            console.log(`Ad created via fallback: ${retryAdData.id} (${adName}) on cloned ad set ${fallbackAdSetId}`);
            continue;
          }

          console.error(`Ad creation failed for ${adName}:`, adData.error);
          failedAds.push({
            assetName: asset.name,
            error: `Ad: ${adData.error.message} (code ${adData.error.code}${adData.error.error_subcode ? `/${adData.error.error_subcode}` : ''})`,
          });
          continue;
        }

        createdAdIds.push(adData.id);
        console.log(`Ad created: ${adData.id} (${adName}) on ad set ${targetAdSetId}`);
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
      ? `${createdAdIds.length} new ad(s) added to your campaign.${failedAds.length > 0 ? ` ${failedAds.length} failed.` : ''} Ads are live!`
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
