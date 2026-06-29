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
      const { data: roleRow } = await supabaseAdmin
        .from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
      if (!roleRow) {
        return new Response(JSON.stringify({ success: false, error: 'Access denied' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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

    // Pause in Meta.
    // Use form-encoded body — Graph API's POST update endpoint is most reliable
    // with x-www-form-urlencoded and occasionally rejects JSON bodies with
    // (#100) "param status is required" even though the field is present.
    let pauseRes: Response;
    let rawBody = '';
    let pauseData: any = null;
    try {
      const form = new URLSearchParams();
      form.set('status', 'PAUSED');
      form.set('access_token', metaToken);
      pauseRes = await fetch(`https://graph.facebook.com/v25.0/${entityId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      rawBody = await pauseRes.text();
      try { pauseData = rawBody ? JSON.parse(rawBody) : {}; } catch { pauseData = { _raw: rawBody }; }
    } catch (fetchErr: any) {
      console.error('[pause-meta-entity] network error calling Meta', {
        entityId,
        entityLevel,
        message: fetchErr?.message,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not reach Meta. Check your connection and try again.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Meta's POST update returns one of:
    //   { success: true }                                  (campaigns/adsets, sometimes)
    //   { id: "<entity_id>" }                              (ads, sometimes campaigns)
    //   { error: { code, message, error_user_msg, ... } } (failure)
    // The previous check required `pauseData.success === true`, which falsely
    // flagged the `{ id: ... }` shape as a failure and surfaced "non-2xx" to
    // the user. Treat the response as a failure ONLY when the HTTP status is
    // not OK or Meta returned an explicit `error` object.
    const metaError = pauseData?.error;
    if (!pauseRes.ok || metaError) {
      const errMsg =
        metaError?.error_user_msg ||
        metaError?.message ||
        `Meta returned HTTP ${pauseRes.status}`;
      console.error('[pause-meta-entity] Meta rejected pause', {
        entityId,
        entityLevel,
        httpStatus: pauseRes.status,
        metaErrorCode: metaError?.code,
        metaErrorSubcode: metaError?.error_subcode,
        metaErrorType: metaError?.type,
        metaErrorTraceId: metaError?.fbtrace_id,
        rawBody: rawBody.slice(0, 1000),
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: errMsg,
          meta_error_code: metaError?.code ?? null,
          meta_error_subcode: metaError?.error_subcode ?? null,
          fb_trace_id: metaError?.fbtrace_id ?? null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Success — reflect the new state locally so Live Ads / counters stop
    // showing this campaign as active until the next full sync runs.
    if (workspaceId && (entityLevel === 'campaign' || !entityLevel)) {
      try {
        const { error: updErr } = await supabaseAdmin
          .from('campaign_workspaces')
          .update({
            meta_campaign_status: 'paused',
            updated_at: new Date().toISOString(),
          })
          .eq('id', workspaceId);
        if (updErr) {
          console.error('[pause-meta-entity] local status update failed', updErr);
        }
      } catch (e) {
        console.error('[pause-meta-entity] local status update threw', e);
      }
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
