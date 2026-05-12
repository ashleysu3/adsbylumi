import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * Add existing Instagram/Facebook posts as new ads to an existing campaign's ad set.
 * This is used for social growth campaigns where users pick existing posts to promote.
 */

function translateMetaCreativeError(error: any): string {
  const msg = (error.message || '').toLowerCase();
  const userMsg = (error.error_user_msg || '').toLowerCase();
  const code = error.code;
  const subcode = error.error_subcode;

  // Copyrighted music
  if (msg.includes('music') || msg.includes('copyright') || userMsg.includes('music') || subcode === 1487851) {
    return 'This post has licensed music that Meta won\'t allow in ads. Try a different post without copyrighted audio.';
  }

  // Invalid/unsupported media type
  if (msg.includes('invalid media') || msg.includes('media type') || subcode === 1487390) {
    return 'This post type can\'t be promoted as an ad. Try a photo or Reel instead.';
  }

  // Post not found or deleted
  if (code === 100 || msg.includes('does not exist') || msg.includes('not found')) {
    return 'We couldn\'t find this post. It may have been deleted or is from a private account.';
  }

  // Permission denied
  if (code === 10 || code === 200 || msg.includes('permission')) {
    return 'Meta didn\'t allow access to this post. Make sure it\'s on a Business or Creator account connected to your Page.';
  }

  // Story or expired content
  if (msg.includes('story') || msg.includes('expired')) {
    return 'Stories and expired content can\'t be used as ads. Try a regular post or Reel.';
  }

  // Generic fallback with user-facing message if available
  if (error.error_user_msg) {
    return error.error_user_msg;
  }

  return 'Meta couldn\'t use this post as an ad. Try a different one.';
}

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

    const { workspaceId, posts } = await req.json();

    if (!workspaceId || !posts?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'workspaceId and posts are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch workspace + brand
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

    const brand = workspace.brands as any;

    if (brand.user_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metaCampaignIds = workspace.meta_campaign_ids as any;
    const metaAccountId = brand.meta_account_id;
    const pageId = brand.page_id;
    const metaAccessToken = brand.meta_access_token;
    const igAccountId = brand.instagram_account_id;

    if (!metaAccountId || !pageId || !metaAccessToken || !igAccountId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Meta account, Page, Instagram account, or access token not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountId = metaAccountId.replace('act_', '');

    // Resolve ad set ID from workspace
    let adSetId = metaCampaignIds?.ad_set_id;
    const campaignId = metaCampaignIds?.campaignId || metaCampaignIds?.campaign_id;

    if (!adSetId && !campaignId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No existing campaign found. Build the campaign first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no cached ad set, resolve from campaign
    if (!adSetId && campaignId) {
      console.log(`No ad_set_id cached, resolving from campaign ${campaignId}...`);

      // Try getting ad sets from campaign
      const adSetsRes = await fetch(
        `https://graph.facebook.com/v25.0/${campaignId}/adsets?fields=id,name,status&limit=10&access_token=${metaAccessToken}`
      );
      const adSetsData = await adSetsRes.json();

      if (adSetsData.error) {
        return new Response(
          JSON.stringify({ success: false, error: `Failed to fetch ad sets: ${adSetsData.error.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const candidates = adSetsData.data || [];
      // Prefer active ad sets
      const active = candidates.find((s: any) => s.status === 'ACTIVE');
      adSetId = active?.id || candidates[0]?.id;

      if (!adSetId) {
        return new Response(
          JSON.stringify({ success: false, error: 'No ad set found in campaign. Please rebuild the campaign.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Cache for future
      await supabase
        .from('campaign_workspaces')
        .update({ meta_campaign_ids: { ...metaCampaignIds, ad_set_id: adSetId } })
        .eq('id', workspaceId);

      console.log(`Resolved and cached ad_set_id: ${adSetId}`);
    }

    // Clone reference settings from existing ad (link, CTA, UTM params)
    let referenceSettings: any = null;
    try {
      const adsRes = await fetch(
        `https://graph.facebook.com/v25.0/${adSetId}/ads?fields=creative{object_story_spec,url_tags}&limit=1&access_token=${metaAccessToken}`
      );
      const adsData = await adsRes.json();

      if (adsData.data?.length > 0 && adsData.data[0].creative) {
        const spec = adsData.data[0].creative.object_story_spec;
        if (spec) {
          const linkData = spec.link_data || {};
          const videoData = spec.video_data || {};
          const source = linkData.link ? linkData : videoData;
          referenceSettings = {
            link: source.link || linkData.link || '',
            call_to_action_type: source.call_to_action?.type || 'LEARN_MORE',
            url_tags: adsData.data[0].creative.url_tags || null,
          };
          console.log('Cloned reference settings:', JSON.stringify(referenceSettings));
        }
      }
    } catch (e) {
      console.warn('Could not fetch existing ad settings:', e);
    }

    // Multi-advertiser ads: ALWAYS OFF
    const multiAdvertiserAds = false;

    console.log(`Adding ${posts.length} post(s) as new ads to ad set ${adSetId}`);

    const createdAdIds: string[] = [];
    const failedAds: Array<{ postId: string; error: string }> = [];

    for (const post of posts) {
      const postId = post.id;
      const mediaType = post.media_type; // IMAGE or VIDEO
      const caption = post.caption || '';


      try {
        // Use Existing Post payload for Instagram media:
        // Meta expects page (object_id), instagram_user_id, and source_instagram_media_id.
        const creativeParams: Record<string, string> = {
          name: `Post Ad - ${caption.substring(0, 40) || postId}`,
          object_id: pageId,
          instagram_user_id: igAccountId,
          source_instagram_media_id: postId,
          access_token: metaAccessToken,
        };


        const creativeRes = await fetch(
          `https://graph.facebook.com/v25.0/act_${accountId}/adcreatives`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(creativeParams),
          }
        );

        const creativeData = await creativeRes.json();

        if (creativeData.error) {
          console.error(`Creative creation failed for post ${postId}:`, creativeData.error);
          const friendlyError = translateMetaCreativeError(creativeData.error);
          failedAds.push({ postId, error: friendlyError });
          continue;
        }

        const creativeId = creativeData.id;
        console.log(`Creative created for post ${postId}: ${creativeId}`);

        // Create the ad
        const adParams: Record<string, string> = {
          adset_id: adSetId,
          name: `Post - ${caption.substring(0, 50) || postId}`,
          creative: JSON.stringify({ creative_id: creativeId }),
          status: 'ACTIVE',
          access_token: metaAccessToken,
        };

        // Disable multi-advertiser unless explicitly enabled
        if (!multiAdvertiserAds) {
          adParams['multi_advertiser_ads'] = JSON.stringify({ use_multi_advertiser_ads: false });
        }

        const adRes = await fetch(
          `https://graph.facebook.com/v25.0/act_${accountId}/ads`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(adParams),
          }
        );

        const adData = await adRes.json();

        if (adData.error) {
          console.error(`Ad creation failed for post ${postId}:`, adData.error);
          failedAds.push({ postId, error: adData.error.message || 'Ad creation failed' });
          continue;
        }

        createdAdIds.push(adData.id);
        console.log(`Ad created for post ${postId}: ${adData.id}`);

      } catch (e: any) {
        console.error(`Error processing post ${postId}:`, e);
        failedAds.push({ postId, error: e.message || 'Unknown error' });
      }
    }

    // Update workspace with new ad IDs
    const existingAdIds = metaCampaignIds?.ad_ids || [];
    const updatedAdIds = [...existingAdIds, ...createdAdIds];
    await supabase
      .from('campaign_workspaces')
      .update({
        meta_campaign_ids: { ...metaCampaignIds, ad_ids: updatedAdIds, ad_set_id: adSetId },
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId);

    const success = createdAdIds.length > 0;
    const allFailed = createdAdIds.length === 0 && failedAds.length > 0;

    return new Response(
      JSON.stringify({
        success,
        createdAds: createdAdIds.length,
        failedAds,
        message: allFailed
          ? `Failed to add posts: ${failedAds[0]?.error}`
          : `Successfully added ${createdAdIds.length} post(s) as ads${failedAds.length > 0 ? ` (${failedAds.length} failed)` : ''}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in add-posts-to-campaign:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    );
  }
});
