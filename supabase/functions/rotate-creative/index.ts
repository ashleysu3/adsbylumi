import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate the caller
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
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
    const { workspaceId, brandId, fatigueAdId, benchAdId, reason, isAutoRotation } = await req.json();

    if (!workspaceId || !brandId) {
      return new Response(JSON.stringify({ error: 'Missing workspaceId or brandId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the authenticated user owns this brand
    const { data: brand, error: brandErr } = await supabaseAdmin
      .from('brands')
      .select('meta_access_token, user_id')
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
    if (brandErr || !brand?.meta_access_token) {
      return new Response(JSON.stringify({ error: 'Meta access token not found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const metaToken = brand.meta_access_token;

    const actions: string[] = [];
    let pauseSucceeded = false;
    let activateSucceeded = false;
    let pauseError: string | null = null;
    let activateError: string | null = null;

    // 1. Pause fatigued ad first. If this fails we MUST NOT activate the
    //    bench ad — otherwise the account double-spends (old ad still live +
    //    new ad live). This is real-money safety.
    if (fatigueAdId) {
      try {
        const pauseRes = await fetch(
          `https://graph.facebook.com/v25.0/${fatigueAdId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'PAUSED',
              access_token: metaToken,
            }),
          }
        );
        const pauseData = await pauseRes.json();
        if (pauseRes.ok && pauseData?.success) {
          pauseSucceeded = true;
          actions.push(`Paused ad ${fatigueAdId}`);

          await supabaseAdmin
            .from('creative_bench')
            .update({
              status: 'paused',
              paused_at: new Date().toISOString(),
            })
            .eq('meta_ad_id', fatigueAdId)
            .eq('workspace_id', workspaceId);
        } else {
          pauseError =
            pauseData?.error?.error_user_msg ||
            pauseData?.error?.message ||
            `Meta returned ${pauseRes.status}`;
          console.error('Failed to pause ad:', pauseData);
          actions.push(`Failed to pause ad ${fatigueAdId}: ${pauseError}`);
        }
      } catch (e: any) {
        pauseError = e?.message || 'pause network error';
        console.error('Error pausing ad:', e);
        actions.push(`Error pausing ad: ${pauseError}`);
      }
    }

    // 2. Activate bench ad — ONLY if no pause was requested, or the pause
    //    succeeded. Skipping here prevents double-spend on the brand's account.
    const shouldActivate = !!benchAdId && (!fatigueAdId || pauseSucceeded);
    if (benchAdId && !shouldActivate) {
      actions.push(`Skipped activating ad ${benchAdId} because pausing the fatigued ad failed`);
    }
    if (shouldActivate) {
      try {
        const activateRes = await fetch(
          `https://graph.facebook.com/v25.0/${benchAdId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'ACTIVE',
              access_token: metaToken,
            }),
          }
        );
        const activateData = await activateRes.json();
        if (activateRes.ok && activateData?.success) {
          activateSucceeded = true;
          actions.push(`Activated ad ${benchAdId}`);

          await supabaseAdmin
            .from('creative_bench')
            .update({
              status: 'live',
              last_live_at: new Date().toISOString(),
            })
            .eq('meta_ad_id', benchAdId)
            .eq('workspace_id', workspaceId);
        } else {
          activateError =
            activateData?.error?.error_user_msg ||
            activateData?.error?.message ||
            `Meta returned ${activateRes.status}`;
          console.error('Failed to activate ad:', activateData);
          actions.push(`Failed to activate ad ${benchAdId}: ${activateError}`);
        }
      } catch (e: any) {
        activateError = e?.message || 'activate network error';
        console.error('Error activating ad:', e);
        actions.push(`Error activating ad: ${activateError}`);
      }
    }

    // 3. Log rotation event (audit trail of attempt + outcome).
    await supabaseAdmin.from('creative_rotation_log').insert({
      workspace_id: workspaceId,
      brand_id: brandId,
      action: isAutoRotation ? 'auto_rotated' : 'user_approved',
      old_ad_id: fatigueAdId || null,
      new_ad_id: benchAdId || null,
      reason: reason || 'Manual rotation',
    });

    // 3b. Log to unified ad_action_log — ONLY for legs that actually succeeded.
    //     This log is read as the source of truth for "Lumi did this in Meta",
    //     so writing failed legs here would corrupt downstream history.
    if (pauseSucceeded && fatigueAdId) {
      await supabaseAdmin.from('ad_action_log').insert({
        brand_id: brandId,
        workspace_id: workspaceId,
        action_type: 'paused_ad',
        action_detail: { ad_id: fatigueAdId, reason: reason || 'Creative rotation' },
        source: isAutoRotation ? 'lumi_auto' : 'lumi_approved',
        meta_entity_id: fatigueAdId,
      });
    }
    if (activateSucceeded && benchAdId) {
      await supabaseAdmin.from('ad_action_log').insert({
        brand_id: brandId,
        workspace_id: workspaceId,
        action_type: 'activated_ad',
        action_detail: { ad_id: benchAdId, reason: reason || 'Creative rotation' },
        source: isAutoRotation ? 'lumi_auto' : 'lumi_approved',
        meta_entity_id: benchAdId,
      });
    }

    const overallSuccess =
      (fatigueAdId ? pauseSucceeded : true) &&
      (benchAdId ? activateSucceeded : true);

    return new Response(
      JSON.stringify({
        success: overallSuccess,
        actions,
        pauseSucceeded,
        activateSucceeded,
        error: overallSuccess
          ? undefined
          : pauseError ||
            activateError ||
            (benchAdId && !shouldActivate
              ? 'Pause failed — did not activate the bench ad to avoid double-spend.'
              : 'Rotation did not fully complete.'),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('rotate-creative error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
