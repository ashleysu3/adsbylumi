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

    // Build a public embed thumbnail URL (works without API access)
    // Instagram's /media endpoint returns the image for public posts
    const thumbnail_url = `https://www.instagram.com/${type}/${shortcode}/media/?size=m`;

    console.log('[resolve-instagram-post] Resolved:', { type, shortcode, permalink });

    return new Response(
      JSON.stringify({
        shortcode,
        permalink,
        thumbnail_url,
        media_type: type === 'reel' ? 'VIDEO' : 'IMAGE',
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
