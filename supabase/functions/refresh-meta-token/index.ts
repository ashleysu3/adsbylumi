import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

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

    if (!META_APP_ID || !META_APP_SECRET) {
      throw new Error('Meta credentials not configured');
    }

    // Get brandId from request body (for manual refresh) or process all expiring tokens
    const body = await req.json().catch(() => ({}));
    const { brandId } = body;

    if (brandId) {
      // Refresh a specific brand's token
      const result = await refreshBrandToken(supabase, brandId, META_APP_ID, META_APP_SECRET);
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
      .select('id, name, meta_account_id, meta_token_expires_at')
      .not('meta_account_id', 'is', null)
      .not('meta_token_expires_at', 'is', null)
      .lt('meta_token_expires_at', sevenDaysFromNow.toISOString());

    if (brandsError) {
      console.error('Error fetching expiring brands:', brandsError);
      throw brandsError;
    }

    console.log(`Found ${expiringBrands?.length || 0} brands with expiring tokens`);

    const results: Array<{ brandId: string; brandName: string; success: boolean; error?: string }> = [];

    for (const brand of expiringBrands || []) {
      try {
        const result = await refreshBrandToken(supabase, brand.id, META_APP_ID, META_APP_SECRET);
        results.push({
          brandId: brand.id,
          brandName: brand.name,
          success: result.success,
          error: result.error
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

    console.log(`Token refresh complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        succeeded: successCount,
        failed: failCount,
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
