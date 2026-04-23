import { createClient } from 'npm:@supabase/supabase-js@2';

// ============================================================================
// promote-ad-to-scaling
//
// Duplicates a winning ad from a Testing ad set into a Scaling ad set and
// pauses the original in Testing. Mirrors the manual workflow users like
// Ashley already run in Meta Ads Manager — LUMI just automates the clicks.
//
// Ordering matters. We create the new ad FIRST, then only pause the
// original on success. If creation fails we bail before touching anything.
// If pause fails we return partial success so the user knows to go pause
// the original manually (but the duplicate is live — desirable state).
//
// Input:
//   workspaceId: string
//   brandId: string
//   sourceAdId: string       // Meta ad ID being promoted
//   sourceAdName?: string    // Used to construct the new ad's name
//   targetAdSetId: string    // Meta adset ID for the Scaling ad set
//   reason?: string          // Logged to ad_action_log
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = claimsData.claims.sub;

  try {
    const { workspaceId, brandId, sourceAdId, sourceAdName, targetAdSetId, reason } = await req.json();

    if (!workspaceId || !brandId || !sourceAdId || !targetAdSetId) {
      return new Response(
        JSON.stringify({ error: 'Missing workspaceId, brandId, sourceAdId, or targetAdSetId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Verify the authenticated user owns this brand + grab the Meta token.
    const { data: brand, error: brandErr } = await supabaseAdmin
      .from('brands')
      .select('meta_access_token, meta_account_id, user_id')
      .eq('id', brandId)
      .single();
    if (brandErr || !brand) {
      return new Response(JSON.stringify({ error: 'Brand not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (brand.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!brand.meta_access_token || !brand.meta_account_id) {
      return new Response(
        JSON.stringify({ error: 'Brand is missing Meta access token or ad account ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const metaToken = brand.meta_access_token;
    const adAccountId = brand.meta_account_id;

    // -----------------------------------------------------------------------
    // Step 1: Read the source ad's creative and name. We need the creative ID
    // so the new ad can use the same underlying creative object.
    // -----------------------------------------------------------------------
    const fetchAdRes = await fetch(
      `https://graph.facebook.com/v21.0/${sourceAdId}?fields=name,creative{id}&access_token=${encodeURIComponent(metaToken)}`,
    );
    const fetchAdData = await fetchAdRes.json();
    if (fetchAdData.error) {
      return new Response(
        JSON.stringify({ error: `Failed to read source ad: ${fetchAdData.error.message}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const creativeId = fetchAdData?.creative?.id;
    const originalName = fetchAdData?.name || sourceAdName || 'Winning ad';
    if (!creativeId) {
      return new Response(
        JSON.stringify({ error: 'Source ad has no accessible creative ID' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // -----------------------------------------------------------------------
    // Step 2: Create the new ad in the Scaling ad set. Meta's /ads endpoint
    // lives under the ad account; the adset_id in the body determines the
    // target set. Status PAUSED on creation would mean the user has to
    // manually turn it on — we create it ACTIVE so the workflow matches the
    // user's mental model ("promote = it's now live in Scaling").
    // -----------------------------------------------------------------------
    const newAdName = originalName.startsWith('[Scaling]') ? originalName : `[Scaling] ${originalName}`;
    const createAdRes = await fetch(
      `https://graph.facebook.com/v21.0/${adAccountId}/ads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAdName,
          adset_id: targetAdSetId,
          creative: { creative_id: creativeId },
          status: 'ACTIVE',
          access_token: metaToken,
        }),
      },
    );
    const createAdData = await createAdRes.json();
    if (createAdData.error || !createAdData.id) {
      return new Response(
        JSON.stringify({
          error: `Failed to create ad in Scaling set: ${createAdData.error?.message || 'unknown error'}`,
          details: createAdData.error || null,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const newAdId: string = createAdData.id;

    // -----------------------------------------------------------------------
    // Step 3: Pause the source ad in Testing. If this fails the user ends up
    // with duplicates running in both sets — we flag it in the response so
    // the UI can surface a clear "go pause the original" nudge.
    // -----------------------------------------------------------------------
    let pauseFailed: string | null = null;
    try {
      const pauseRes = await fetch(
        `https://graph.facebook.com/v21.0/${sourceAdId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'PAUSED', access_token: metaToken }),
        },
      );
      const pauseData = await pauseRes.json();
      if (!pauseData.success) {
        pauseFailed = pauseData.error?.message || 'Meta did not confirm the pause';
      }
    } catch (e: any) {
      pauseFailed = e?.message || 'Network error pausing source ad';
    }

    // -----------------------------------------------------------------------
    // Step 4: Audit log. Even if pause failed, the creation succeeded and
    // should be recorded so "why is this ad running in two sets?" has an
    // answer later.
    // -----------------------------------------------------------------------
    await supabaseAdmin.from('ad_action_log').insert([
      {
        brand_id: brandId,
        workspace_id: workspaceId,
        action_type: 'promoted_to_scaling',
        action_detail: {
          source_ad_id: sourceAdId,
          source_ad_name: originalName,
          new_ad_id: newAdId,
          new_ad_name: newAdName,
          target_adset_id: targetAdSetId,
          reason: reason || 'Approved Lumi promote-to-scaling recommendation',
        },
        source: 'lumi_approved',
        meta_entity_id: newAdId,
      },
      ...(pauseFailed ? [] : [{
        brand_id: brandId,
        workspace_id: workspaceId,
        action_type: 'paused_ad',
        action_detail: {
          ad_id: sourceAdId,
          reason: 'Paused after promote-to-scaling',
        },
        source: 'lumi_approved',
        meta_entity_id: sourceAdId,
      }]),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        newAdId,
        newAdName,
        pausedInTesting: !pauseFailed,
        pauseError: pauseFailed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('promote-ad-to-scaling error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
