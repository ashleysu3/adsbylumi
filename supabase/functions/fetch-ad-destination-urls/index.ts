import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId } = await req.json();

    if (!workspaceId) {
      throw new Error('workspaceId is required');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: workspace, error: workspaceError } = await supabase
      .from('campaign_workspaces')
      .select('*, brands!inner(id, meta_account_id, meta_access_token, user_id)')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      throw new Error('Workspace not found');
    }

    const brand = workspace.brands as any;
    if (brand.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const metaCampaignIds = workspace.meta_campaign_ids as any;
    if (!metaCampaignIds?.campaignId) {
      throw new Error('Campaign not published to Meta');
    }

    const metaAccessToken = brand.meta_access_token;
    if (!metaAccessToken) {
      throw new Error('Meta access token not found');
    }

    const campaignId = metaCampaignIds.campaignId;
    console.log(`Fetching destination URLs for campaign ${campaignId}`);

    // Fetch ads with their creative details
    const adsUrl = `https://graph.facebook.com/v25.0/${campaignId}/ads?fields=id,name,status,creative{object_story_spec,asset_feed_spec}&limit=50&access_token=${metaAccessToken}`;
    const adsResponse = await fetch(adsUrl);
    const adsData = await adsResponse.json();

    if (!adsResponse.ok) {
      console.error('Failed to fetch ads:', adsData);
      throw new Error(adsData.error?.message || 'Failed to fetch ads');
    }

    const urls = new Set<string>();

    for (const ad of (adsData.data || [])) {
      try {
        const creative = ad.creative;
        if (!creative) continue;

        // Check object_story_spec for link
        const spec = creative.object_story_spec;
        if (spec?.link_data?.link) {
          urls.add(spec.link_data.link);
        }
        if (spec?.video_data?.call_to_action?.value?.link) {
          urls.add(spec.video_data.call_to_action.value.link);
        }

        // Check asset_feed_spec for links
        const feedSpec = creative.asset_feed_spec;
        if (feedSpec?.link_urls) {
          for (const linkUrl of feedSpec.link_urls) {
            if (linkUrl?.website_url) urls.add(linkUrl.website_url);
          }
        }
        if (feedSpec?.bodies) {
          // Sometimes the link is in call_to_actions
        }
        if (feedSpec?.call_to_action_types) {
          // These don't contain URLs directly
        }
      } catch (e) {
        console.log('Error parsing ad creative:', e);
      }
    }

    // If we didn't find URLs from creative specs, try fetching ad creative previews
    if (urls.size === 0) {
      for (const ad of (adsData.data || []).slice(0, 5)) {
        try {
          const creativeUrl = `https://graph.facebook.com/v25.0/${ad.id}?fields=creative{effective_object_story_id,object_story_spec}&access_token=${metaAccessToken}`;
          const creativeResp = await fetch(creativeUrl);
          const creativeData = await creativeResp.json();
          
          const spec = creativeData?.creative?.object_story_spec;
          if (spec?.link_data?.link) urls.add(spec.link_data.link);
          if (spec?.video_data?.call_to_action?.value?.link) urls.add(spec.video_data.call_to_action.value.link);
        } catch (e) {
          console.log('Error fetching ad creative details:', e);
        }
      }
    }

    const uniqueUrls = Array.from(urls).filter(url => {
      try {
        const parsed = new URL(url);
        // Filter out Facebook/Instagram URLs
        return !parsed.hostname.includes('facebook.com') && !parsed.hostname.includes('instagram.com');
      } catch {
        return false;
      }
    });

    console.log(`Found ${uniqueUrls.length} destination URLs`);

    return new Response(
      JSON.stringify({ success: true, urls: uniqueUrls }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error in fetch-ad-destination-urls:', error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
