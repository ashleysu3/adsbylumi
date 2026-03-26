import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

type FlodeskAuthMode = 'basic' | 'bearer';

const FLODESK_USER_AGENT = 'LUMI (youradassistant.lovable.app)';

function buildFlodeskHeaders(token: string, mode: FlodeskAuthMode): HeadersInit {
  const authorization = mode === 'basic'
    ? `Basic ${btoa(`${token}:`)}`
    : `Bearer ${token}`;

  return {
    'Authorization': authorization,
    'Content-Type': 'application/json',
    'User-Agent': FLODESK_USER_AGENT,
  };
}

async function deleteFlodeskWebhook(webhookId: string, token: string): Promise<void> {
  for (const mode of ['basic', 'bearer'] as const) {
    try {
      const res = await fetch(`https://api.flodesk.com/v1/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: buildFlodeskHeaders(token, mode),
      });

      // Treat not found as already deleted
      if (res.ok || res.status === 404) return;
    } catch {
      // Try next auth mode
    }
  }
}

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userId = user.id;

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
        try {
          await deleteFlodeskWebhook(brand.flodesk_webhook_id, brand.flodesk_api_key);
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

    // Validate credentials (support both API key Basic auth and OAuth Bearer tokens)
    let authMode: FlodeskAuthMode | null = null;
    let flodeskHeaders: HeadersInit | null = null;
    let validationError = 'Failed to validate Flodesk credentials.';

    for (const mode of ['basic', 'bearer'] as const) {
      try {
        const headers = buildFlodeskHeaders(apiKey, mode);
        const validateRes = await fetch('https://api.flodesk.com/v1/subscribers?per_page=1', { headers });

        if (validateRes.ok) {
          authMode = mode;
          flodeskHeaders = headers;
          break;
        }

        const errText = await validateRes.text();
        validationError = `${mode} auth failed (${validateRes.status}): ${errText}`;
      } catch (error) {
        validationError = `${mode} auth request failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    if (!authMode || !flodeskHeaders) {
      console.error('[FLODESK-CONNECT] Credential validation failed:', validationError);
      return new Response(JSON.stringify({ error: `Invalid Flodesk credentials. ${validationError}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[FLODESK-CONNECT] Flodesk auth validated via mode:', authMode);

    // Register webhook for subscriber.created events
    const webhookUrl = `${supabaseUrl}/functions/v1/flodesk-webhook`;
    
    // Delete old webhook if one exists
    if (brand.flodesk_webhook_id) {
      try {
        await deleteFlodeskWebhook(brand.flodesk_webhook_id, apiKey);
      } catch (e) {
        console.log('[FLODESK-CONNECT] Failed to delete old webhook:', e);
      }
    }

    const webhookBodies = [
      { name: 'LUMI Lead Events', post_url: webhookUrl, events: ['subscriber.created'] },
      { name: 'LUMI Lead Events', PostUrl: webhookUrl, events: ['subscriber.created'] },
      { name: 'LUMI Lead Events', url: webhookUrl, events: ['subscriber.created'] },
    ];

    let webhookId: string | null = null;
    let lastWebhookError = 'Unknown webhook registration error';

    for (const body of webhookBodies) {
      const webhookRes = await fetch('https://api.flodesk.com/v1/webhooks', {
        method: 'POST',
        headers: flodeskHeaders,
        body: JSON.stringify(body),
      });

      if (webhookRes.ok) {
        const webhookData = await webhookRes.json();
        const candidateId = webhookData?.id || webhookData?.data?.id || webhookData?.webhook?.id;

        if (candidateId) {
          webhookId = candidateId;
          console.log('[FLODESK-CONNECT] Webhook registered:', webhookId, 'payloadKeys=', Object.keys(body));
          break;
        }

        lastWebhookError = `Webhook created but no ID returned. Response: ${JSON.stringify(webhookData)}`;
        console.error('[FLODESK-CONNECT] Webhook registration returned no id:', webhookData);
        continue;
      }

      const errText = await webhookRes.text();
      lastWebhookError = `${webhookRes.status} - ${errText}`;
      console.error('[FLODESK-CONNECT] Webhook registration attempt failed:', lastWebhookError, 'payloadKeys=', Object.keys(body));
    }

    // Fallback: if create calls fail due duplicates or malformed response, reuse existing webhook by URL
    if (!webhookId) {
      try {
        const listRes = await fetch('https://api.flodesk.com/v1/webhooks?per_page=100', {
          method: 'GET',
          headers: flodeskHeaders,
        });

        if (listRes.ok) {
          const listData = await listRes.json();
          const hooks = Array.isArray(listData?.data) ? listData.data : [];
          const existing = hooks.find((hook: any) => {
            const hookUrl = hook?.post_url || hook?.PostUrl || hook?.url;
            const events = Array.isArray(hook?.events) ? hook.events : [];
            return hookUrl === webhookUrl && events.includes('subscriber.created');
          });

          if (existing?.id) {
            webhookId = existing.id;
            console.log('[FLODESK-CONNECT] Reusing existing webhook id:', webhookId);
          }
        } else {
          const errText = await listRes.text();
          lastWebhookError = `${lastWebhookError} | list webhooks failed: ${listRes.status} - ${errText}`;
        }
      } catch (error) {
        lastWebhookError = `${lastWebhookError} | list webhooks error: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    if (!webhookId) {
      return new Response(JSON.stringify({
        error: `Flodesk connected, but webhook registration failed: ${lastWebhookError}`,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store API key and webhook ID using service role
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error: updateError } = await serviceClient.from('brands').update({
      flodesk_api_key: apiKey,
      flodesk_webhook_id: webhookId,
    }).eq('id', brandId);

    if (updateError) {
      console.error('[FLODESK-CONNECT] Failed saving Flodesk credentials:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to save Flodesk connection' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      webhookRegistered: true,
      message: 'Flodesk connected and webhook registered! Form submissions will now send Lead events to Meta.',
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
