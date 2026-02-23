import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { brandId, workspaceId, confirmationUrl, eventType } = await req.json();

    if (!brandId || !workspaceId || !confirmationUrl || !eventType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: brandId, workspaceId, confirmationUrl, eventType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['LEAD', 'PURCHASE'].includes(eventType)) {
      return new Response(
        JSON.stringify({ error: 'eventType must be LEAD or PURCHASE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch brand + verify ownership
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, user_id, meta_account_id, meta_access_token')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (brand.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!brand.meta_account_id) {
      return new Response(
        JSON.stringify({ error: 'Meta ad account not connected. Please connect your Meta account first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get access token
    const metaAccessToken = brand.meta_access_token;
    if (!metaAccessToken) {
      return new Response(
        JSON.stringify({ error: 'Meta access token not found. Please reconnect your Meta account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountId = brand.meta_account_id.replace('act_', '');

    // 4. Get pixel ID from ad account
    console.log('Fetching pixel for account:', accountId);
    const pixelResponse = await fetch(
      `https://graph.facebook.com/v18.0/act_${accountId}/adspixels?fields=id,name&access_token=${metaAccessToken}`
    );
    const pixelData = await pixelResponse.json();

    if (!pixelData.data || pixelData.data.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No Meta Pixel found on your ad account. Please set up a pixel first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pixelId = pixelData.data[0].id;
    console.log('Found pixel:', pixelId);

    // 5. Extract URL path for the rule
    let urlPath: string;
    try {
      const url = new URL(confirmationUrl.startsWith('http') ? confirmationUrl : `https://${confirmationUrl}`);
      urlPath = url.pathname + url.search;
      if (urlPath === '/') {
        // Use the full hostname + path for root URLs
        urlPath = url.hostname;
      }
    } catch {
      urlPath = confirmationUrl;
    }

    const conversionName = `LUMI // ${eventType} - ${urlPath}`;
    const rule = JSON.stringify({ url: { i_contains: urlPath } });

    console.log('Creating custom conversion:', conversionName);
    console.log('Rule:', rule);

    // 6. Create Custom Conversion via Meta API
    const ccResponse = await fetch(
      `https://graph.facebook.com/v18.0/act_${accountId}/customconversions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          name: conversionName,
          event_type: eventType,
          pixel_id: pixelId,
          rule: rule,
          access_token: metaAccessToken,
        }),
      }
    );

    const ccData = await ccResponse.json();

    if (ccData.error) {
      console.error('Meta API error creating custom conversion:', ccData.error);
      return new Response(
        JSON.stringify({ error: `Meta API error: ${ccData.error.message || 'Unknown error'}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customConversionId = ccData.id;
    console.log('Custom conversion created:', customConversionId);

    // 7. Save to workspace + mark tracking verified
    const { error: updateError } = await supabase
      .from('campaign_workspaces')
      .update({
        custom_conversion_id: customConversionId,
        tracking_verified: true,
      })
      .eq('id', workspaceId);

    if (updateError) {
      console.error('Failed to update workspace:', updateError);
      // Don't fail — the custom conversion was created successfully
    }

    return new Response(
      JSON.stringify({
        success: true,
        customConversionId,
        name: conversionName,
        urlPath,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error in create-custom-conversion:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
