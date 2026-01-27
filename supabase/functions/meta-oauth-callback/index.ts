import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[meta-oauth-callback] request received', {
    method: req.method,
    origin,
  });

  try {
    // 1. AUTHENTICATE USER
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create auth client to verify user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    const { code, brandId, redirectUri } = await req.json();
    
    if (!code || !brandId) {
      throw new Error('Code and brandId are required');
    }

    // 2. VERIFY BRAND OWNERSHIP
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('user_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      console.error('Brand not found:', brandId);
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (brand.user_id !== user.id) {
      console.error('Access denied: User', user.id, 'does not own brand', brandId);
      return new Response(
        JSON.stringify({ error: 'Access denied: You do not own this brand' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Brand ownership verified for user:', user.id);

    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET');
    
    if (!META_APP_ID || !META_APP_SECRET) {
      throw new Error('Meta credentials not configured');
    }

    console.log('Processing OAuth callback for brand:', brandId);

    // Exchange code for short-lived access token
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

    console.log('Short-lived access token obtained, exchanging for long-lived token...');

    // Exchange short-lived token for long-lived token (~60 days)
    const longLivedUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', META_APP_ID);
    longLivedUrl.searchParams.set('client_secret', META_APP_SECRET);
    longLivedUrl.searchParams.set('fb_exchange_token', tokenData.access_token);

    const longLivedResponse = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedResponse.json();

    let finalToken = tokenData.access_token;
    let tokenExpiresIn = tokenData.expires_in || 3600; // Default 1 hour for short-lived

    if (longLivedResponse.ok && longLivedData.access_token) {
      finalToken = longLivedData.access_token;
      tokenExpiresIn = longLivedData.expires_in || 5184000; // Default 60 days for long-lived
      console.log('Long-lived token obtained, expires in:', tokenExpiresIn, 'seconds');
    } else {
      console.warn('Could not exchange for long-lived token, using short-lived:', longLivedData.error);
    }

    // Calculate token expiration date
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setSeconds(tokenExpiresAt.getSeconds() + tokenExpiresIn);

    // Get user's ad accounts
    const adAccountsUrl = `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_status,currency,business_name&access_token=${finalToken}`;
    
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
    const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,category,instagram_business_account{id,name,username,profile_picture_url}&access_token=${finalToken}`;
    
    console.log('Fetching Facebook Pages with Instagram accounts...');
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    let pages: any[] = [];
    let instagramAccounts: any[] = [];
    
    if (pagesResponse.ok && pagesData.data) {
      pages = pagesData.data;
      console.log('Facebook Pages found:', pages.length);
      
      // Extract Instagram accounts linked to Pages
      for (const page of pagesData.data) {
        if (page.instagram_business_account) {
          instagramAccounts.push({
            id: page.instagram_business_account.id,
            name: page.instagram_business_account.name || page.instagram_business_account.username,
            username: page.instagram_business_account.username,
            profile_picture_url: page.instagram_business_account.profile_picture_url,
            linked_page_id: page.id,
            linked_page_name: page.name
          });
        }
      }
      console.log('Instagram accounts found:', instagramAccounts.length);
    } else {
      console.error('Failed to fetch pages:', pagesData);
    }

    // Store the access token securely in Supabase Vault
    const { data: vaultResult, error: vaultError } = await supabase
      .rpc('store_meta_token', {
        p_brand_id: brandId,
        p_token: finalToken
      });

    if (vaultError) {
      console.error('Error storing access token in vault:', vaultError);
      // Don't throw - we still want to return success for the OAuth flow
    } else {
      console.log('Access token stored securely in vault for brand:', brandId);
    }

    // Update the token expiration date in the brands table
    const { error: updateError } = await supabase
      .from('brands')
      .update({ 
        meta_token_expires_at: tokenExpiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', brandId);

    if (updateError) {
      console.error('Error updating token expiration:', updateError);
    } else {
      console.log('Token expiration updated:', tokenExpiresAt.toISOString());
    }
      
    // Check if user has already selected an account (on re-connection)
    const { data: brandData } = await supabase
      .from('brands')
      .select('meta_account_id')
      .eq('id', brandId)
      .single();
      
    if (brandData?.meta_account_id) {
      console.log('Meta account already selected, triggering auto-sync...');
      // Get the token from vault for the sync call
      const { data: storedToken } = await supabase.rpc('get_meta_token', { p_brand_id: brandId });
      
      if (storedToken) {
        fetch(`${supabaseUrl}/functions/v1/sync-meta-campaigns`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            brandId,
            metaAccountId: brandData.meta_account_id,
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
        pages: pages,
        instagramAccounts: instagramAccounts
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
