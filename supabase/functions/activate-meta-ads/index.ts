import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * Flip a Meta ad from PAUSED to ACTIVE after the user has previewed it
 * and explicitly confirmed. Standard LUMI safety pattern: nothing goes
 * live without user approval.
 */
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
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { workspaceId, adIds, alsoActivateAdSetId } = await req.json();
    if (!workspaceId || !Array.isArray(adIds) || adIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'workspaceId and adIds[] are required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: workspace } = await supabase
      .from('campaign_workspaces')
      .select('id, brands!inner(id, user_id, meta_access_token)')
      .eq('id', workspaceId)
      .maybeSingle();
    if (!workspace) {
      return new Response(
        JSON.stringify({ success: false, error: 'Workspace not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const brand = workspace.brands as any;
    if (brand.user_id !== user.id) {
      const { data: roleRow } = await supabase
        .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      if (!roleRow) {
        return new Response(
          JSON.stringify({ success: false, error: 'Access denied' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const token = brand.meta_access_token;
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Meta access token missing — please reconnect.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If the post was added into a new ad set, that ad set was also created PAUSED.
    // Activate it first so the ads can actually deliver.
    if (alsoActivateAdSetId) {
      try {
        const r = await fetch(`https://graph.facebook.com/v25.0/${alsoActivateAdSetId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ status: 'ACTIVE', access_token: token }),
        });
        const d = await r.json();
        if (d.error) console.warn('Ad set activation warning:', d.error);
      } catch (e) {
        console.warn('Ad set activation failed (continuing):', e);
      }
    }

    const activated: string[] = [];
    const failed: Array<{ adId: string; error: string }> = [];

    for (const adId of adIds) {
      try {
        const r = await fetch(`https://graph.facebook.com/v25.0/${adId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ status: 'ACTIVE', access_token: token }),
        });
        const d = await r.json();
        if (d.error) {
          failed.push({ adId, error: d.error.message || 'Failed to activate' });
        } else {
          activated.push(adId);
        }
      } catch (e: any) {
        failed.push({ adId, error: e?.message || 'Unknown error' });
      }
    }

    return new Response(
      JSON.stringify({
        success: activated.length > 0,
        activated,
        failed,
        message:
          activated.length === adIds.length
            ? `Activated ${activated.length} ad${activated.length === 1 ? '' : 's'}.`
            : `Activated ${activated.length} of ${adIds.length} ads. ${failed[0]?.error || ''}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('activate-meta-ads error', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 200, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    );
  }
});
