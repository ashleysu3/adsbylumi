import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId, redirectUri, forceAssetSelection } = await req.json();

    if (!brandId) {
      return new Response(JSON.stringify({ error: 'Brand ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!redirectUri) {
      return new Response(JSON.stringify({ error: 'redirectUri is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const META_APP_ID = Deno.env.get('META_APP_ID');
    if (!META_APP_ID) {
      throw new Error('META_APP_ID environment variable not set');
    }

    // ---- Auth + ownership guard (prevents 403 loop later) ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace('Bearer ', '');

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error('[meta-oauth-init] auth failed:', authError?.message);
      return new Response(JSON.stringify({ error: 'Your session expired. Refresh the page and sign in again before connecting Meta.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('user_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      console.error('[meta-oauth-init] brand not found:', brandId);
      return new Response(JSON.stringify({ error: 'Brand not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    if (brand.user_id !== user.id) {
      console.error('[meta-oauth-init] access denied:', { userId: user.id, brandId });
      return new Response(JSON.stringify({ error: 'Access denied: You do not own this brand' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    console.log('[meta-oauth-init] Initiating Meta OAuth for brand:', brandId);

    // Build Meta OAuth URL with all required permissions for ad creation
    const oauthUrl = new URL('https://www.facebook.com/v25.0/dialog/oauth');
    oauthUrl.searchParams.set('client_id', META_APP_ID);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('state', brandId);

    // META_LOGIN_CONFIG_ID (Facebook Login for Business "Configuration ID") —
    // live and verified 2026-07-09. With it set, the asset picker (which ad
    // account / Page / Instagram account to share) lives in Meta's OWN
    // consent screen instead of LUMI building its own follow-up picker
    // screens afterward — Graph API calls in meta-oauth-callback naturally
    // return only the granted assets once the token itself is scoped, no
    // rewrite needed there. Falls back to the old scope-based dialog only if
    // this secret is ever unset (e.g. an emergency rollback). See
    // [[project_lumi_meta_business_login_migration]] for the full history.
    const loginConfigId = Deno.env.get('META_LOGIN_CONFIG_ID');
    if (loginConfigId) {
      oauthUrl.searchParams.set('config_id', loginConfigId);
    } else {
      oauthUrl.searchParams.set(
        'scope',
        'ads_management,ads_read,business_management,pages_read_engagement,pages_show_list,instagram_basic'
      );
    }
    // Force Meta's asset-selection / permission re-grant flow on every connect.
    // `rerequest` re-prompts previously-declined scopes (e.g. instagram_basic).
    // `reauthorize` forces Meta to show the asset-selection panel again instead
    // of silently re-establishing the previous selection — the "Edit settings"
    // path. We use `reauthorize` whenever the client asks for it (reconnect or
    // a known missing scope/asset), and `rerequest` otherwise.
    oauthUrl.searchParams.set('auth_type', forceAssetSelection ? 'reauthorize' : 'rerequest');
    oauthUrl.searchParams.set('response_type', 'code');
    // `display=page` opens the full asset-picker UI rather than the compact
    // "use previous settings" popup variant.
    oauthUrl.searchParams.set('display', 'page');


    return new Response(JSON.stringify({ authUrl: oauthUrl.toString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error in meta-oauth-init:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
