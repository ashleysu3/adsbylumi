import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!META_APP_ID || !META_APP_SECRET) {
      throw new Error('Meta credentials not configured');
    }

    // Get brandId from request body (for manual refresh) or process all expiring tokens
    const body = await req.json().catch(() => ({}));
    const { brandId } = body;

    if (brandId) {
      // Refresh a specific brand's token
      const result = await refreshBrandToken(supabase, brandId, META_APP_ID, META_APP_SECRET);
      
      // If manual refresh failed, try to send notification
      if (!result.success && RESEND_API_KEY) {
        await sendTokenExpirationEmail(supabase, brandId, result.error || 'Unknown error', RESEND_API_KEY);
      }
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find all brands with tokens expiring in the next 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const { data: expiringBrands, error: brandsError } = await supabase
      .from('brands')
      .select('id, name, user_id, meta_account_id, meta_token_expires_at')
      .not('meta_account_id', 'is', null)
      .not('meta_token_expires_at', 'is', null)
      .lt('meta_token_expires_at', sevenDaysFromNow.toISOString());

    if (brandsError) {
      console.error('Error fetching expiring brands:', brandsError);
      throw brandsError;
    }

    console.log(`Found ${expiringBrands?.length || 0} brands with expiring tokens`);

    const results: Array<{ brandId: string; brandName: string; success: boolean; error?: string; emailSent?: boolean }> = [];

    for (const brand of expiringBrands || []) {
      try {
        const result = await refreshBrandToken(supabase, brand.id, META_APP_ID, META_APP_SECRET);
        
        let emailSent = false;
        // If refresh failed, send notification email
        if (!result.success && RESEND_API_KEY) {
          emailSent = await sendTokenExpirationEmail(supabase, brand.id, result.error || 'Unknown error', RESEND_API_KEY);
        }
        
        results.push({
          brandId: brand.id,
          brandName: brand.name,
          success: result.success,
          error: result.error,
          emailSent
        });
      } catch (err: any) {
        results.push({
          brandId: brand.id,
          brandName: brand.name,
          success: false,
          error: err.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const emailsSent = results.filter(r => r.emailSent).length;

    console.log(`Token refresh complete: ${successCount} succeeded, ${failCount} failed, ${emailsSent} emails sent`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        succeeded: successCount,
        failed: failCount,
        emailsSent,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in refresh-meta-token:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

async function refreshBrandToken(
  supabase: any,
  brandId: string,
  appId: string,
  appSecret: string
): Promise<{ success: boolean; error?: string; newExpiresAt?: string }> {
  console.log(`Refreshing token for brand: ${brandId}`);

  // Get current token from vault
  const { data: currentToken, error: tokenError } = await supabase.rpc('get_meta_token', {
    p_brand_id: brandId
  });

  if (tokenError || !currentToken) {
    console.error(`No token found for brand ${brandId}:`, tokenError);
    return { success: false, error: 'No existing token found' };
  }

  // Exchange for a new long-lived token
  // Meta's token refresh endpoint
  const refreshUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
  refreshUrl.searchParams.set('grant_type', 'fb_exchange_token');
  refreshUrl.searchParams.set('client_id', appId);
  refreshUrl.searchParams.set('client_secret', appSecret);
  refreshUrl.searchParams.set('fb_exchange_token', currentToken);

  console.log('Requesting new long-lived token from Meta...');
  const refreshResponse = await fetch(refreshUrl.toString());
  const refreshData = await refreshResponse.json();

  if (!refreshResponse.ok || !refreshData.access_token) {
    console.error('Token refresh failed:', refreshData);
    
    // If the token is invalid/expired, we can't refresh it
    if (refreshData.error?.code === 190 || refreshData.error?.type === 'OAuthException') {
      return { 
        success: false, 
        error: 'Token invalid or expired. User must reconnect Meta account.' 
      };
    }
    
    return { success: false, error: refreshData.error?.message || 'Failed to refresh token' };
  }

  console.log('New token received, expires in:', refreshData.expires_in, 'seconds');

  // Store the new token in vault
  const { error: storeError } = await supabase.rpc('store_meta_token', {
    p_brand_id: brandId,
    p_token: refreshData.access_token
  });

  if (storeError) {
    console.error('Error storing new token:', storeError);
    return { success: false, error: 'Failed to store refreshed token' };
  }

  // Calculate new expiration date (Meta long-lived tokens last ~60 days)
  const expiresInSeconds = refreshData.expires_in || 5184000; // Default to 60 days
  const newExpiresAt = new Date();
  newExpiresAt.setSeconds(newExpiresAt.getSeconds() + expiresInSeconds);

  // Update the expiration date in the brands table
  const { error: updateError } = await supabase
    .from('brands')
    .update({ 
      meta_token_expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', brandId);

  if (updateError) {
    console.error('Error updating token expiration:', updateError);
    // Token was refreshed successfully, just couldn't update the date
  }

  console.log(`Token refreshed for brand ${brandId}, new expiration: ${newExpiresAt.toISOString()}`);

  return { 
    success: true, 
    newExpiresAt: newExpiresAt.toISOString() 
  };
}

async function sendTokenExpirationEmail(
  supabase: any,
  brandId: string,
  errorMessage: string,
  resendApiKey: string
): Promise<boolean> {
  try {
    // Get brand and user info
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('name, user_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      console.error('Could not fetch brand for email:', brandError);
      return false;
    }

    // Get user email from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', brand.user_id)
      .single();

    if (profileError || !profile?.email) {
      console.error('Could not fetch user email:', profileError);
      return false;
    }

    const resend = new Resend(resendApiKey);
    const userName = profile.full_name || 'there';
    const brandName = brand.name || 'your brand';

    const { error: emailError } = await resend.emails.send({
      from: 'Your Ad Assistant <notifications@resend.dev>',
      to: [profile.email],
      subject: `Action Required: Reconnect Meta for ${brandName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Meta Connection Issue</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; margin-top: 0;">Hi ${userName},</p>
            
            <p>We tried to automatically refresh your Meta connection for <strong>${brandName}</strong>, but it couldn't be renewed.</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;"><strong>What this means:</strong></p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #856404;">
                <li>Your campaign performance data won't sync</li>
                <li>You won't be able to publish new campaigns</li>
                <li>Weekly reports may be incomplete</li>
              </ul>
            </div>
            
            <p><strong>Why this happened:</strong> ${errorMessage}</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/dashboard" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; display: inline-block;">
                Reconnect Meta Account
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">This only takes about 30 seconds. Just click the button above and follow the prompts to reconnect.</p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; margin-bottom: 0;">
              You're receiving this because you have Meta connected to Your Ad Assistant. 
              If you no longer want these notifications, you can update your preferences in Settings.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error('Failed to send token expiration email:', emailError);
      return false;
    }

    console.log(`Token expiration email sent to ${profile.email} for brand ${brandName}`);
    return true;
  } catch (err: any) {
    console.error('Error sending token expiration email:', err);
    return false;
  }
}
