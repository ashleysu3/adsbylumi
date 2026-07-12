import { getCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Grab a brand's Instagram profile picture for the ad's feed-post avatar.
// Instagram CDN URLs are hotlink-protected and expiring, so a browser <img>
// pointed at one would fail — the whole job of this function is to download
// the picture SERVER-SIDE (no hotlink/CORS problem here) and re-host it in
// our own bucket, returning a stable signed URL the kit page can render for
// any visitor. Best-effort: if we can't get a real photo, we return
// { url: null } and the frontend falls back to the brand logo.

const BUCKET = 'lead-magnet-assets';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { headers: { ...cors, 'Content-Type': 'application/json' }, status });

  try {
    const { brandId, username } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Resolve the handle — from the request, else off the brand row.
    let handle = String(username || '').replace(/^@/, '').replace(/\/+$/, '').trim();
    if (!handle && brandId) {
      const { data: brand } = await supabase
        .from('brands')
        .select('instagram_account_name')
        .eq('id', brandId)
        .maybeSingle();
      handle = String(brand?.instagram_account_name || '').replace(/^@/, '').replace(/\/+$/, '').trim();
    }
    if (!handle) return json({ url: null, reason: 'no handle' });

    // --- Find the profile-pic URL, then download it. ---
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    let picUrl = '';

    // 1) Instagram's public web-profile endpoint returns profile_pic_url_hd
    //    directly as JSON. Cleanest source; the x-ig-app-id is the standard
    //    public web app id.
    try {
      const r = await fetch(
        `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
        { headers: { 'User-Agent': UA, 'x-ig-app-id': '936619743392459' } },
      );
      if (r.ok) {
        const data = await r.json().catch(() => null);
        const user = data?.data?.user;
        picUrl = user?.profile_pic_url_hd || user?.profile_pic_url || '';
      }
    } catch (_) { /* fall through */ }

    // 2) Fall back to scraping the profile page (Firecrawl is already how we
    //    read IG here) and pulling the pic out of the embedded data.
    if (!picUrl) {
      const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
      if (firecrawlApiKey) {
        try {
          const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: { Authorization: `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: `https://www.instagram.com/${handle}/`, formats: ['html'], waitFor: 3000 }),
          });
          const scrapeData = await scrapeRes.json().catch(() => ({}));
          const html: string = scrapeData?.data?.html || scrapeData?.html || '';
          const unesc = (s: string) => s.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
          const hd = html.match(/"profile_pic_url_hd":"([^"]+)"/);
          const sd = html.match(/"profile_pic_url":"([^"]+)"/);
          const og = html.match(/property="og:image"[^>]*content="([^"]+)"/i) ||
            html.match(/content="([^"]+)"[^>]*property="og:image"/i);
          if (hd) picUrl = unesc(hd[1]);
          else if (sd) picUrl = unesc(sd[1]);
          else if (og && /cdninstagram|fbcdn/.test(og[1])) picUrl = og[1];
        } catch (_) { /* fall through */ }
      }
    }

    if (!picUrl) return json({ url: null, reason: 'no pic url found', handle });

    // Download the CDN image server-side — no hotlink/CORS problem here,
    // which is the whole reason this can't happen in the browser.
    let bytes: Uint8Array | null = null;
    let contentType = 'image/jpeg';
    try {
      const r = await fetch(picUrl, { headers: { 'User-Agent': UA } });
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      if (r.ok && ct.startsWith('image/')) {
        const buf = new Uint8Array(await r.arrayBuffer());
        if (buf.length > 1024) {
          bytes = buf;
          contentType = ct;
        }
      }
    } catch (_) { /* fall through */ }

    if (!bytes) return json({ url: null, reason: 'download failed', handle });

    // --- Re-host it. Deterministic path per brand so re-runs overwrite
    //     rather than pile up. Service role bypasses the bucket's owner-only
    //     write policy. ---
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `ig-avatars/${brandId || handle}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: true, cacheControl: '31536000' });
    if (upErr) return json({ url: null, reason: `upload failed: ${upErr.message}` });

    // The bucket is private on Lovable, so a signed URL (not a public one) is
    // what actually loads for the sessionless kit-page visitor.
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    return json({ url: signed?.signedUrl || null, handle });
  } catch (e) {
    return json({ url: null, error: String((e as Error)?.message || e) });
  }
});
