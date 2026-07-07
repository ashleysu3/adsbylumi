import { createClient } from 'npm:@supabase/supabase-js@2';

// Public webhook endpoint — Kit signs each request with HMAC-SHA256 using a
// shared secret. Reject any request that doesn't carry a valid signature.

async function verifyKitSignature(secret: string, rawBody: string, headerSig: string | null): Promise<boolean> {
  if (!headerSig) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const provided = headerSig.replace(/^sha256=/i, '').trim().toLowerCase();
  if (expected.length !== provided.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const kitSecret = Deno.env.get('KIT_WEBHOOK_SECRET');
    if (!kitSecret) {
      console.error('[KIT-WEBHOOK] KIT_WEBHOOK_SECRET not configured — rejecting');
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        status: 503, headers: { 'Content-Type': 'application/json' },
      });
    }
    const signature = req.headers.get('X-Kit-Signature') || req.headers.get('x-kit-signature');
    const ok = await verifyKitSignature(kitSecret, rawBody, signature);
    if (!ok) {
      console.warn('[KIT-WEBHOOK] Invalid or missing signature — rejecting');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
    const payload = JSON.parse(rawBody);
    console.log('[KIT-WEBHOOK] Received event:', JSON.stringify(payload).slice(0, 500));

    // Kit V4 webhook payload structure
    const subscriberData = payload.subscriber || payload.data?.subscriber || payload;
    const email = subscriberData?.email_address || subscriberData?.email;

    if (!email) {
      console.log('[KIT-WEBHOOK] No email in payload');
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[KIT-WEBHOOK] Processing form submission for: ${email}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find all brands with Kit connected + Meta pixel configured
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('id, meta_pixel_id, meta_access_token, name')
      .not('kit_access_token', 'is', null)
      .not('meta_pixel_id', 'is', null)
      .not('meta_access_token', 'is', null);

    if (brandsError) {
      console.error('[KIT-WEBHOOK] Error fetching brands:', brandsError);
      return new Response(JSON.stringify({ received: true, error: 'DB error' }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!brands || brands.length === 0) {
      console.log('[KIT-WEBHOOK] No brands with Kit + Meta configured');
      return new Response(JSON.stringify({ received: true, noBrands: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[KIT-WEBHOOK] Sending Lead event to ${brands.length} brand(s)`);

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

        const firstName = subscriberData.first_name || subscriberData.fields?.first_name;
        const lastName = subscriberData.last_name || subscriberData.fields?.last_name;

        if (firstName) userData.fn = await hashValue(firstName);
        if (lastName) userData.ln = await hashValue(lastName);

        const eventPayload = {
          event_name: 'Lead',
          event_time: Math.floor(Date.now() / 1000),
          event_source_url: subscriberData.source || 'https://kit.com',
          action_source: 'website',
          user_data: userData,
          custom_data: {
            content_name: 'Kit Form Submission',
            content_category: 'lead_form',
          },
        };

        const capiUrl = `https://graph.facebook.com/v25.0/${brand.meta_pixel_id}/events?access_token=${brand.meta_access_token}`;
        const capiRes = await fetch(capiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: [eventPayload] }),
        });

        const capiData = await capiRes.json();

        if (capiRes.ok) {
          console.log(`[KIT-WEBHOOK] Lead event sent for brand ${brand.name}:`, capiData);
          results.push({ brandId: brand.id, brandName: brand.name, success: true });
        } else {
          console.error(`[KIT-WEBHOOK] CAPI error for brand ${brand.name}:`, capiData);
          results.push({ brandId: brand.id, brandName: brand.name, success: false, error: capiData.error?.message });
        }
      } catch (e) {
        console.error(`[KIT-WEBHOOK] Error processing brand ${brand.name}:`, e);
        results.push({ brandId: brand.id, brandName: brand.name, success: false, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ received: true, results }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[KIT-WEBHOOK] Error:', error);
    return new Response(JSON.stringify({ received: true, error: String(error) }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }
});
