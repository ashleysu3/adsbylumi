import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userId = claims.claims.sub as string;

    const { brandId, apiKey, action } = await req.json();

    if (!brandId) {
      return new Response(JSON.stringify({ error: 'brandId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify brand ownership
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, user_id, flodesk_api_key, flodesk_webhook_id, meta_pixel_id, meta_access_token')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (brandError || !brand) {
      return new Response(JSON.stringify({ error: 'Brand not found or access denied' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // DISCONNECT
    if (action === 'disconnect') {
      // Delete existing webhook from Flodesk if we have one
      if (brand.flodesk_webhook_id && brand.flodesk_api_key) {
        const flodeskAuth = btoa(`${brand.flodesk_api_key}:`);
        try {
          await fetch(`https://api.flodesk.com/v1/webhooks/${brand.flodesk_webhook_id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Basic ${flodeskAuth}`,
              'Content-Type': 'application/json',
            },
          });
        } catch (e) {
          console.log('[FLODESK-CONNECT] Failed to delete webhook, continuing disconnect:', e);
        }
      }

      const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await serviceClient.from('brands').update({
        flodesk_api_key: null,
        flodesk_webhook_id: null,
      }).eq('id', brandId);

      return new Response(JSON.stringify({ success: true, message: 'Flodesk disconnected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // CONNECT
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'apiKey is required for connect' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate the API key by fetching subscribers
    const flodeskAuth = btoa(`${apiKey}:`);
    const validateRes = await fetch('https://api.flodesk.com/v1/subscribers?per_page=1', {
      headers: {
        'Authorization': `Basic ${flodeskAuth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!validateRes.ok) {
      const errText = await validateRes.text();
      console.error('[FLODESK-CONNECT] API key validation failed:', validateRes.status, errText);
      return new Response(JSON.stringify({ error: 'Invalid Flodesk API key' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Register webhook for subscriber.created events
    const webhookUrl = `${supabaseUrl}/functions/v1/flodesk-webhook`;
    
    // Delete old webhook if one exists
    if (brand.flodesk_webhook_id) {
      try {
        await fetch(`https://api.flodesk.com/v1/webhooks/${brand.flodesk_webhook_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${flodeskAuth}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (e) {
        console.log('[FLODESK-CONNECT] Failed to delete old webhook:', e);
      }
    }

    const webhookRes = await fetch('https://api.flodesk.com/v1/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${flodeskAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        events: ['subscriber.created'],
      }),
    });

    let webhookId: string | null = null;
    if (webhookRes.ok) {
      const webhookData = await webhookRes.json();
      webhookId = webhookData.id;
      console.log('[FLODESK-CONNECT] Webhook registered:', webhookId);
    } else {
      const errText = await webhookRes.text();
      console.error('[FLODESK-CONNECT] Webhook registration failed:', webhookRes.status, errText);
      // Still connect even if webhook fails - user can retry
    }

    // Store API key and webhook ID using service role
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await serviceClient.from('brands').update({
      flodesk_api_key: apiKey,
      flodesk_webhook_id: webhookId,
    }).eq('id', brandId);

    return new Response(JSON.stringify({
      success: true,
      webhookRegistered: !!webhookId,
      message: webhookId
        ? 'Flodesk connected and webhook registered! Form submissions will now send Lead events to Meta.'
        : 'Flodesk connected but webhook registration failed. You can retry from settings.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[FLODESK-CONNECT] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
    });
  }
});
