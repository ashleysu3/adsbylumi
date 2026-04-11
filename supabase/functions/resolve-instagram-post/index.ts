import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Instagram post URL is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const igUrlPattern = /instagram\.com\/(p|reel|tv)\/([\w-]+)/i;
    const match = url.match(igUrlPattern);
    if (!match) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid Instagram post, reel, or video URL' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const type = match[1];
    const shortcode = match[2];
    const permalink = `https://www.instagram.com/${type}/${shortcode}/`;

    let thumbnail_url: string | null = null;
    let author_name: string | null = null;
    let title: string | null = null;

    // Fetch the Instagram post page directly — IG serves og:image in SSR HTML
    try {
      const pageRes = await fetch(permalink, {
        headers: {
          'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          'Accept': 'text/html',
        },
        redirect: 'follow',
      });

      if (pageRes.ok) {
        const html = await pageRes.text();

        // Extract og:image — Instagram always includes this in SSR
        const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/i)
          || html.match(/content="([^"]+)"\s+property="og:image"/i);
        if (ogImageMatch) {
          thumbnail_url = ogImageMatch[1].replace(/&amp;/g, '&');
          console.log('[resolve-instagram-post] Got og:image thumbnail');
        }

        // Extract og:description for caption preview
        const ogDescMatch = html.match(/property="og:description"\s+content="([^"]+)"/i)
          || html.match(/content="([^"]+)"\s+property="og:description"/i);
        if (ogDescMatch) {
          // Instagram og:description format: "N Likes, N Comments - @username on Instagram: "caption""
          const descText = ogDescMatch[1].replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"');
          title = descText;

          // Try to extract username
          const userMatch = descText.match(/@(\w+)\s+on\s+Instagram/i);
          if (userMatch) {
            author_name = userMatch[1];
          }
        }
      } else {
        console.warn('[resolve-instagram-post] Page fetch returned', pageRes.status);
      }
    } catch (fetchErr) {
      console.warn('[resolve-instagram-post] Page fetch error:', fetchErr);
    }

    // Fallback thumbnail
    if (!thumbnail_url) {
      thumbnail_url = `https://www.instagram.com/${type}/${shortcode}/media/?size=m`;
    }

    console.log('[resolve-instagram-post] Resolved:', { type, shortcode, has_real_thumb: thumbnail_url.includes('cdninstagram') || thumbnail_url.includes('fbcdn') });

    return new Response(
      JSON.stringify({
        shortcode,
        permalink,
        thumbnail_url,
        media_type: type === 'reel' ? 'VIDEO' : 'IMAGE',
        author_name,
        caption: title || '',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('[resolve-instagram-post] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to resolve Instagram post' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
