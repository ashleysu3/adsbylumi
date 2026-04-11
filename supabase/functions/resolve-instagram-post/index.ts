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

    // Validate it looks like an Instagram URL
    const igUrlPattern = /instagram\.com\/(p|reel|tv)\/([\w-]+)/i;
    const match = url.match(igUrlPattern);
    if (!match) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid Instagram post, reel, or video URL' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const type = match[1]; // p, reel, or tv
    const shortcode = match[2];
    const permalink = `https://www.instagram.com/${type}/${shortcode}/`;

    // Try to get a real thumbnail via Instagram oEmbed APIs
    let thumbnail_url: string | null = null;
    let author_name: string | null = null;
    let title: string | null = null;

    // Method 1: Public Instagram oEmbed endpoint (no API key needed)
    try {
      const publicOembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(permalink)}&omitscript=true`;
      const publicRes = await fetch(publicOembedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (publicRes.ok) {
        const publicData = await publicRes.json();
        thumbnail_url = publicData.thumbnail_url || null;
        author_name = publicData.author_name || null;
        title = publicData.title || null;
        console.log('[resolve-instagram-post] Public oEmbed success:', { author_name, has_thumbnail: !!thumbnail_url });
      } else {
        console.warn('[resolve-instagram-post] Public oEmbed returned', publicRes.status);
      }
    } catch (e) {
      console.warn('[resolve-instagram-post] Public oEmbed error:', e);
    }

    // Method 2: Graph API oEmbed (requires Meta oEmbed Read feature)
    if (!thumbnail_url) {
      const appId = Deno.env.get('META_APP_ID');
      const appSecret = Deno.env.get('META_APP_SECRET');

      if (appId && appSecret) {
        try {
          const oembedUrl = `https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(permalink)}&access_token=${appId}|${appSecret}`;
          const oembedRes = await fetch(oembedUrl);
          const oembedData = await oembedRes.json();

          if (oembedRes.ok && !oembedData.error) {
            thumbnail_url = oembedData.thumbnail_url || null;
            author_name = author_name || oembedData.author_name || null;
            title = title || oembedData.title || null;
            console.log('[resolve-instagram-post] Graph oEmbed success');
          } else {
            console.warn('[resolve-instagram-post] Graph oEmbed failed:', oembedData.error?.message || 'unknown');
          }
        } catch (oembedErr) {
          console.warn('[resolve-instagram-post] Graph oEmbed error:', oembedErr);
        }
      }
    }

    // Fallback thumbnail URL if oEmbed didn't work
    if (!thumbnail_url) {
      thumbnail_url = `https://www.instagram.com/${type}/${shortcode}/media/?size=m`;
    }

    console.log('[resolve-instagram-post] Resolved:', { type, shortcode, permalink, has_oembed_thumb: !!thumbnail_url });

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
