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

    // 1. Pause fatigued ad if provided
    if (fatigueAdId) {
      try {
        const pauseRes = await fetch(
          `https://graph.facebook.com/v21.0/${fatigueAdId}`,
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
        if (pauseData.success) {
          actions.push(`Paused ad ${fatigueAdId}`);

          // Update creative_bench status
          await supabaseAdmin
            .from('creative_bench')
            .update({
              status: 'paused',
              paused_at: new Date().toISOString(),
            })
            .eq('meta_ad_id', fatigueAdId)
            .eq('workspace_id', workspaceId);
        } else {
          console.error('Failed to pause ad:', pauseData);
          actions.push(`Failed to pause ad ${fatigueAdId}: ${JSON.stringify(pauseData.error)}`);
        }
      } catch (e) {
        console.error('Error pausing ad:', e);
        actions.push(`Error pausing ad: ${e.message}`);
      }
    }

    // 2. Activate bench ad if provided
    if (benchAdId) {
      try {
        const activateRes = await fetch(
          `https://graph.facebook.com/v21.0/${benchAdId}`,
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
        if (activateData.success) {
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
          console.error('Failed to activate ad:', activateData);
          actions.push(`Failed to activate ad ${benchAdId}: ${JSON.stringify(activateData.error)}`);
        }
      } catch (e) {
        console.error('Error activating ad:', e);
        actions.push(`Error activating ad: ${e.message}`);
      }
    }

    // 3. Log rotation event
    await supabaseAdmin.from('creative_rotation_log').insert({
      workspace_id: workspaceId,
      brand_id: brandId,
      action: isAutoRotation ? 'auto_rotated' : 'user_approved',
      old_ad_id: fatigueAdId || null,
      new_ad_id: benchAdId || null,
      reason: reason || 'Manual rotation',
    });

    // 3b. Log to unified ad_action_log
    if (fatigueAdId) {
      await supabaseAdmin.from('ad_action_log').insert({
        brand_id: brandId,
        workspace_id: workspaceId,
        action_type: 'paused_ad',
        action_detail: { ad_id: fatigueAdId, reason: reason || 'Creative rotation' },
        source: isAutoRotation ? 'lumi_auto' : 'lumi_approved',
        meta_entity_id: fatigueAdId,
      });
    }
    if (benchAdId) {
      await supabaseAdmin.from('ad_action_log').insert({
        brand_id: brandId,
        workspace_id: workspaceId,
        action_type: 'activated_ad',
        action_detail: { ad_id: benchAdId, reason: reason || 'Creative rotation' },
        source: isAutoRotation ? 'lumi_auto' : 'lumi_approved',
        meta_entity_id: benchAdId,
      });
    }

    // Slack notification disabled — only bug reports and new users go to Slack

    return new Response(JSON.stringify({ success: true, actions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('rotate-creative error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
