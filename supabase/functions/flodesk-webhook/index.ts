import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// This is a public webhook endpoint — no JWT required.
// Flodesk sends POST requests here when subscribers are created (form submissions).
//
// Scoped to ONE brand via a `brandId` query param on the callback URL
// (flodesk-connect registers a unique URL per brand). Every brand gets its
// own callback, so this only ever needs to look up and notify the one
// brand whose Flodesk account actually fired the event — previously this
// queried every brand with Flodesk + Meta connected and sent the Lead
// event to all of them, which meant one brand's real lead polluted every
// other connected brand's Meta pixel with a fake conversion.
//
// Sends via the shared send-conversion-event function instead of
// reimplementing Meta CAPI hashing/payload-building here.

Deno.serve(async (req) => {
  const jsonHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: jsonHeaders });
  }

  // Keep endpoint health-check friendly for webhook URL validation.
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: true, method: req.method }), {
      status: 200,
      headers: jsonHeaders,
    });
  }

  const url = new URL(req.url);
  const brandId = url.searchParams.get('brandId');

  try {
    const payload = await req.json();
    console.log('[FLODESK-WEBHOOK] Received event:', JSON.stringify(payload).slice(0, 500));

    const event = payload.event || payload.type;
    const subscriberData = payload.data || payload.subscriber || payload;

    if (!event || !subscriberData) {
      console.log('[FLODESK-WEBHOOK] No event or data in payload, acknowledging');
      return new Response(JSON.stringify({ received: true }), {
        status: 200, headers: jsonHeaders
      });
    }

    // Only process subscriber.created events (form submissions)
    if (event !== 'subscriber.created') {
      console.log(`[FLODESK-WEBHOOK] Ignoring event type: ${event}`);
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200, headers: jsonHeaders
      });
    }

    const email = subscriberData.email;
    if (!email) {
      console.log('[FLODESK-WEBHOOK] No email in subscriber data');
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200, headers: jsonHeaders
      });
    }

    if (!brandId) {
      // Webhooks registered before this fix shipped still point at the old,
      // unscoped URL until that brand disconnects and reconnects Flodesk.
      // Skip rather than fall back to broadcasting — that's the exact bug
      // this fix removes.
      console.error('[FLODESK-WEBHOOK] Missing brandId on callback URL — this Flodesk connection needs to be reconnected to pick up the per-brand fix. Skipping to avoid cross-brand contamination.');
      return new Response(JSON.stringify({ received: true, skipped: true, reason: 'missing_brand_scope' }), {
        status: 200, headers: jsonHeaders
      });
    }

    console.log(`[FLODESK-WEBHOOK] Processing form submission for brand ${brandId}: ${email}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, meta_pixel_id, meta_access_token')
      .eq('id', brandId)
      .maybeSingle();

    if (brandError || !brand) {
      console.error('[FLODESK-WEBHOOK] Brand not found:', brandId, brandError);
      return new Response(JSON.stringify({ received: true, skipped: true, reason: 'brand_not_found' }), {
        status: 200, headers: jsonHeaders
      });
    }

    if (!brand.meta_pixel_id || !brand.meta_access_token) {
      console.log(`[FLODESK-WEBHOOK] Brand ${brand.name} has no Meta pixel/token configured yet, skipping`);
      return new Response(JSON.stringify({ received: true, skipped: true, reason: 'no_meta_configured' }), {
        status: 200, headers: jsonHeaders
      });
    }

    const capiRes = await fetch(`${supabaseUrl}/functions/v1/send-conversion-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        brandId: brand.id,
        event: {
          eventName: 'Lead',
          eventSourceUrl: subscriberData.source_url || 'https://flodesk.com',
          userData: {
            email,
            firstName: subscriberData.first_name,
            lastName: subscriberData.last_name,
          },
          customData: {
            contentName: 'Flodesk Form Submission',
            contentCategory: 'lead_form',
          },
          actionSource: 'website',
        },
      }),
    });
    const capiData = await capiRes.json();

    if (capiRes.ok && capiData?.success) {
      console.log(`[FLODESK-WEBHOOK] Lead event sent for brand ${brand.name}:`, capiData);
    } else {
      console.error(`[FLODESK-WEBHOOK] CAPI error for brand ${brand.name}:`, capiData);
    }

    return new Response(JSON.stringify({ received: true, result: capiData }), {
      status: 200, headers: jsonHeaders
    });

  } catch (error) {
    console.error('[FLODESK-WEBHOOK] Error:', error);
    // Always return 200 to Flodesk so it doesn't retry indefinitely
    return new Response(JSON.stringify({ received: true, error: String(error) }), {
      status: 200, headers: jsonHeaders
    });
  }
});
