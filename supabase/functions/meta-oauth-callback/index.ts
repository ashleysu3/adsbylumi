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
    const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
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
    const longLivedUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
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
    const adAccountsUrl = `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status,currency,business_name&access_token=${finalToken}`;
    
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
    const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,category,access_token,instagram_business_account{id,name,username,profile_picture_url}&access_token=${finalToken}`;
    
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
      // For pages without an instagram_business_account, try fetching via the page's own token
      for (const page of pagesData.data) {
        if (!page.instagram_business_account && page.access_token) {
          try {
            const pageIgUrl = `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id,name,username,profile_picture_url}&access_token=${page.access_token}`;
            const pageIgRes = await fetch(pageIgUrl);
            const pageIgData = await pageIgRes.json();
            if (pageIgRes.ok && pageIgData.instagram_business_account) {
              const ig = pageIgData.instagram_business_account;
              const igId = ig.id;
              if (!instagramAccounts.some((a: any) => a.id === igId)) {
                instagramAccounts.push({
                  id: igId,
                  name: ig.name || ig.username,
                  username: ig.username,
                  profile_picture_url: ig.profile_picture_url,
                  linked_page_id: page.id,
                  linked_page_name: page.name,
                  source: 'page_token_lookup',
                });
                console.log('Discovered IG via page token for page:', page.id, igId);
              }
            }
          } catch (ptErr) {
            console.log('Page-token IG lookup skipped (non-fatal):', ptErr);
          }
        }
      }
    } else {
      console.error('Failed to fetch pages:', pagesData);
    }

    // Also fetch pages managed via Business Manager
    try {
      const businessesUrl = `https://graph.facebook.com/v21.0/me/businesses?fields=id,name&access_token=${finalToken}`;
      const businessesRes = await fetch(businessesUrl);
      const businessesData = await businessesRes.json();

      if (businessesRes.ok && businessesData.data?.length > 0) {
        const existingPageIds = new Set(pages.map((p: any) => p.id));

        const bmPagePromises = businessesData.data.flatMap((biz: any) => [
          fetch(`https://graph.facebook.com/v21.0/${biz.id}/owned_pages?fields=id,name,category,instagram_business_account{id,name,username,profile_picture_url}&access_token=${finalToken}`).then(r => r.json()),
          fetch(`https://graph.facebook.com/v21.0/${biz.id}/client_pages?fields=id,name,category,instagram_business_account{id,name,username,profile_picture_url}&access_token=${finalToken}`).then(r => r.json()),
        ]);

        const bmResults = await Promise.all(bmPagePromises);

        for (const result of bmResults) {
          if (result.data) {
            for (const page of result.data) {
              if (!existingPageIds.has(page.id)) {
                pages.push(page);
                existingPageIds.add(page.id);
                // Extract Instagram if present
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
            }
          }
        }
        console.log('Total pages after BM merge:', pages.length);

        // Fourth IG source: Instagram accounts directly under each Business Manager
        const existingIgIdsPreBM = new Set(instagramAccounts.map((ig: any) => ig.id));
        for (const biz of businessesData.data) {
          try {
            const bmIgUrl = `https://graph.facebook.com/v21.0/${biz.id}/instagram_accounts?fields=id,username,name,profile_picture_url&access_token=${finalToken}`;
            const bmIgRes = await fetch(bmIgUrl);
            const bmIgData = await bmIgRes.json();
            if (bmIgRes.ok && bmIgData.data) {
              for (const ig of bmIgData.data) {
                if (!existingIgIdsPreBM.has(ig.id)) {
                  instagramAccounts.push({
                    id: ig.id,
                    name: ig.name || ig.username,
                    username: ig.username,
                    profile_picture_url: ig.profile_picture_url,
                    linked_page_id: null,
                    linked_page_name: `Via Business Manager ${biz.name || biz.id}`,
                    source: 'business_manager',
                  });
                  existingIgIdsPreBM.add(ig.id);
                }
              }
            }
          } catch (bmIgErr) {
            console.log('BM Instagram accounts fetch skipped (non-fatal):', bmIgErr);
          }
        }
        console.log('Total IG accounts after BM IG merge:', instagramAccounts.length);
      }
    } catch (bmError) {
      console.log('Business Manager pages fetch skipped (non-fatal):', bmError);
    }

    // Also fetch Instagram accounts accessible through ad accounts
    const existingIgIds = new Set(instagramAccounts.map((ig: any) => ig.id));
    for (const adAccount of activeAccounts) {
      try {
        const adAccountId = adAccount.id; // format: act_XXXX
        const igUrl = `https://graph.facebook.com/v21.0/${adAccountId}/instagram_accounts?fields=id,username,name,profile_picture_url&access_token=${finalToken}`;
        const igRes = await fetch(igUrl);
        const igData = await igRes.json();
        if (igRes.ok && igData.data) {
          for (const ig of igData.data) {
            if (!existingIgIds.has(ig.id)) {
              instagramAccounts.push({
                id: ig.id,
                name: ig.name || ig.username,
                username: ig.username,
                profile_picture_url: ig.profile_picture_url,
                linked_page_id: null,
                linked_page_name: `Via ad account ${adAccount.name || adAccountId}`,
                source: 'ad_account',
              });
              existingIgIds.add(ig.id);
            }
          }
        }
      } catch (adIgErr) {
        console.log('Ad account Instagram fetch skipped (non-fatal):', adIgErr);
      }
    }
    console.log('Total Instagram accounts after ad-account merge:', instagramAccounts.length);

    // Auto-connect discovered IG accounts to ad accounts as assets.
    // This is the step users otherwise have to do manually in Business Manager
    // (Business Manager → Instagram → Connect Assets → Ad Account).
    const autoConnectedIgs: string[] = [];
    for (const adAccount of activeAccounts) {
      for (const ig of instagramAccounts) {
        try {
          const connectUrl = `https://graph.facebook.com/v21.0/${adAccount.id}/instagram_accounts`;
          const connectRes = await fetch(connectUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instagram_account: ig.id,
              access_token: finalToken,
            }),
          });
          const connectData = await connectRes.json();
          if (connectRes.ok && !connectData.error) {
            autoConnectedIgs.push(`${ig.id} → ${adAccount.id}`);
          }
          // Silently ignore errors (already connected, insufficient perms, etc.)
        } catch {
          // Non-fatal — continue
        }
      }
    }
    if (autoConnectedIgs.length > 0) {
      console.log('Auto-connected IG accounts to ad accounts:', autoConnectedIgs);
    }

    // Re-fetch ad-account IG list to pick up any newly connected accounts
    const postConnectIgIds = new Set(instagramAccounts.map((ig: any) => ig.id));
    for (const adAccount of activeAccounts) {
      try {
        const igUrl = `https://graph.facebook.com/v21.0/${adAccount.id}/instagram_accounts?fields=id,username,name,profile_picture_url&access_token=${finalToken}`;
        const igRes = await fetch(igUrl);
        const igData = await igRes.json();
        if (igRes.ok && igData.data) {
          for (const ig of igData.data) {
            if (!postConnectIgIds.has(ig.id)) {
              instagramAccounts.push({
                id: ig.id,
                name: ig.name || ig.username,
                username: ig.username,
                profile_picture_url: ig.profile_picture_url,
                linked_page_id: null,
                linked_page_name: `Via ad account ${adAccount.name || adAccount.id}`,
                source: 'auto_connected',
              });
              postConnectIgIds.add(ig.id);
            }
          }
        }
      } catch {
        // Non-fatal
      }
    }
    console.log('Final Instagram accounts count:', instagramAccounts.length);

    // Permission checks for instagram_basic/pages_read_user_content removed —
    // those permissions are no longer requested. Post selection uses URL paste + Firecrawl scraping.
    let permissionWarning: string | null = null;
    console.log('Skipping instagram_basic permission checks (not requested)');

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

    // Update the token expiration date AND store token directly in brands table
    // (analyze-instagram-posts and other functions read meta_access_token directly from brands)
    const { error: updateError } = await supabase
      .from('brands')
      .update({ 
        meta_access_token: finalToken,
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

      // Use the freshly exchanged token instead of calling get_meta_token.
      // (Service-role calls don't have user JWT context, and vault migrations can be flaky.)
      fetch(`${supabaseUrl}/functions/v1/sync-meta-campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          brandId,
          metaAccountId: brandData.meta_account_id,
          metaAccessToken: finalToken,
        }),
      }).catch((err) => {
        console.error('Background sync failed:', err);
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        accounts: activeAccounts,
        pages: pages,
        instagramAccounts: instagramAccounts,
        ...(igPermissionWarnings.length > 0 ? { igPermissionWarnings } : {}),
        ...(permissionWarning ? { permissionWarning } : {})
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
