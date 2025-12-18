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
    const { code, brandId, redirectUri } = await req.json();
    
    if (!code || !brandId) {
      throw new Error('Code and brandId are required');
    }

    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET');
    
    if (!META_APP_ID || !META_APP_SECRET) {
      throw new Error('Meta credentials not configured');
    }

    console.log('Processing OAuth callback for brand:', brandId);

    // Exchange code for access token
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', META_APP_ID);
    tokenUrl.searchParams.set('client_secret', META_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    console.log('Exchanging code for token...');
    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      throw new Error(tokenData.error?.message || 'Failed to obtain access token');
    }

    console.log('Access token obtained successfully');

    // Get user's ad accounts
    const adAccountsUrl = `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_status,currency,business_name&access_token=${tokenData.access_token}`;
    
    console.log('Fetching ad accounts...');
    const adAccountsResponse = await fetch(adAccountsUrl);
    const adAccountsData = await adAccountsResponse.json();

    if (!adAccountsResponse.ok) {
      console.error('Failed to fetch ad accounts:', adAccountsData);
      throw new Error(adAccountsData.error?.message || 'Failed to fetch ad accounts');
    }

    // Filter only active accounts
    const activeAccounts = (adAccountsData.data || []).filter(
      (account: any) => account.account_status === 1
    );
    console.log('Active ad accounts found:', activeAccounts.length);

    // Get user's Facebook Pages (required for ad creative creation)
    const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,category&access_token=${tokenData.access_token}`;
    
    console.log('Fetching Facebook Pages...');
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    let pages: any[] = [];
    if (pagesResponse.ok && pagesData.data) {
      pages = pagesData.data;
      console.log('Facebook Pages found:', pages.length);
    } else {
      console.error('Failed to fetch pages:', pagesData);
    }

    // Store the access token securely in Supabase Vault
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use the secure vault function to store the token
    const { data: vaultResult, error: vaultError } = await supabase
      .rpc('store_meta_token', {
        p_brand_id: brandId,
        p_token: tokenData.access_token
      });

    if (vaultError) {
      console.error('Error storing access token in vault:', vaultError);
      // Don't throw - we still want to return success for the OAuth flow
      // The token can be re-obtained if needed
    } else {
      console.log('Access token stored securely in vault for brand:', brandId);
    }
      
    // Check if user has already selected an account (on re-connection)
    const { data: brand } = await supabase
      .from('brands')
      .select('meta_account_id')
      .eq('id', brandId)
      .single();
      
    if (brand?.meta_account_id) {
      console.log('Meta account already selected, triggering auto-sync...');
      // Get the token from vault for the sync call
      const { data: storedToken } = await supabase.rpc('get_meta_token', { p_brand_id: brandId });
      
      if (storedToken) {
        fetch(`${supabaseUrl}/functions/v1/sync-meta-campaigns`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            brandId,
            metaAccountId: brand.meta_account_id,
            metaAccessToken: storedToken
          })
        }).catch(err => {
          console.error('Background sync failed:', err);
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        accounts: activeAccounts,
        pages: pages
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in meta-oauth-callback:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
