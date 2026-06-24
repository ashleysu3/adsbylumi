import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * Add existing Instagram/Facebook posts as new ads to a live campaign.
 *
 * Supports two flows:
 *  - Social growth (legacy): adds posts into the workspace's cached ad set.
 *  - Promote existing post: optionally clones the existing ad set so the
 *    promoted post's results can be measured cleanly, and creates the new
 *    ad PAUSED by default so the user can preview + confirm before going live.
 *
 * Returns previews so the UI can require explicit confirmation before
 * activating any ad — standard LUMI safety pattern.
 */

function translateMetaCreativeError(error: any): string {
  const msg = (error.message || '').toLowerCase();
  const userMsg = (error.error_user_msg || '').toLowerCase();
  const code = error.code;
  const subcode = error.error_subcode;

  if (msg.includes('music') || msg.includes('copyright') || userMsg.includes('music') || subcode === 1487851) {
    return "This post has licensed music that Meta won't allow in ads. Try a different post without copyrighted audio.";
  }
  if (msg.includes('invalid media') || msg.includes('media type') || subcode === 1487390) {
    return "This post type can't be promoted as an ad. Try a photo or Reel instead.";
  }
  if (code === 100 || msg.includes('does not exist') || msg.includes('not found')) {
    return "We couldn't find this post. It may have been deleted or is from a private account.";
  }
  if (code === 10 || code === 200 || msg.includes('permission')) {
    return "Meta didn't allow access to this post. Make sure it's on a Business or Creator account connected to your Page.";
  }
  if (msg.includes('story') || msg.includes('expired')) {
    return "Stories and expired content can't be used as ads. Try a regular post or Reel.";
  }
  if (error.error_user_msg) return error.error_user_msg;
  return "Meta couldn't use this post as an ad. Try a different one.";
}

