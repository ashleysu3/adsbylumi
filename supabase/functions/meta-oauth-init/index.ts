const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId, redirectUri } = await req.json();
    
    if (!brandId) {
      throw new Error('Brand ID is required');
    }

    const META_APP_ID = Deno.env.get('META_APP_ID');
    if (!META_APP_ID) {
      throw new Error('META_APP_ID environment variable not set');
    }

    console.log('Initiating Meta OAuth for brand:', brandId);

    // Build Meta OAuth URL with all required permissions for ad creation
    const oauthUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    oauthUrl.searchParams.set('client_id', META_APP_ID);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('state', brandId);
    // Include pages and Instagram permissions required for ad creative creation
    oauthUrl.searchParams.set('scope', 'ads_management,ads_read,business_management,pages_read_engagement,pages_show_list,instagram_basic,instagram_manage_insights');
    oauthUrl.searchParams.set('response_type', 'code');

    console.log('OAuth URL generated with pages permissions');

    return new Response(
      JSON.stringify({ authUrl: oauthUrl.toString() }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in meta-oauth-init:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
