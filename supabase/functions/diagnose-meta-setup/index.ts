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

    // Get brand data to find token if not provided
    let token = accessToken;
    if (!token) {
      const { data: brand } = await supabase
        .from('brands')
        .select('meta_access_token, meta_account_id, page_id, instagram_account_id')
        .eq('id', brandId)
        .single();

      token = brand?.meta_access_token;
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
    }

    const diagnostics: DiagnosticItem[] = [];

    // 1. Check Facebook Pages
    const pagesData = pages || [];
    if (pagesData.length > 0) {
      diagnostics.push({
        key: 'facebook_page',
        label: 'Facebook Page',
        status: 'pass',
        message: `Found ${pagesData.length} Facebook Page${pagesData.length !== 1 ? 's' : ''}.`,
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
    const accountsData = accounts || [];
    const activeAccounts = accountsData.filter((a: any) => a.account_status === 1);

    if (activeAccounts.length > 0) {
      diagnostics.push({
        key: 'ad_account',
        label: 'Ad Account',
        status: 'pass',
        message: `Found ${activeAccounts.length} active ad account${activeAccounts.length !== 1 ? 's' : ''}.`,
      });
    } else if (accountsData.length > 0) {
      diagnostics.push({
        key: 'ad_account',
        label: 'Ad Account',
        status: 'warn',
        message: `Found ${accountsData.length} ad account${accountsData.length !== 1 ? 's' : ''}, but none are active.`,
        fix: 'Check your ad account status in Meta Business Settings.',
        fixUrl: 'https://business.facebook.com/settings/ad-accounts',
        fixTime: '~2 minutes',
        steps: [
          'Go to business.facebook.com → Settings → Ad Accounts',
          'Check if your ad account is disabled or restricted',
          'Follow any prompts to reactivate it',
          'If restricted, you may need to verify your identity',
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
          'Click "Ad Accounts" in the left menu',
          'Click "Add" → "Create a new ad account"',
          'Name it (e.g., "My Business Ads")',
          'Set your currency and timezone',
          'Come back here and reconnect Meta',
        ],
      });
    }

    // 3. Check Instagram accounts linked to pages
    const igData = instagramAccounts || [];
    const linkedIg = igData.filter((ig: any) =>
      ig.linked_page_id && pagesData.some((p: any) => p.id === ig.linked_page_id)
    );

    if (linkedIg.length > 0) {
      diagnostics.push({
        key: 'instagram',
        label: 'Instagram Account',
        status: 'pass',
        message: `Found ${linkedIg.length} Instagram account${linkedIg.length !== 1 ? 's' : ''} linked to your Page.`,
      });
    } else if (igData.length > 0) {
      diagnostics.push({
        key: 'instagram',
        label: 'Instagram Account',
        status: 'warn',
        message: 'Instagram accounts found but not linked to your Facebook Page.',
        fix: 'Link your Instagram to your Facebook Page.',
        fixUrl: 'https://www.facebook.com/settings/?tab=instagram',
        fixTime: '~2 minutes',
        steps: [
          'Open the Instagram app on your phone',
          'Go to Settings → Account → Sharing to other apps → Facebook',
          'Log in and select the Facebook Page to link',
          'Or: Go to your Facebook Page → Settings → Instagram → Connect Account',
          'Come back here and reconnect Meta',
        ],
      });
    } else {
      diagnostics.push({
        key: 'instagram',
        label: 'Instagram Account',
        status: 'warn',
        message: 'No Instagram account found. Your ads can still run on Facebook, but Instagram placement won\'t be available.',
        fix: 'Connect an Instagram Business or Creator account to your Facebook Page.',
        fixUrl: 'https://www.facebook.com/settings/?tab=instagram',
        fixTime: '~3 minutes',
        steps: [
          'Make sure your Instagram account is a Business or Creator account (Instagram → Settings → Account → Switch to Professional Account)',
          'Open the Instagram app → Settings → Account → Sharing to other apps → Facebook',
          'Link to your Facebook Page',
          'Come back here and reconnect Meta',
        ],
      });
    }

    // 4. Check Billing (if we have an active ad account and a token)
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
              message: 'No payment method found on your ad account. You need billing set up before ads can run.',
              fix: 'Add a payment method to your ad account.',
              fixUrl: `https://business.facebook.com/billing_hub/payment_methods?asset_id=${formattedId.replace('act_', '')}`,
              fixTime: '~2 minutes',
              steps: [
                'Go to business.facebook.com → Billing',
                'Click "Payment Methods"',
                'Click "Add Payment Method"',
                'Enter your credit card or PayPal details',
                'Save — you\'re all set!',
              ],
            });
          }
        } else {
          // Can't check billing — non-fatal
          diagnostics.push({
            key: 'billing',
            label: 'Billing Info',
            status: 'warn',
            message: 'Could not verify billing status. Make sure you have a payment method set up in Meta.',
            fix: 'Check your billing settings in Meta Business.',
            fixUrl: 'https://business.facebook.com/billing_hub/payment_methods',
            fixTime: '~2 minutes',
          });
        }
      } catch {
        diagnostics.push({
          key: 'billing',
          label: 'Billing Info',
          status: 'warn',
          message: 'Could not verify billing. Please confirm you have a payment method in Meta Business.',
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
              message: `Found ${pixels.length} pixel${pixels.length !== 1 ? 's' : ''}: ${pixels.map((p: any) => p.name).join(', ')}.`,
            });
          } else {
            diagnostics.push({
              key: 'pixel',
              label: 'Meta Pixel / Dataset',
              status: 'warn',
              message: 'No Meta Pixel found. A pixel tracks conversions and helps optimize your ads.',
              fix: 'Create a Meta Pixel in Events Manager.',
              fixUrl: 'https://business.facebook.com/events_manager2/overview',
              fixTime: '~5 minutes',
              steps: [
                'Go to business.facebook.com → Events Manager',
                'Click "Connect Data Sources"',
                'Choose "Web" → "Meta Pixel"',
                'Name your pixel (e.g., "My Website Pixel")',
                'Install the pixel code on your website (or use a partner integration)',
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
