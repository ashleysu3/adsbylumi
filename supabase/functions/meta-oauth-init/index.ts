import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId, redirectUri } = await req.json();

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
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
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
    const oauthUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    oauthUrl.searchParams.set('client_id', META_APP_ID);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('state', brandId);
    oauthUrl.searchParams.set(
      'scope',
      'ads_management,ads_read,business_management,pages_read_engagement,pages_show_list'
    );
    // Force Meta to re-request previously declined scopes on reconnect.
    oauthUrl.searchParams.set('auth_type', 'rerequest');
    oauthUrl.searchParams.set('response_type', 'code');

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
