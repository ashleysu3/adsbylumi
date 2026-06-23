import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================================================
// connect-ig-to-ad-account
// One-click fix for the #1 support hangup: IG is connected to the user's
// Facebook Page but NOT added to their ad account, so ads can't use it.
//
// Input: { brandId }
// Returns:
//   { success: true, instagram: { id, username } }
//   { success: false, manual: true, error }  // Meta requires manual action
//   { success: false, error }                // Anything else
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const sbAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await sbAuth.auth.getUser();
    if (authErr || !user) return json({ success: false, error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const { brandId } = body || {};
    if (!brandId) return json({ success: false, error: 'brandId is required' }, 400);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: brand, error: bErr } = await sb
      .from('brands')
      .select('id, user_id, meta_access_token, meta_account_id, page_id')
      .eq('id', brandId)
      .single();
    if (bErr || !brand) return json({ success: false, error: 'Brand not found' }, 404);
    if (brand.user_id !== user.id) return json({ success: false, error: 'Forbidden' }, 403);

    if (!brand.meta_access_token) {
      return json({ success: false, error: 'No Meta access token on file. Reconnect Meta first.' });
    }
    if (!brand.meta_account_id) {
      return json({ success: false, error: 'No ad account selected for this brand.' });
    }
    if (!brand.page_id) {
      return json({
        success: false,
        manual: true,
        error: 'No Facebook Page linked. Connect a Page to this brand first, then re-run the check.',
      });
    }

    const token = brand.meta_access_token;

    // 1) Get the IG account connected to the Page.
    const pageRes = await fetch(
      `https://graph.facebook.com/v25.0/${brand.page_id}?fields=instagram_business_account{id,username,name,profile_picture_url}&access_token=${token}`,
    );
    const pageData = await pageRes.json();
    if (!pageRes.ok) {
      return json({
        success: false,
        manual: true,
        error: pageData?.error?.message || `Couldn't read your Page (HTTP ${pageRes.status}).`,
      });
    }
    const ig = pageData?.instagram_business_account;
    if (!ig?.id) {
      return json({
        success: false,
        manual: true,
        error: "No Instagram is connected to your Facebook Page. Connect it on Instagram first (Settings → Linked Accounts → Facebook), then try again.",
      });
    }

    // 2) Attach IG to the ad account — same call meta-oauth-callback uses.
    const adId = String(brand.meta_account_id).startsWith('act_')
      ? brand.meta_account_id
      : `act_${brand.meta_account_id}`;
    const attachRes = await fetch(
      `https://graph.facebook.com/v25.0/${adId}/instagram_accounts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagram_account: ig.id, access_token: token }),
      },
    );
    const attachData = await attachRes.json();
    if (!attachRes.ok || attachData?.error) {
      return json({
        success: false,
        manual: true,
        error:
          attachData?.error?.message ||
          `Meta wouldn't attach the Instagram account automatically (HTTP ${attachRes.status}). You'll need to add it manually in Business Settings.`,
      });
    }

    // 3) Verify it landed.
    let verified = false;
    try {
      const vr = await fetch(
        `https://graph.facebook.com/v25.0/${adId}/instagram_accounts?fields=id&access_token=${token}`,
      );
      const vd = await vr.json();
      verified = vr.ok && Array.isArray(vd?.data) && vd.data.some((row: any) => row.id === ig.id);
    } catch { /* non-fatal */ }

    // 4) Store on the brand record.
    await sb.from('brands').update({
      instagram_account_id: ig.id,
      instagram_account_name: ig.name || ig.username || null,
      updated_at: new Date().toISOString(),
    }).eq('id', brandId);

    if (!verified) {
      return json({
        success: false,
        manual: true,
        error:
          "Meta accepted the request but the Instagram account didn't show up on your ad account yet. This usually means Meta needs you to confirm in Business Settings.",
      });
    }

    return json({
      success: true,
      instagram: { id: ig.id, username: ig.username || null, name: ig.name || null },
    });
  } catch (err: any) {
    console.error('connect-ig-to-ad-account error:', err);
    return json({ success: false, error: err?.message || 'Unknown error' });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
