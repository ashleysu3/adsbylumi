import { getCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// ============================================================================
// fetch-reference-video
//
// Admin helper for the Overlay Templates page. Takes a URL, server-side
// fetches the video bytes, uploads them to the `creative-assets` bucket
// under `overlay-templates/`, and returns the public URL + storage path.
//
// What this enables:
//   - Direct video URLs (any CDN, signed S3, Dropbox direct links, etc.)
//     work reliably.
//   - Instagram / TikTok PAGE URLs (e.g. https://www.instagram.com/reel/...)
//     are attempted via OpenGraph meta-tag extraction. This works when
//     the platform serves the og:video tag to anonymous requests, and
//     fails politely when they hide it behind a login wall (which IG
//     increasingly does). When it fails we return a clear error message
//     so the admin knows to download + re-upload manually.
//
// Limits:
//   - 50 MB max response size. IG reels are typically 5–30 MB.
//   - 30 second fetch timeout. Most fetches finish in seconds.
//   - Service role used to write to storage so RLS doesn't block the
//     write. The route is admin-only at the UI layer; anyone with the
//     anon key can hit this endpoint, so the admin check matters before
//     this lands in production.
// ============================================================================

const MAX_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return json({ ok: false, error: 'Missing url' }, 200, corsHeaders);
    }
    if (!/^https:\/\//i.test(url)) {
      return json({ ok: false, error: 'URL must start with https://' }, 200, corsHeaders);
    }

    // Resolve the actual video URL. If the user pasted a page URL (e.g.
    // an IG reel URL that returns HTML), try to find an og:video meta tag
    // and use that. Direct video URLs skip this step.
    const resolved = await resolveVideoUrl(url);
    if (!resolved.ok) {
      // Return 200 with a fallback flag so the frontend can show a friendly
      // "upload manually instead" message rather than a generic error toast.
      return json(
        {
          ok: false,
          fallback: true,
          error: resolved.error,
          hint:
            'For Instagram / TikTok page URLs, this often fails because the platform hides the video URL from anonymous requests. ' +
            'Workaround: open the post in your browser, save the video to your device (or an MP4 link service), ' +
            'and either upload directly or paste the resulting direct video URL here.',
        },
        200,
        corsHeaders,
      );
    }

    // Fetch the video bytes with a timeout + size cap.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let bytes: Uint8Array;
    let contentType = 'video/mp4';
    try {
      const res = await fetch(resolved.videoUrl, {
        signal: controller.signal,
        headers: {
          // Some CDNs (notably IG) serve different content based on UA.
          // A plausible browser UA improves our odds.
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          Accept: 'video/mp4,video/*;q=0.9,*/*;q=0.5',
        },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return json(
          {
            ok: false,
            fallback: true,
            error: `Source returned ${res.status}. URL may be expired, private, or rate-limited.`,
          },
          200,
          corsHeaders,
        );
      }

      const ct = res.headers.get('content-type') || '';
      if (!ct.startsWith('video/')) {
        return json(
          {
            ok: false,
            fallback: true,
            error: `URL did not return a video (got "${ct}"). Paste a direct video URL (.mp4 / .mov), not a webpage URL.`,
          },
          200,
          corsHeaders,
        );
      }
      contentType = ct;

      const cl = res.headers.get('content-length');
      if (cl && parseInt(cl, 10) > MAX_BYTES) {
        return json(
          {
            ok: false,
            error: `Video too large (${(parseInt(cl, 10) / 1024 / 1024).toFixed(1)} MB). Max is 50 MB.`,
          },
          200,
          corsHeaders,
        );
      }

      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) {
        return json({ ok: false, error: `Video too large (>50 MB).` }, 200, corsHeaders);
      }
      bytes = new Uint8Array(buf);
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      if (fetchErr?.name === 'AbortError') {
        return json({ ok: false, error: 'Fetch timed out (30s).' }, 200, corsHeaders);
      }
      return json(
        { ok: false, error: `Fetch failed: ${fetchErr?.message || 'unknown'}` },
        200,
        corsHeaders,
      );
    }

    // Upload to Supabase storage. Service role bypasses RLS — this
    // endpoint already implies trust at the UI layer (admin-only page).
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return json({ ok: false, error: 'Storage configuration missing on this deployment' }, 200, corsHeaders);
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const ext = guessExtension(contentType, resolved.videoUrl);
    const safeName = resolved.videoUrl
      .split('/')
      .pop()
      ?.split('?')[0]
      ?.replace(/[^\w.-]+/g, '_')
      ?.slice(0, 60) || `clip${ext}`;
    const storagePath = `overlay-templates/${Date.now()}-${safeName}`;

    const { error: upErr } = await sb.storage
      .from('creative-assets')
      .upload(storagePath, bytes, { contentType, upsert: false });
    if (upErr) {
      return json({ ok: false, error: `Storage upload failed: ${upErr.message}` }, 200, corsHeaders);
    }

    const { data: urlData } = sb.storage.from('creative-assets').getPublicUrl(storagePath);
    return json(
      { success: true, ok: true, url: urlData.publicUrl, storagePath },
      200,
      corsHeaders,
    );
  } catch (error: any) {
    console.error('fetch-reference-video error:', error);
    return json(
      { ok: false, error: error?.message || 'Unknown error' },
      200,
      getCorsHeaders(req.headers.get('origin')),
    );
  }
});

