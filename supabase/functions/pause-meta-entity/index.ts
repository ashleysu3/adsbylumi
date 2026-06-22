import { createClient } from 'npm:@supabase/supabase-js@2';

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
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = claimsData.claims.sub;

  try {
    const { workspaceId, brandId, entityId, entityLevel, reason } = await req.json();

    if (!brandId || !entityId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing brandId or entityId' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: brand, error: brandErr } = await supabaseAdmin
      .from('brands')
      .select('meta_access_token, user_id')
      .eq('id', brandId)
      .single();
    if (brandErr || !brand) {
      return new Response(JSON.stringify({ success: false, error: 'Brand not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (brand.user_id !== userId) {
      return new Response(JSON.stringify({ success: false, error: 'Access denied' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!brand.meta_access_token) {
      return new Response(JSON.stringify({ success: false, error: 'Meta access token not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const metaToken = brand.meta_access_token;

    // Capture prior status for potential undo
    let priorStatus: string | null = null;
    try {
      const statusRes = await fetch(
        `https://graph.facebook.com/v25.0/${entityId}?fields=status&access_token=${encodeURIComponent(metaToken)}`,
      );
      const statusData = await statusRes.json();
      if (statusRes.ok && statusData?.status) {
        priorStatus = statusData.status;
      }
    } catch (e) {
      console.error('prior status fetch error', e);
    }

    // Pause
    const pauseRes = await fetch(`https://graph.facebook.com/v25.0/${entityId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAUSED', access_token: metaToken }),
    });
    const pauseData = await pauseRes.json();

    if (!pauseRes.ok || !pauseData?.success) {
      const errMsg =
        pauseData?.error?.error_user_msg ||
        pauseData?.error?.message ||
        `Meta returned ${pauseRes.status}`;
      return new Response(JSON.stringify({ success: false, error: errMsg }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabaseAdmin.from('ad_action_log').insert({
      brand_id: brandId,
      workspace_id: workspaceId ?? null,
      action_type: 'paused',
      meta_entity_id: entityId,
      action_detail: {
        level: entityLevel,
        prior_status: priorStatus,
        reason: reason ?? null,
        source: 'performance_one_thing',
      },
      source: 'performance_one_thing',
    });

    return new Response(JSON.stringify({ success: true, prior_status: priorStatus }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('pause-meta-entity error:', error);
    return new Response(JSON.stringify({ success: false, error: error?.message ?? 'Unknown error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
