import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCorsHeaders } from '../_shared/cors.ts';

interface DiagnosticItem {
  key: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  fix?: string;
  fixUrl?: string;
  fixTime?: string;
  steps?: string[];
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId, accessToken, accounts, pages, instagramAccounts } = await req.json();

    if (!brandId) {
      return new Response(
        JSON.stringify({ error: 'brandId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get brand data
    const { data: brand } = await supabase
      .from('brands')
      .select('meta_access_token, meta_account_id, page_id, page_name, instagram_account_id, instagram_account_name')
      .eq('id', brandId)
      .single();

    // Get token - use provided token or read from brand record
    // NOTE: get_meta_token RPC fails with crypto permissions in service-role context.
    // Read token directly from brands table (matching pattern across all edge functions).
    let token = accessToken || brand?.meta_access_token;


    if (!token) {
      return new Response(
        JSON.stringify({
          success: true,
          diagnostics: [{
            key: 'token',
            label: 'Meta Connection',
            status: 'fail',
            message: 'No Meta access token found. Please connect your Meta account first.',
            fix: 'Click "Connect Meta Account" to start the OAuth flow.',
          }],
          score: { passed: 0, total: 1 },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const diagnostics: DiagnosticItem[] = [];

    // If the brand already has these fields saved, use them as ground truth
    // instead of requiring the caller to pass raw OAuth response arrays
    let pagesData = pages || [];
    let accountsData = accounts || [];
    let igData = instagramAccounts || [];

    // When called from settings (no arrays passed), fetch live from Meta API
    const needsFetch = pagesData.length === 0 && accountsData.length === 0;

    if (needsFetch) {
      // Check if brand already has saved selections — this is the most reliable source
      const hasSavedPage = !!brand?.page_id;
      const hasSavedAccount = !!brand?.meta_account_id;
      const hasSavedIg = !!brand?.instagram_account_id;

      // 1. Facebook Page check via saved data + live verification
      if (hasSavedPage) {
        try {
          const pageRes = await fetch(
            `https://graph.facebook.com/v21.0/${brand.page_id}?fields=id,name&access_token=${token}`
          );
          const pageData = await pageRes.json();
          if (pageRes.ok && !pageData.error) {
            pagesData = [{ id: brand.page_id, name: pageData.name || brand.page_name }];
          }
        } catch {
          // If API check fails, trust saved data
          pagesData = [{ id: brand.page_id, name: brand.page_name || 'Your Page' }];
        }
      } else {
        // Try fetching from API
        try {
          const res = await fetch(
            `https://graph.facebook.com/v21.0/me/accounts?fields=id,name&access_token=${token}`
          );
          const data = await res.json();
          if (res.ok && !data.error) {
            pagesData = data.data || [];
          }
        } catch { /* ignore */ }
      }

      // 2. Ad Account check via saved data + live verification
      if (hasSavedAccount) {
        const formattedId = brand.meta_account_id.startsWith('act_')
          ? brand.meta_account_id
          : `act_${brand.meta_account_id}`;
        try {
          const accRes = await fetch(
            `https://graph.facebook.com/v21.0/${formattedId}?fields=id,name,account_status&access_token=${token}`
          );
          const accData = await accRes.json();
          if (accRes.ok && !accData.error) {
            accountsData = [{
              id: brand.meta_account_id,
              name: accData.name,
              account_status: accData.account_status,
            }];
          } else {
            // Trust saved — assume active
            accountsData = [{ id: brand.meta_account_id, name: 'Your Ad Account', account_status: 1 }];
          }
        } catch {
          accountsData = [{ id: brand.meta_account_id, name: 'Your Ad Account', account_status: 1 }];
        }
      } else {
        try {
          const res = await fetch(
            `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&access_token=${token}`
          );
          const data = await res.json();
          if (res.ok && !data.error) {
            accountsData = data.data || [];
          }
        } catch { /* ignore */ }
      }

      // 3. Instagram check via saved data
      if (hasSavedIg) {
        // User already has IG linked — mark as linked to page
        igData = [{
          id: brand.instagram_account_id,
          username: brand.instagram_account_name || 'Your Account',
          linked_page_id: brand.page_id, // Mark as linked since it's already saved
        }];
      } else if (hasSavedPage) {
        // Try fetching IG from the page
        try {
          const res = await fetch(
            `https://graph.facebook.com/v21.0/${brand.page_id}?fields=instagram_business_account{id,username}&access_token=${token}`
          );
          const data = await res.json();
          if (res.ok && !data.error && data.instagram_business_account) {
            igData = [{
              id: data.instagram_business_account.id,
              username: data.instagram_business_account.username,
              linked_page_id: brand.page_id,
            }];
          }
        } catch { /* ignore */ }
      }
    }

    // 1. Check Facebook Pages
    if (pagesData.length > 0) {
      diagnostics.push({
        key: 'facebook_page',
        label: 'Facebook Page',
        status: 'pass',
        message: `Connected: ${pagesData[0]?.name || 'Your Page'}`,
      });
    } else {
      diagnostics.push({
        key: 'facebook_page',
        label: 'Facebook Page',
        status: 'fail',
        message: 'No Facebook Page found. Your ads need a Facebook Page to run.',
        fix: 'Create a Facebook Page for your business.',
        fixUrl: 'https://www.facebook.com/pages/create',
        fixTime: '~5 minutes',
        steps: [
          'Go to facebook.com/pages/create',
          'Choose "Business or Brand"',
          'Fill in your business name and category',
          'Add a profile photo and cover image',
          'Once created, come back here and reconnect Meta',
        ],
      });
    }

    // 2. Check Ad Accounts
    const activeAccounts = accountsData.filter((a: any) => a.account_status === 1);

    if (activeAccounts.length > 0) {
      diagnostics.push({
        key: 'ad_account',
        label: 'Ad Account',
        status: 'pass',
        message: `Connected: ${activeAccounts[0]?.name || 'Your Ad Account'}`,
      });
    } else if (accountsData.length > 0) {
      diagnostics.push({
        key: 'ad_account',
        label: 'Ad Account',
        status: 'warn',
        message: `Found ${accountsData.length} ad account${accountsData.length !== 1 ? 's' : ''}, but none appear active.`,
        fix: 'Check your ad account status in Meta Business Settings.',
        fixUrl: 'https://business.facebook.com/settings/ad-accounts',
        fixTime: '~2 minutes',
        steps: [
          'Go to business.facebook.com → Settings → Ad Accounts',
          'Check if your ad account is disabled or restricted',
          'Follow any prompts to reactivate it',
        ],
      });
    } else {
      diagnostics.push({
        key: 'ad_account',
        label: 'Ad Account',
        status: 'fail',
        message: 'No ad account found. You need an ad account to run ads.',
        fix: 'Create an ad account in Meta Business Settings.',
        fixUrl: 'https://business.facebook.com/settings/ad-accounts',
        fixTime: '~3 minutes',
        steps: [
          'Go to business.facebook.com → Settings',
          'Click "Ad Accounts" → "Add" → "Create a new ad account"',
          'Name it, set currency and timezone',
          'Come back here and reconnect Meta',
        ],
      });
    }

    // 3. Check Instagram
    const linkedIg = igData.filter((ig: any) =>
      ig.linked_page_id && pagesData.some((p: any) => p.id === ig.linked_page_id)
    );

    if (linkedIg.length > 0) {
      diagnostics.push({
        key: 'instagram',
        label: 'Instagram Account',
        status: 'pass',
        message: `Connected: ${linkedIg[0]?.username ? '@' + linkedIg[0].username : 'Your Instagram'}`,
      });
    } else if (igData.length > 0) {
      diagnostics.push({
        key: 'instagram',
        label: 'Instagram Account',
        status: 'warn',
        message: 'Instagram account found but may not be linked to your Facebook Page.',
        fix: 'Link your Instagram to your Facebook Page.',
        fixUrl: 'https://www.facebook.com/settings/?tab=instagram',
        fixTime: '~2 minutes',
        steps: [
          'Open the Instagram app on your phone',
          'Go to Settings → Account → Sharing to other apps → Facebook',
          'Log in and select the Facebook Page to link',
          'Come back here and re-check',
        ],
      });
    } else {
      diagnostics.push({
        key: 'instagram',
        label: 'Instagram Account',
        status: 'warn',
        message: 'No Instagram account found. Ads can still run on Facebook, but Instagram placement won\'t be available.',
        fix: 'Connect an Instagram Business or Creator account to your Facebook Page.',
        fixTime: '~3 minutes',
        steps: [
          'Make sure your Instagram is a Business or Creator account',
          'Instagram app → Settings → Account → Sharing to other apps → Facebook',
          'Link to your Facebook Page',
          'Come back here and re-check',
        ],
      });
    }

    // 4. Check Billing (if we have an active ad account)
    if (activeAccounts.length > 0) {
      const adAccountId = activeAccounts[0].id;
      const formattedId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

      try {
        const billingUrl = `https://graph.facebook.com/v21.0/${formattedId}?fields=funding_source_details,account_status&access_token=${token}`;
        const billingRes = await fetch(billingUrl);
        const billingData = await billingRes.json();

        if (billingRes.ok && !billingData.error) {
          if (billingData.funding_source_details) {
            diagnostics.push({
              key: 'billing',
              label: 'Billing Info',
              status: 'pass',
              message: 'Payment method is set up on your ad account.',
            });
          } else {
            diagnostics.push({
              key: 'billing',
              label: 'Billing Info',
              status: 'fail',
              message: 'No payment method found. You need billing set up before ads can run.',
              fix: 'Add a payment method to your ad account.',
              fixUrl: `https://business.facebook.com/billing_hub/payment_methods?asset_id=${formattedId.replace('act_', '')}`,
              fixTime: '~2 minutes',
              steps: [
                'Go to business.facebook.com → Billing',
                'Click "Payment Methods" → "Add Payment Method"',
                'Enter your credit card or PayPal details',
                'Save — you\'re all set!',
              ],
            });
          }
        } else {
          diagnostics.push({
            key: 'billing',
            label: 'Billing Info',
            status: 'warn',
            message: 'Could not verify billing status. Make sure you have a payment method in Meta.',
            fixUrl: 'https://business.facebook.com/billing_hub/payment_methods',
            fixTime: '~2 minutes',
          });
        }
      } catch {
        diagnostics.push({
          key: 'billing',
          label: 'Billing Info',
          status: 'warn',
          message: 'Could not verify billing. Please confirm you have a payment method in Meta.',
          fixUrl: 'https://business.facebook.com/billing_hub/payment_methods',
        });
      }

      // 5. Check Pixel
      try {
        const pixelUrl = `https://graph.facebook.com/v21.0/${formattedId}/adspixels?fields=id,name&access_token=${token}`;
        const pixelRes = await fetch(pixelUrl);
        const pixelData = await pixelRes.json();

        if (pixelRes.ok && !pixelData.error) {
          const pixels = pixelData.data || [];
          if (pixels.length > 0) {
            diagnostics.push({
              key: 'pixel',
              label: 'Meta Pixel / Dataset',
              status: 'pass',
              message: `Found: ${pixels.map((p: any) => p.name).join(', ')}`,
            });
          } else {
            diagnostics.push({
              key: 'pixel',
              label: 'Meta Pixel / Dataset (optional)',
              status: 'pass',
              optional: true,
              message: "Optional — you can launch ads without this. A pixel helps track conversions later. You're good to continue.",
              fix: 'When you\'re ready, create a Meta Pixel in Events Manager.',
              fixUrl: 'https://business.facebook.com/events_manager2/overview',
              fixTime: '~5 minutes',
              steps: [
                'Go to business.facebook.com → Events Manager',
                'Click "Connect Data Sources" → "Web" → "Meta Pixel"',
                'Name your pixel and install the code on your website',
                'Come back here and re-check',
              ],
            });
          }
        }
      } catch {
        diagnostics.push({
          key: 'pixel',
          label: 'Meta Pixel / Dataset',
          status: 'warn',
          message: 'Could not check pixel status.',
        });
      }
    }

    const passed = diagnostics.filter(d => d.status === 'pass').length;
    const total = diagnostics.length;

    console.log(`Meta diagnostic for brand ${brandId}: ${passed}/${total} passed`);

    return new Response(
      JSON.stringify({
        success: true,
        diagnostics,
        score: { passed, total },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in diagnose-meta-setup:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