async function fetchAdPreview(adId: string, token: string): Promise<string | null> {
  // Try a few formats in order — different objectives support different previews.
  const formats = ['MOBILE_FEED_STANDARD', 'INSTAGRAM_STANDARD', 'INSTAGRAM_REELS', 'DESKTOP_FEED_STANDARD'];
  for (const fmt of formats) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v25.0/${adId}/previews?ad_format=${fmt}&access_token=${token}`
      );
      const data = await res.json();
      const body = data?.data?.[0]?.body;
      if (body && typeof body === 'string') {
        // Extract the iframe src so the UI can embed it cleanly.
        const m = body.match(/src=\"([^\"]+)\"/);
        return m?.[1] || null;
      }
    } catch (e) {
      console.warn(`Preview ${fmt} failed for ${adId}:`, e);
    }
  }
  return null;
}

async function cloneAdSet(sourceAdSetId: string, campaignId: string, token: string, newName: string): Promise<{ id?: string; error?: string }> {
  try {
    const params = new URLSearchParams({
      campaign_id: campaignId,
      deep_copy: 'false',
      status_option: 'PAUSED',
      rename_options: JSON.stringify({ rename_suffix: ' — promoted post' }),
      access_token: token,
    });
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${sourceAdSetId}/copies`,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params }
    );
    const data = await res.json();
    if (data.error) return { error: data.error.message || 'Failed to copy ad set' };
    const newId = data.copied_adset_id || data.id;
    if (!newId) return { error: 'Meta did not return a new ad set ID' };

    // Best-effort rename for clarity in Ads Manager.
    try {
      await fetch(`https://graph.facebook.com/v25.0/${newId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ name: newName, access_token: token }),
      });
    } catch { /* non-fatal */ }

    return { id: newId };
  } catch (e: any) {
    return { error: e?.message || 'Failed to copy ad set' };
  }
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

    const {
      workspaceId,
      posts,
      // New options:
      status,            // 'PAUSED' | 'ACTIVE' — default PAUSED (safe by default)
      createNewAdSet,    // boolean — default true for promoted posts
      adSetName,         // optional override
    } = await req.json();

    if (!workspaceId || !posts?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'workspaceId and posts are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adStatus: 'PAUSED' | 'ACTIVE' = status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';

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

    if (!metaAccountId || !pageId || !metaAccessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Meta account, Page, or access token not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountId = metaAccountId.replace('act_', '');

    let adSetId: string | null = metaCampaignIds?.ad_set_id || null;
    const campaignId = metaCampaignIds?.campaignId || metaCampaignIds?.campaign_id;

    if (!adSetId && !campaignId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No existing campaign found. Build the campaign first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve source ad set if not cached
    if (!adSetId && campaignId) {
      console.log(`No ad_set_id cached, resolving from campaign ${campaignId}...`);
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
      const active = candidates.find((s: any) => s.status === 'ACTIVE');
      adSetId = active?.id || candidates[0]?.id;

      if (!adSetId) {
        return new Response(
          JSON.stringify({ success: false, error: 'No ad set found in campaign. Please rebuild the campaign.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      await supabase
        .from('campaign_workspaces')
        .update({ meta_campaign_ids: { ...metaCampaignIds, ad_set_id: adSetId } })
        .eq('id', workspaceId);
    }

    const sourceAdSetId = adSetId!;
    let targetAdSetId = sourceAdSetId;
    let newAdSetCreated = false;

    if (createNewAdSet && campaignId) {
      const proposedName = adSetName || `Promoted post — ${new Date().toISOString().slice(0, 10)}`;
      const cloned = await cloneAdSet(sourceAdSetId, campaignId, metaAccessToken, proposedName);
      if (cloned.id) {
        targetAdSetId = cloned.id;
        newAdSetCreated = true;
        console.log(`Cloned ad set ${sourceAdSetId} -> ${targetAdSetId}`);
      } else {
        console.warn('Ad set clone failed, falling back to source ad set:', cloned.error);
      }
    }

    // Multi-advertiser ads: ALWAYS OFF
    const multiAdvertiserAds = false;

    console.log(`Adding ${posts.length} post(s) as new ads (status=${adStatus}) to ad set ${targetAdSetId}`);

    const createdAds: Array<{ adId: string; postId: string; previewIframeUrl: string | null; status: string }> = [];
    const failedAds: Array<{ postId: string; error: string }> = [];

    for (const post of posts) {
      const postId = post.id;
      const caption = post.caption || '';
      const isFacebookPost = post.platform === 'facebook' || !!post.facebook_post_id;

      if (!isFacebookPost && post.instagram_account_id && post.instagram_account_id !== igAccountId) {
        failedAds.push({
          postId,
          error: 'This post belongs to a different Instagram account than the one saved on this brand.',
        });
        continue;
      }
      if (!isFacebookPost && !igAccountId) {
        failedAds.push({
          postId,
          error: 'No Instagram account is connected to this brand.',
        });
        continue;
      }

      try {
        // Build the creative payload depending on source platform.
        const creativeParams: Record<string, string> = {
          name: `Existing post — ${caption.substring(0, 40) || postId}`,
          access_token: metaAccessToken,
        };

        if (isFacebookPost) {
          // Facebook Page post — use object_story_id (format: "<page_id>_<post_id>")
          const storyId = post.facebook_post_id || (postId.includes('_') ? postId : `${pageId}_${postId}`);
          creativeParams.object_story_id = storyId;
        } else {
          // Instagram media — use existing-post fields
          creativeParams.object_id = pageId;
          creativeParams.instagram_user_id = igAccountId!;
          creativeParams.source_instagram_media_id = postId;
        }

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
          failedAds.push({ postId, error: translateMetaCreativeError(creativeData.error) });
          continue;
        }
        const creativeId = creativeData.id;

        const adParams: Record<string, string> = {
          adset_id: targetAdSetId,
          name: `Post — ${caption.substring(0, 50) || postId}`,
          creative: JSON.stringify({ creative_id: creativeId }),
          status: adStatus,
          access_token: metaAccessToken,
        };
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

        const adId = adData.id;
        const previewIframeUrl = await fetchAdPreview(adId, metaAccessToken);
        createdAds.push({ adId, postId, previewIframeUrl, status: adStatus });
        console.log(`Ad created for post ${postId}: ${adId} (status=${adStatus})`);
      } catch (e: any) {
        console.error(`Error processing post ${postId}:`, e);
        failedAds.push({ postId, error: e.message || 'Unknown error' });
      }
    }

    // Update workspace with new ad IDs (only if we actually used the source ad set)
    const createdAdIds = createdAds.map(a => a.adId);
    const existingAdIds = metaCampaignIds?.ad_ids || [];
    const updatedAdIds = [...existingAdIds, ...createdAdIds];
    await supabase
      .from('campaign_workspaces')
      .update({
        meta_campaign_ids: {
          ...metaCampaignIds,
          ad_ids: updatedAdIds,
          ad_set_id: sourceAdSetId, // keep source as primary
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId);

    const success = createdAds.length > 0;
    const allFailed = createdAds.length === 0 && failedAds.length > 0;

    return new Response(
      JSON.stringify({
        success,
        createdAds: createdAds.length,
        ads: createdAds, // [{adId, postId, previewIframeUrl, status}]
        failedAds,
        newAdSetCreated,
        adSetId: targetAdSetId,
        message: allFailed
          ? `Failed to add posts: ${failedAds[0]?.error}`
          : adStatus === 'PAUSED'
            ? `Added ${createdAds.length} post(s) as PAUSED ad(s) — preview and confirm before going live.`
            : `Successfully added ${createdAds.length} post(s) as ads${failedAds.length > 0 ? ` (${failedAds.length} failed)` : ''}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in add-posts-to-campaign:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 200, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    );
  }
});
