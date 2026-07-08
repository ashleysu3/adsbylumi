import { createClient } from "npm:@supabase/supabase-js@2";
import { metaErrorMessage, metaAccountStatusLabel, metaPermissionLabels } from "../_shared/meta-errors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================================================
// check-meta-setup (Patch #30 — single source of truth)
//
// One edge function that runs ALL Meta-connection checks and returns a
// unified result. The Meta Settings page calls just this — the previous
// trio of test-meta-connection, diagnose-meta-setup, and pixel checks all
// get aggregated here.
//
// Inputs:  { brandId }
// Returns: {
//   success: true,
//   overallStatus: 'healthy' | 'limited' | 'broken' | 'disconnected',
//   summary: string,                 // one-line plain English
//   checks: Check[],                 // each step with pass/warn/fail
//   primaryAction: ActionHint | null,// the headline button to fix this
//   meta: { /* raw Meta IDs / names for display */ },
//   generatedAt: string,
// }
// ============================================================================

interface Check {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  detail?: string;
  fix?: ActionHint;
}

interface ActionHint {
  kind: 'reconnect' | 'pixel_setup' | 'page_link' | 'ig_link' | 'choose_ad_account';
  label: string;
  detail?: string;
}

const REQUIRED_PERMISSIONS = ['ads_management', 'ads_read', 'business_management', 'pages_show_list', 'pages_read_engagement', 'instagram_basic'];

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { brandId } = await req.json();
    if (!brandId) return json({ error: 'brandId is required' }, 400);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: brand, error: bErr } = await sb
      .from('brands')
      .select('id, user_id, name, meta_access_token, meta_account_id, meta_token_expires_at, page_id, page_name, instagram_account_id, instagram_account_name, meta_pixel_id, meta_pixel_name, meta_pixel_verified_at, meta_pixel_events')
      .eq('id', brandId).single();
    if (bErr || !brand) return json({ error: 'Brand not found' }, 404);
    if (brand.user_id !== user.id) {
      const { data: roleRow } = await sb
        .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      if (!roleRow) return json({ error: 'Forbidden' }, 403);
    }

    const checks: Check[] = [];
    const m: any = { brandName: brand.name };

    // ----- 1. Token presence -----
    const hasToken = !!brand.meta_access_token;
    const expiresAt = brand.meta_token_expires_at ? new Date(brand.meta_token_expires_at) : null;
    const now = new Date();
    const expired = expiresAt ? expiresAt.getTime() < now.getTime() : false;
    const expiringSoon = expiresAt ? (expiresAt.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000 : false;

    if (!hasToken) {
      // Disconnected. Stop here — every other check would just cascade-fail.
      return json({
        success: true,
        overallStatus: 'disconnected',
        summary: "You haven't connected a Meta account yet — connect to give Lumi access to your ads.",
        checks: [{ id: 'token', label: 'Meta account connected', status: 'fail', detail: 'No access token on file.' }],
        primaryAction: { kind: 'reconnect', label: 'Connect Meta account' },
        meta: m,
        generatedAt: new Date().toISOString(),
      });
    }

    if (expired) {
      checks.push({
        id: 'token',
        label: 'Access token',
        status: 'fail',
        detail: `Expired ${expiresAt!.toLocaleDateString()}. Tokens last ~60 days; you'll need to reconnect.`,
        fix: { kind: 'reconnect', label: 'Reconnect Meta', detail: 'Re-authorizes Lumi with a fresh 60-day token.' },
      });
    } else if (expiringSoon) {
      checks.push({
        id: 'token',
        label: 'Access token',
        status: 'warn',
        detail: `Expires ${expiresAt!.toLocaleDateString()} (less than 7 days from now).`,
        fix: { kind: 'reconnect', label: 'Refresh now' },
      });
    } else {
      checks.push({
        id: 'token',
        label: 'Access token',
        status: 'pass',
        detail: expiresAt ? `Valid until ${expiresAt.toLocaleDateString()}.` : 'Active.',
      });
    }

    const token = brand.meta_access_token!;

    // ----- 2. Token actually works (lightweight /me call) -----
    let tokenWorks = false;
    let tokenError: string | null = null;
    try {
      const r = await fetch(`https://graph.facebook.com/v25.0/me?fields=id,name&access_token=${token}`);
      const d = await r.json();
      if (r.ok && d?.id) {
        tokenWorks = true;
        m.fbUserId = d.id; m.fbUserName = d.name;
      } else {
        tokenError = metaErrorMessage(d?.error, "Meta rejected the connection.");
      }
    } catch (e: any) {
      tokenError = e?.message || 'Token validation failed';
    }
    if (!tokenWorks) {
      checks.push({
        id: 'token_valid',
        label: 'Token recognized by Meta',
        status: 'fail',
        detail: tokenError || 'Meta rejected the access token.',
        fix: { kind: 'reconnect', label: 'Reconnect Meta' },
      });
      // If the token is broken, we can't do any further check honestly. Bail.
      return json({
        success: true,
        overallStatus: 'broken',
        summary: 'Your Meta connection has expired or been revoked. Reconnect to restore access.',
        checks,
        primaryAction: { kind: 'reconnect', label: 'Reconnect Meta' },
        meta: m,
        generatedAt: new Date().toISOString(),
      });
    }

    // ----- 3. Required permissions (per-scope visibility) -----
    let missingPerms: string[] = [];
    let grantedPerms: string[] = [];
    try {
      const r = await fetch(`https://graph.facebook.com/v25.0/me/permissions?access_token=${token}`);
      const d = await r.json();
      grantedPerms = (Array.isArray(d?.data) ? d.data : [])
        .filter((p: any) => p.status === 'granted')
        .map((p: any) => p.permission);
      missingPerms = REQUIRED_PERMISSIONS.filter(p => !grantedPerms.includes(p));
      m.permissions = {
        required: REQUIRED_PERMISSIONS,
        granted: grantedPerms.filter((p: string) => REQUIRED_PERMISSIONS.includes(p)),
        missing: missingPerms,
      };
      if (missingPerms.length === 0) {
        checks.push({ id: 'permissions', label: 'Required permissions', status: 'pass', detail: `All granted: ${REQUIRED_PERMISSIONS.join(', ')}.` });
      } else {
        checks.push({
          id: 'permissions',
          label: 'Required permissions',
          status: missingPerms.includes('ads_management') || missingPerms.includes('ads_read') ? 'fail' : 'warn',
          detail: `Missing: ${metaPermissionLabels(missingPerms)}. Re-pick assets and grant all permissions on Meta's consent screen.`,
          fix: { kind: 'reconnect', label: 'Fix / re-pick assets' },
        });
      }
    } catch (e: any) {
      checks.push({
        id: 'permissions',
        label: 'Required permissions',
        status: 'warn',
        detail: 'Could not read granted permissions.',
      });
    }

    // ----- 4. Ad account reachable -----
    if (!brand.meta_account_id) {
      checks.push({
        id: 'ad_account',
        label: 'Ad account selected',
        status: 'fail',
        detail: "You're connected to Meta but haven't picked an ad account for this brand yet.",
        fix: { kind: 'choose_ad_account', label: 'Choose ad account' },
      });
    } else {
      try {
        const r = await fetch(`https://graph.facebook.com/v25.0/${brand.meta_account_id}?fields=id,name,account_status,currency&access_token=${token}`);
        const d = await r.json();
        if (r.ok && d?.id) {
          m.adAccountId = d.id; m.adAccountName = d.name; m.adAccountCurrency = d.currency;
          if (d.account_status !== 1) {
            checks.push({
              id: 'ad_account',
              label: 'Ad account active',
              status: 'warn',
              detail: `${d.name || d.id}: ${metaAccountStatusLabel(d.account_status)}`,
            });
          } else {
            checks.push({ id: 'ad_account', label: 'Ad account', status: 'pass', detail: `${d.name} (${d.id})` });
          }
        } else {
          checks.push({
            id: 'ad_account',
            label: 'Ad account reachable',
            status: 'fail',
            detail: metaErrorMessage(d?.error, `Lumi lost access to ${brand.meta_account_id} — it may have been deleted or you no longer have access.`),
            fix: { kind: 'reconnect', label: 'Reconnect Meta' },
          });
        }
      } catch (e: any) {
        checks.push({
          id: 'ad_account',
          label: 'Ad account reachable',
          status: 'fail',
          detail: e?.message || 'Network error loading ad account.',
        });
      }
    }

    // ----- 5. Facebook Page -----
    if (brand.page_id) {
      try {
        const r = await fetch(`https://graph.facebook.com/v25.0/${brand.page_id}?fields=id,name&access_token=${token}`);
        const d = await r.json();
        if (r.ok && d?.id) {
          m.pageId = d.id; m.pageName = d.name || brand.page_name || null;
          checks.push({ id: 'page', label: 'Facebook Page', status: 'pass', detail: d.name || brand.page_name || 'Linked' });
        } else {
          checks.push({
            id: 'page',
            label: 'Facebook Page',
            status: 'warn',
            detail: `${brand.page_name || "Your connected Page"} isn't reachable anymore — it may have been deleted, or you lost admin access to it. Re-link it to keep publishing ads.`,
            fix: { kind: 'page_link', label: 'Update Page link' },
          });
        }
      } catch {
        checks.push({ id: 'page', label: 'Facebook Page', status: 'warn', detail: 'Could not verify Page.' });
      }
    } else {
      checks.push({
        id: 'page',
        label: 'Facebook Page',
        status: 'skip',
        detail: 'No Page linked. Some ad placements (Page posts) are unavailable.',
      });
    }

    // ----- 6. Instagram account -----
    // IG can be linked at multiple levels and the field names differ:
    //   - Page → instagram_business_account (IG Business/Creator account)
    //   - Page → connected_instagram_account (personal IG linked via Page settings)
    //   - Ad account → /act_X/instagram_accounts (BM-level link)
    //   - Business Manager → /{biz}/instagram_accounts
    // User access tokens often return null for IG fields when instagram_basic
    // isn't granted — using a Page Access Token is far more reliable.
    let pageAccessToken: string | null = null;
    if (brand.page_id) {
      try {
        const accountsRes = await fetch(
          `https://graph.facebook.com/v25.0/me/accounts?fields=id,access_token&limit=200&access_token=${token}`
        );
        const accountsData = await accountsRes.json();
        if (accountsRes.ok && Array.isArray(accountsData?.data)) {
          const match = accountsData.data.find((p: any) => String(p.id) === String(brand.page_id));
          if (match?.access_token) pageAccessToken = match.access_token;
        }
      } catch { /* non-fatal */ }
    }

    let pageIg: { id: string; username: string | null; via: 'business' | 'connected' } | null = null;
    if (brand.page_id) {
      const fields = 'instagram_business_account{id,username},connected_instagram_account{id,username}';
      const tokensToTry = [pageAccessToken, token].filter(Boolean) as string[];
      for (const tk of tokensToTry) {
        try {
          const r = await fetch(`https://graph.facebook.com/v25.0/${brand.page_id}?fields=${fields}&access_token=${tk}`);
          const d = await r.json();
          if (r.ok) {
            if (d?.instagram_business_account?.id) {
              pageIg = {
                id: d.instagram_business_account.id,
                username: d.instagram_business_account.username || null,
                via: 'business',
              };
              break;
            }
            if (d?.connected_instagram_account?.id) {
              pageIg = {
                id: d.connected_instagram_account.id,
                username: d.connected_instagram_account.username || null,
                via: 'connected',
              };
              break;
            }
          }
        } catch { /* try next token */ }
      }
    }

    let adAccountIgs: Array<{ id: string; username: string | null }> = [];
    if (brand.meta_account_id) {
      try {
        const adId = String(brand.meta_account_id).startsWith('act_')
          ? brand.meta_account_id
          : `act_${brand.meta_account_id}`;
        const r = await fetch(`https://graph.facebook.com/v25.0/${adId}/instagram_accounts?fields=id,username&access_token=${token}`);
        const d = await r.json();
        if (r.ok && Array.isArray(d?.data)) {
          adAccountIgs = d.data.map((ig: any) => ({ id: ig.id, username: ig.username || null }));
        }
      } catch { /* non-fatal */ }
    }

    // Last-resort: if we still have no IG, scan business managers the user owns
    // — IG may be linked at the BM level only (common with agencies).
    let bmIgs: Array<{ id: string; username: string | null }> = [];
    if (!pageIg && adAccountIgs.length === 0) {
      try {
        const bizRes = await fetch(`https://graph.facebook.com/v25.0/me/businesses?fields=id&limit=50&access_token=${token}`);
        const bizData = await bizRes.json();
        if (bizRes.ok && Array.isArray(bizData?.data)) {
          for (const biz of bizData.data.slice(0, 10)) {
            try {
              const igRes = await fetch(`https://graph.facebook.com/v25.0/${biz.id}/instagram_accounts?fields=id,username&access_token=${token}`);
              const igData = await igRes.json();
              if (igRes.ok && Array.isArray(igData?.data)) {
                for (const ig of igData.data) {
                  if (!bmIgs.some(x => x.id === ig.id)) {
                    bmIgs.push({ id: ig.id, username: ig.username || null });
                  }
                }
              }
            } catch { /* skip this BM */ }
          }
        }
      } catch { /* non-fatal */ }
    }

    const pageIgInAdAccount = !!(pageIg && adAccountIgs.some(ig => ig.id === pageIg!.id));
    const adAccountHasAnyIg = adAccountIgs.length > 0;
    const pageLabel = brand.page_name ? `your "${brand.page_name}" Page` : 'your Facebook Page';

    if (pageIg && pageIgInAdAccount) {
      // Best case — linked at Page AND ad account.
      const display = pageIg.username ? `@${pageIg.username}` : (brand.instagram_account_name || 'Linked');
      checks.push({
        id: 'instagram',
        label: 'Instagram account',
        status: 'pass',
        detail: `${display} — linked through ${pageLabel}.`,
      });
      m.instagramUsername = pageIg.username;
      m.instagramName = brand.instagram_account_name || null;
      m.instagramLinkedPageId = brand.page_id;
      m.instagramLinkedPageName = brand.page_name;
    } else if (pageIg && !pageIgInAdAccount) {
      // Linked to Page, not to ad account — the most common gotcha.
      m.igMismatch = { pageIgId: pageIg.id, pageIgUsername: pageIg.username };
      m.instagramLinkedPageId = brand.page_id;
      m.instagramLinkedPageName = brand.page_name;
      const display = pageIg.username ? `@${pageIg.username}` : 'Your Instagram';
      checks.push({
        id: 'instagram',
        label: 'Instagram on ad account',
        status: 'warn',
        detail: `${display} is linked through ${pageLabel}, but isn't added to your ad account yet — that's why ads can't use it. One click fixes it.`,
        fix: { kind: 'ig_link', label: 'Connect it for me' },
      });
    } else if (adAccountHasAnyIg) {
      // No Page-level link visible (often a permissions issue) but the ad
      // account itself has an IG — that's enough to run ads.
      const display = adAccountIgs[0].username
        ? `@${adAccountIgs[0].username}`
        : (brand.instagram_account_name || 'Linked');
      checks.push({
        id: 'instagram',
        label: 'Instagram account',
        status: 'pass',
        detail: `${display} — linked at the ad-account level.`,
      });
      m.instagramUsername = adAccountIgs[0].username;
      m.instagramName = brand.instagram_account_name || null;
    } else if (bmIgs.length > 0) {
      // Visible at Business Manager but not attached to Page or ad account.
      const display = bmIgs[0].username ? `@${bmIgs[0].username}` : 'Your Instagram';
      checks.push({
        id: 'instagram',
        label: 'Instagram on ad account',
        status: 'warn',
        detail: `${display} is in your Business Manager but isn't added to ${pageLabel} or your ad account yet. Connect it in Meta to use it for ads.`,
      });
      m.instagramUsername = bmIgs[0].username;
    } else {
      checks.push({
        id: 'instagram',
        label: 'Instagram account',
        status: 'skip',
        detail: brand.page_id
          ? `No Instagram detected on ${pageLabel}. If you have one connected on Meta's side, reconnect Lumi and grant instagram_basic so we can see it.`
          : 'No Instagram linked. Optional — only needed for IG-targeted ads.',
      });
    }


    // ----- 7. Pixel -----
    if (!brand.meta_pixel_id) {
      checks.push({
        id: 'pixel',
        label: 'Tracking pixel',
        status: 'warn',
        detail: "No pixel configured. Lumi can run ads but can't track conversions until a pixel is installed on your landing page.",
        fix: { kind: 'pixel_setup', label: 'Set up pixel' },
      });
    } else {
      // We have a pixel ID. Check it's active + has recent events.
      try {
        const r = await fetch(`https://graph.facebook.com/v25.0/${brand.meta_pixel_id}?fields=id,name,last_fired_time&access_token=${token}`);
        const d = await r.json();
        if (r.ok && d?.id) {
          const lastFired = d.last_fired_time ? new Date(d.last_fired_time) : null;
          const stale = lastFired ? (now.getTime() - lastFired.getTime()) > 7 * 24 * 60 * 60 * 1000 : true;
          if (lastFired && !stale) {
            checks.push({
              id: 'pixel',
              label: 'Tracking pixel',
              status: 'pass',
              detail: `${d.name || brand.meta_pixel_name || 'Pixel'} — last event ${lastFired.toLocaleString()}`,
            });
          } else if (lastFired && stale) {
            checks.push({
              id: 'pixel',
              label: 'Tracking pixel',
              status: 'warn',
              detail: `Pixel hasn't fired in over 7 days (last event ${lastFired.toLocaleDateString()}). Either traffic dried up or the pixel got removed from your landing page.`,
              fix: { kind: 'pixel_setup', label: 'Re-verify pixel' },
            });
          } else {
            checks.push({
              id: 'pixel',
              label: 'Tracking pixel',
              status: 'warn',
              detail: `${d.name || brand.meta_pixel_name || 'Pixel'} configured but no events recorded yet. Send a test event from your landing page to verify install.`,
              fix: { kind: 'pixel_setup', label: 'Verify install' },
            });
          }
          m.pixelId = d.id; m.pixelName = d.name;
        } else {
          checks.push({
            id: 'pixel',
            label: 'Tracking pixel',
            status: 'fail',
            detail: `Stored pixel ID ${brand.meta_pixel_id} is unreachable.`,
            fix: { kind: 'pixel_setup', label: 'Re-link pixel' },
          });
        }
      } catch {
        checks.push({ id: 'pixel', label: 'Tracking pixel', status: 'warn', detail: 'Could not verify pixel.' });
      }
    }

    // ----- 8. Roll up to overall status + headline summary + primary action -----
    const failCount = checks.filter(c => c.status === 'fail').length;
    const warnCount = checks.filter(c => c.status === 'warn').length;

    let overallStatus: 'healthy' | 'limited' | 'broken';
    let summary: string;
    let primaryAction: ActionHint | null = null;

    if (failCount > 0) {
      overallStatus = 'broken';
      const first = checks.find(c => c.status === 'fail' && c.fix);
      primaryAction = first?.fix || { kind: 'reconnect', label: 'Reconnect Meta' };
      summary = failCount === 1
        ? `One thing needs fixing before Lumi can run ads on this account.`
        : `${failCount} things need fixing before Lumi can run ads on this account.`;
    } else if (warnCount > 0) {
      overallStatus = 'limited';
      const first = checks.find(c => c.status === 'warn' && c.fix);
      primaryAction = first?.fix || null;
      summary = warnCount === 1
        ? `Lumi can run ads, but one thing's worth tightening up.`
        : `Lumi can run ads, but ${warnCount} things are worth tightening up.`;
    } else {
      overallStatus = 'healthy';
      summary = `Your Meta connection is healthy and Lumi can run ads on this account.`;
    }

    return json({
      success: true,
      overallStatus,
      summary,
      checks,
      primaryAction,
      meta: m,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('check-meta-setup error:', err);
    return json({ error: err?.message || 'Unknown error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