function json(body: unknown, status: number, headers: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

/**
 * Decide whether a URL points directly at a video, and if not, try to
 * extract a video URL from its HTML (OpenGraph). Returns the best-effort
 * direct video URL or an error.
 */
async function resolveVideoUrl(input: string): Promise<
  { ok: true; videoUrl: string } | { ok: false; error: string }
> {
  // Quick path: extension hints. Skip the HEAD round-trip when the URL
  // obviously points at a video file.
  if (/\.(mp4|mov|webm|m4v)(\?|$)/i.test(input)) {
    return { ok: true, videoUrl: input };
  }

  // HEAD probe — cheap content-type check.
  let headType: string | null = null;
  try {
    const head = await fetch(input, { method: 'HEAD' });
    headType = head.headers.get('content-type');
    if (headType?.startsWith('video/')) {
      return { ok: true, videoUrl: input };
    }
  } catch {
    // Some servers don't allow HEAD. Fall through to GET-as-html attempt.
  }

  // HTML page — try to extract og:video.
  try {
    const res = await fetch(input, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) {
      return { ok: false, error: `Page returned ${res.status} when looking for embedded video.` };
    }
    const html = await res.text();

    // Try og:video first, then og:video:url, then any twitter:player:stream.
    const candidates = [
      /<meta\s+(?:property|name)=["']og:video["'][^>]*content=["']([^"']+)["']/i,
      /<meta\s+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:video["']/i,
      /<meta\s+(?:property|name)=["']og:video:url["'][^>]*content=["']([^"']+)["']/i,
      /<meta\s+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:video:url["']/i,
      /<meta\s+(?:property|name)=["']og:video:secure_url["'][^>]*content=["']([^"']+)["']/i,
      /<meta\s+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:video:secure_url["']/i,
    ];
    for (const re of candidates) {
      const m = html.match(re);
      if (m && m[1]) {
        return { ok: true, videoUrl: decodeHtml(m[1]) };
      }
    }

    return {
      ok: false,
      error:
        "Couldn't find a video on that page. The site is probably hiding it behind a login wall.",
    };
  } catch (err: any) {
    return { ok: false, error: `Could not load page: ${err?.message || 'unknown'}` };
  }
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function guessExtension(contentType: string, url: string): string {
  if (/mp4/.test(contentType)) return '.mp4';
  if (/quicktime/.test(contentType)) return '.mov';
  if (/webm/.test(contentType)) return '.webm';
  const m = url.match(/\.(mp4|mov|webm|m4v)(?:\?|$)/i);
  if (m) return '.' + m[1].toLowerCase();
  return '.mp4';
}
