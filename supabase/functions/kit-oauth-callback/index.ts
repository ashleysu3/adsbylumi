import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Determine redirect base from state or fallback
    let redirectBase = 'https://youradassistant.lovable.app';

    if (error) {
      console.error('[KIT-OAUTH-CALLBACK] OAuth error:', error);
      return Response.redirect(`${redirectBase}/settings?tab=integrations&kit=error`, 302);
    }

    if (!code || !stateParam) {
      console.error('[KIT-OAUTH-CALLBACK] Missing code or state');
      return Response.redirect(`${redirectBase}/settings?tab=integrations&kit=error`, 302);
    }

    let brandId: string;
    let userId: string;
    try {
      const state = JSON.parse(atob(stateParam));
      brandId = state.brandId;
      userId = state.userId;
    } catch {
      console.error('[KIT-OAUTH-CALLBACK] Invalid state');
      return Response.redirect(`${redirectBase}/settings?tab=integrations&kit=error`, 302);
    }

    const clientId = Deno.env.get('KIT_CLIENT_ID')!;
    const clientSecret = Deno.env.get('KIT_CLIENT_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const redirectUri = `${supabaseUrl}/functions/v1/kit-oauth-callback`;

    // Exchange code for token
    const tokenRes = await fetch('https://app.kit.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    console.log('[KIT-OAUTH-CALLBACK] Token response status:', tokenRes.status);

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[KIT-OAUTH-CALLBACK] Token exchange failed:', tokenData);
      return Response.redirect(`${redirectBase}/settings?tab=integrations&kit=error`, 302);
    }

    const { access_token, refresh_token } = tokenData;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify brand ownership
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, user_id, meta_pixel_id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (brandError || !brand) {
      console.error('[KIT-OAUTH-CALLBACK] Brand not found or not owned by user');
      return Response.redirect(`${redirectBase}/settings?tab=integrations&kit=error`, 302);
    }

    // Register webhook for form submissions
    let webhookId: string | null = null;
    try {
      const webhookUrl = `${supabaseUrl}/functions/v1/kit-webhook`;
      const webhookRes = await fetch('https://api.kit.com/v4/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`,
        },
        body: JSON.stringify({
          target_url: webhookUrl,
          event: { name: 'subscriber.form_subscribe' },
        }),
      });

      const webhookData = await webhookRes.json();
      console.log('[KIT-OAUTH-CALLBACK] Webhook creation response:', JSON.stringify(webhookData).slice(0, 500));

      if (webhookRes.ok && webhookData.webhook) {
        webhookId = String(webhookData.webhook.id || webhookData.webhook.rule?.id);
      } else {
        console.error('[KIT-OAUTH-CALLBACK] Webhook creation failed:', webhookData);
      }
    } catch (webhookErr) {
      console.error('[KIT-OAUTH-CALLBACK] Webhook registration error:', webhookErr);
    }

    // Store tokens in brands table
    const { error: updateError } = await supabase
      .from('brands')
      .update({
        kit_access_token: access_token,
        kit_refresh_token: refresh_token || null,
        kit_webhook_id: webhookId,
      })
      .eq('id', brandId);

    if (updateError) {
      console.error('[KIT-OAUTH-CALLBACK] Failed to store tokens:', updateError);
      return Response.redirect(`${redirectBase}/settings?tab=integrations&kit=error`, 302);
    }

    console.log(`[KIT-OAUTH-CALLBACK] Kit connected for brand ${brandId}`);
    return Response.redirect(`${redirectBase}/settings?tab=integrations&kit=success`, 302);

  } catch (error) {
    console.error('[KIT-OAUTH-CALLBACK] Error:', error);
    return Response.redirect('https://youradassistant.lovable.app/settings?tab=integrations&kit=error', 302);
  }
});
