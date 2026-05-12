import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TokenCheckResult {
  brandId: string;
  brandName: string;
  userId: string;
  status: 'valid' | 'expiring' | 'expired' | 'invalid';
  daysUntilExpiry?: number;
  alertCreated: boolean;
  emailSent: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[VERIFY-META-TOKENS] Starting daily token verification job');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    // Fetch all brands with Meta connected (include meta_access_token for direct verification)
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('id, name, user_id, meta_account_id, meta_token_expires_at, meta_access_token')
      .not('meta_account_id', 'is', null);

    if (brandsError) {
      console.error('[VERIFY-META-TOKENS] Error fetching brands:', brandsError);
      throw brandsError;
    }

    console.log(`[VERIFY-META-TOKENS] Found ${brands?.length || 0} brands with Meta connected`);

    const results: TokenCheckResult[] = [];
    const now = new Date();

    for (const brand of brands || []) {
      const result: TokenCheckResult = {
        brandId: brand.id,
        brandName: brand.name,
        userId: brand.user_id,
        status: 'valid',
        alertCreated: false,
        emailSent: false,
      };

      try {
        // Check token expiration
        if (brand.meta_token_expires_at) {
          const expiresAt = new Date(brand.meta_token_expires_at);
          const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          result.daysUntilExpiry = daysUntilExpiry;

          if (daysUntilExpiry <= 0) {
            result.status = 'expired';
          } else if (daysUntilExpiry <= 7) {
            result.status = 'expiring';
          }
        }

        // If token might be problematic, verify with Meta API
        if (result.status !== 'valid' || !brand.meta_token_expires_at) {
          const tokenValid = await verifyTokenWithMeta(supabase, brand.id, brand.meta_access_token);
          if (!tokenValid) {
            result.status = 'invalid';
          }
        }

        // Create in-app alert if needed
        if (result.status !== 'valid') {
          result.alertCreated = await createAlert(supabase, brand, result.status, result.daysUntilExpiry);
        }

        // Send email for expiring/expired/invalid tokens
        if (result.status !== 'valid' && RESEND_API_KEY) {
          result.emailSent = await sendAlertEmail(
            supabase,
            brand,
            result.status,
            result.daysUntilExpiry,
            RESEND_API_KEY
          );
        }

        // Attempt auto-refresh for expiring tokens
        if (result.status === 'expiring' && META_APP_ID && META_APP_SECRET) {
          const refreshed = await attemptTokenRefresh(
            supabase,
            brand.id,
            META_APP_ID,
            META_APP_SECRET
          );
          if (refreshed) {
            console.log(`[VERIFY-META-TOKENS] Successfully refreshed token for brand ${brand.id}`);
            // Clear the alert if refresh succeeded
            await supabase
              .from('user_alerts')
              .update({ dismissed_at: now.toISOString() })
              .eq('brand_id', brand.id)
              .eq('type', 'meta_token_expiring')
              .is('dismissed_at', null);
          }
        }

      } catch (err: any) {
        console.error(`[VERIFY-META-TOKENS] Error processing brand ${brand.id}:`, err);
        result.error = err.message;
      }

      results.push(result);
    }

    // Summary
    const summary = {
      total: results.length,
      valid: results.filter(r => r.status === 'valid').length,
      expiring: results.filter(r => r.status === 'expiring').length,
      expired: results.filter(r => r.status === 'expired').length,
      invalid: results.filter(r => r.status === 'invalid').length,
      alertsCreated: results.filter(r => r.alertCreated).length,
      emailsSent: results.filter(r => r.emailSent).length,
    };

    console.log('[VERIFY-META-TOKENS] Verification complete:', summary);

    // Send Slack alert for expired/invalid tokens
    if (summary.expired > 0 || summary.invalid > 0) {
      const problematic = results.filter(r => r.status === 'expired' || r.status === 'invalid');
      const brandList = problematic.map(r => `• *${r.brandName}*: ${r.status}`).join('\n');
      try {
        await fetch(`${supabaseUrl}/functions/v1/slack-error-alert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            category: 'Meta API',
            severity: 'security',
            title: `Meta Token Issues: ${summary.expired} expired, ${summary.invalid} invalid`,
            message: `Token verification found issues:\n${brandList}`,
            source: 'verify-meta-tokens',
          }),
        });
      } catch (slackErr) { console.error('Slack alert failed:', slackErr); }
    }

    return new Response(
      JSON.stringify({ success: true, summary, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[VERIFY-META-TOKENS] Fatal error:', error);
    // Fire-and-forget Slack alert for fatal errors
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/slack-error-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          category: 'System',
          severity: 'critical',
          title: 'Meta Token Verification Failed',
          message: `Fatal error in verify-meta-tokens: ${error.message}`,
          source: 'verify-meta-tokens',
        }),
      });
    } catch { /* ignore */ }
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function verifyTokenWithMeta(supabase: any, brandId: string, tokenFromBrand?: string | null): Promise<boolean> {
  try {
    // NOTE: get_meta_token RPC fails with "permission denied for function _crypto_aead_det_noncegen".
    // Read token directly from brands table instead (matching pattern in test-meta-connection,
    // sync-meta-campaigns, and refresh-meta-token).
    let token = tokenFromBrand;

    if (!token) {
      const { data: brand, error } = await supabase
        .from('brands')
        .select('meta_access_token')
        .eq('id', brandId)
        .single();

      if (error || !brand?.meta_access_token) {
        console.log(`[VERIFY-META-TOKENS] No token found for brand ${brandId}`);
        return false;
      }
      token = brand.meta_access_token;
    }

    // Make a simple API call to verify the token
    const response = await fetch(`https://graph.facebook.com/v25.0/me?access_token=${token}`);
    const data = await response.json();

    if (data.error) {
      console.log(`[VERIFY-META-TOKENS] Token invalid for brand ${brandId}:`, data.error);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[VERIFY-META-TOKENS] Error verifying token for brand ${brandId}:`, err);
    return false;
  }
}

async function createAlert(
  supabase: any,
  brand: any,
  status: string,
  daysUntilExpiry?: number
): Promise<boolean> {
  try {
    const alertType = status === 'expiring' ? 'meta_token_expiring' : 
                      status === 'expired' ? 'meta_token_expired' : 'meta_token_invalid';
    
    // Check if alert already exists
    const { data: existingAlert } = await supabase
      .from('user_alerts')
      .select('id')
      .eq('brand_id', brand.id)
      .eq('type', alertType)
      .is('dismissed_at', null)
      .single();

    if (existingAlert) {
      console.log(`[VERIFY-META-TOKENS] Alert already exists for brand ${brand.id}, type ${alertType}`);
      return false;
    }

    let title: string;
    let message: string;
    let severity: string;

    if (status === 'expiring') {
      title = 'Meta Connection Expiring Soon';
      message = `Your Meta connection for ${brand.name} will expire in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}. Reconnect to avoid data sync interruptions.`;
      severity = 'warning';
    } else if (status === 'expired') {
      title = 'Meta Connection Expired';
      message = `Your Meta connection for ${brand.name} has expired. Reconnect now to resume campaign data syncing.`;
      severity = 'error';
    } else {
      title = 'Meta Connection Issue';
      message = `There's a problem with your Meta connection for ${brand.name}. Please reconnect your account.`;
      severity = 'error';
    }

    const { error } = await supabase
      .from('user_alerts')
      .insert({
        user_id: brand.user_id,
        brand_id: brand.id,
        type: alertType,
        severity,
        title,
        message,
        action_url: '/meta-settings',
        action_label: 'Reconnect Meta',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      });

    if (error) {
      console.error(`[VERIFY-META-TOKENS] Error creating alert for brand ${brand.id}:`, error);
      return false;
    }

    console.log(`[VERIFY-META-TOKENS] Created ${alertType} alert for brand ${brand.id}`);
    return true;
  } catch (err) {
    console.error(`[VERIFY-META-TOKENS] Error in createAlert:`, err);
    return false;
  }
}

async function sendAlertEmail(
  supabase: any,
  brand: any,
  status: string,
  daysUntilExpiry: number | undefined,
  resendApiKey: string
): Promise<boolean> {
  try {
    // Get user email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', brand.user_id)
      .single();

    if (profileError || !profile?.email) {
      console.error('[VERIFY-META-TOKENS] Could not get user email:', profileError);
      return false;
    }

    const resend = new Resend(resendApiKey);
    const userName = profile.full_name || 'there';
    const brandName = brand.name || 'your brand';
    const appUrl = 'https://adsbylumi.com';

    let subject: string;
    let urgencyText: string;
    let urgencyColor: string;

    if (status === 'expiring') {
      subject = `⚠️ Action Needed: Meta connection expiring in ${daysUntilExpiry} days`;
      urgencyText = `Your connection will expire in <strong>${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}</strong>.`;
      urgencyColor = '#ffc107';
    } else if (status === 'expired') {
      subject = `🚨 Urgent: Meta connection expired for ${brandName}`;
      urgencyText = 'Your connection has <strong>already expired</strong>.';
      urgencyColor = '#dc3545';
    } else {
      subject = `🚨 Action Required: Meta connection issue for ${brandName}`;
      urgencyText = 'We detected an <strong>issue with your Meta connection</strong>.';
      urgencyColor = '#dc3545';
    }

    const { error: emailError } = await resend.emails.send({
      from: 'Lumi <notifications@adsbylumi.com>',
      to: [profile.email],
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Meta Connection Alert</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; margin-top: 0;">Hi ${userName},</p>
            
            <div style="background: ${urgencyColor}20; border-left: 4px solid ${urgencyColor}; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; font-size: 15px;">${urgencyText}</p>
            </div>
            
            <p>This affects <strong>${brandName}</strong> and may impact:</p>
            <ul style="color: #666;">
              <li>Campaign performance syncing</li>
              <li>Weekly performance reports</li>
              <li>Publishing new campaigns</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/meta-settings" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; display: inline-block;">
                Reconnect Now
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Reconnecting only takes about 30 seconds and keeps your data flowing smoothly.</p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; margin-bottom: 0;">
              This is an automated alert from Your Ad Assistant. 
              You can manage notification preferences in your Settings.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error('[VERIFY-META-TOKENS] Failed to send email:', emailError);
      return false;
    }

    console.log(`[VERIFY-META-TOKENS] Alert email sent to ${profile.email}`);
    return true;
  } catch (err) {
    console.error('[VERIFY-META-TOKENS] Error sending email:', err);
    return false;
  }
}

async function attemptTokenRefresh(
  supabase: any,
  brandId: string,
  appId: string,
  appSecret: string
): Promise<boolean> {
  try {
    // NOTE: get_meta_token RPC fails with crypto permissions error.
    // Read token directly from brands table instead.
    const { data: brand, error: tokenError } = await supabase
      .from('brands')
      .select('meta_access_token')
      .eq('id', brandId)
      .single();

    if (tokenError || !brand?.meta_access_token) {
      console.log(`[VERIFY-META-TOKENS] No token found for refresh, brand ${brandId}`);
      return false;
    }

    const currentToken = brand.meta_access_token;

    const refreshUrl = new URL('https://graph.facebook.com/v25.0/oauth/access_token');
    refreshUrl.searchParams.set('grant_type', 'fb_exchange_token');
    refreshUrl.searchParams.set('client_id', appId);
    refreshUrl.searchParams.set('client_secret', appSecret);
    refreshUrl.searchParams.set('fb_exchange_token', currentToken);

    const response = await fetch(refreshUrl.toString());
    const data = await response.json();

    if (!response.ok || !data.access_token) {
      return false;
    }

    // Store new token in vault (best-effort) and in brands table (primary)
    try {
      await supabase.rpc('store_meta_token', {
        p_brand_id: brandId,
        p_token: data.access_token
      });
    } catch (vaultErr) {
      console.warn('[VERIFY-META-TOKENS] Vault store failed (non-fatal):', vaultErr);
    }

    // Update token and expiration in brands table
    const expiresInSeconds = data.expires_in || 5184000;
    const newExpiresAt = new Date();
    newExpiresAt.setSeconds(newExpiresAt.getSeconds() + expiresInSeconds);

    await supabase
      .from('brands')
      .update({
        meta_access_token: data.access_token,
        meta_token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', brandId);

    return true;
  } catch (err) {
    console.error('[VERIFY-META-TOKENS] Token refresh failed:', err);
    return false;
  }
}
