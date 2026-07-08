import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuthedUser } from '../_shared/check-subscription.ts';
import { metaErrorMessage } from '../_shared/meta-errors.ts';

// Creates a real Meta Pixel on the brand's ad account via the Graph API —
// the "I'm new to this" track's one-click setup. There's no manual step in
// Meta Business Manager: this is the same POST /act_X/adspixels call Meta's
// own UI makes when you click "Create a Pixel" there.
Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const gate = await requireAuthedUser(req, corsHeaders);
  if (gate.blocked) return gate.blocked;

  try {
    const { brandId } = await req.json();
    if (!brandId) {
      return new Response(JSON.stringify({ success: false, error: 'Brand ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('name, meta_account_id, meta_access_token, meta_pixel_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      return new Response(JSON.stringify({ success: false, error: 'Brand not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (brand.meta_pixel_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'This brand already has a pixel connected.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!brand.meta_account_id || !brand.meta_access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connect your Meta ad account first.', needsConnection: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adAccountId = brand.meta_account_id.startsWith('act_')
      ? brand.meta_account_id
      : `act_${brand.meta_account_id}`;

    const pixelName = `${brand.name || 'Lumi'} Pixel`;
    const createUrl = `https://graph.facebook.com/v25.0/${adAccountId}/adspixels`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pixelName, access_token: brand.meta_access_token }),
    });
    const createData = await createRes.json();

    if (!createRes.ok || !createData?.id) {
      console.error('create-meta-pixel: pixel creation failed', createData);
      return new Response(
        JSON.stringify({
          success: false,
          error: metaErrorMessage(createData?.error, "Meta wouldn't create a pixel on this ad account. Reconnect Meta and make sure you approved ad-account access."),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pixelId = createData.id as string;

    const { error: updateError } = await supabase
      .from('brands')
      .update({
        meta_pixel_id: pixelId,
        meta_pixel_name: pixelName,
        meta_pixel_events: {},
        meta_pixel_verified_at: null, // not verified yet — no snippet installed
      })
      .eq('id', brandId);

    if (updateError) {
      console.error('create-meta-pixel: failed to save pixel to brand', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        pixel: { id: pixelId, name: pixelName, events: {} },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-meta-pixel:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
