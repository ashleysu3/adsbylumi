import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// This is a public webhook endpoint — no JWT required.
// Flodesk sends POST requests here when subscribers are created (form submissions).

Deno.serve(async (req) => {
  // Flodesk only sends POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log('[FLODESK-WEBHOOK] Received event:', JSON.stringify(payload).slice(0, 500));

    const event = payload.event || payload.type;
    const subscriberData = payload.data || payload.subscriber || payload;

    if (!event || !subscriberData) {
      console.log('[FLODESK-WEBHOOK] No event or data in payload, acknowledging');
      return new Response(JSON.stringify({ received: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Only process subscriber.created events (form submissions)
    if (event !== 'subscriber.created') {
      console.log(`[FLODESK-WEBHOOK] Ignoring event type: ${event}`);
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    const email = subscriberData.email;
    if (!email) {
      console.log('[FLODESK-WEBHOOK] No email in subscriber data');
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[FLODESK-WEBHOOK] Processing form submission for: ${email}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find all brands that have Flodesk connected (have an API key)
    // and also have Meta pixel + access token configured
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('id, meta_pixel_id, meta_access_token, name')
      .not('flodesk_api_key', 'is', null)
      .not('meta_pixel_id', 'is', null)
      .not('meta_access_token', 'is', null);

    if (brandsError) {
      console.error('[FLODESK-WEBHOOK] Error fetching brands:', brandsError);
      return new Response(JSON.stringify({ received: true, error: 'DB error' }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!brands || brands.length === 0) {
      console.log('[FLODESK-WEBHOOK] No brands with Flodesk + Meta configured');
      return new Response(JSON.stringify({ received: true, noBrands: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[FLODESK-WEBHOOK] Sending Lead event to ${brands.length} brand(s)`);

    // Hash function for Meta CAPI
    async function hashValue(value: string): Promise<string> {
      if (!value) return '';
      const encoder = new TextEncoder();
      const data = encoder.encode(value.toLowerCase().trim());
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const results: Array<{ brandId: string; brandName: string; success: boolean; error?: string }> = [];

    for (const brand of brands) {
      try {
        const hashedEmail = await hashValue(email);
        const userData: Record<string, string> = { em: hashedEmail };

        if (subscriberData.first_name) {
          userData.fn = await hashValue(subscriberData.first_name);
        }
        if (subscriberData.last_name) {
          userData.ln = await hashValue(subscriberData.last_name);
        }

        const eventPayload = {
          event_name: 'Lead',
          event_time: Math.floor(Date.now() / 1000),
          event_source_url: subscriberData.source_url || 'https://flodesk.com',
          action_source: 'website',
          user_data: userData,
          custom_data: {
            content_name: 'Flodesk Form Submission',
            content_category: 'lead_form',
          },
        };

        const capiUrl = `https://graph.facebook.com/v21.0/${brand.meta_pixel_id}/events?access_token=${brand.meta_access_token}`;
        const capiRes = await fetch(capiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: [eventPayload] }),
        });

        const capiData = await capiRes.json();

        if (capiRes.ok) {
          console.log(`[FLODESK-WEBHOOK] Lead event sent for brand ${brand.name}:`, capiData);
          results.push({ brandId: brand.id, brandName: brand.name, success: true });
        } else {
          console.error(`[FLODESK-WEBHOOK] CAPI error for brand ${brand.name}:`, capiData);
          results.push({ brandId: brand.id, brandName: brand.name, success: false, error: capiData.error?.message });
        }
      } catch (e) {
        console.error(`[FLODESK-WEBHOOK] Error processing brand ${brand.name}:`, e);
        results.push({ brandId: brand.id, brandName: brand.name, success: false, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ received: true, results }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[FLODESK-WEBHOOK] Error:', error);
    // Always return 200 to Flodesk so it doesn't retry indefinitely
    return new Response(JSON.stringify({ received: true, error: String(error) }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }
});
