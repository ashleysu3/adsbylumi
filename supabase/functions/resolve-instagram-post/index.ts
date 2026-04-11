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
    const igUrlPattern = /instagram\.com\/(p|reel|tv)\/[\w-]+/i;
    if (!igUrlPattern.test(url)) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid Instagram post, reel, or video URL' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const META_APP_ID = Deno.env.get('META_APP_ID');
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET');

    if (!META_APP_ID || !META_APP_SECRET) {
      throw new Error('Meta app credentials not configured');
    }

    const appToken = `${META_APP_ID}|${META_APP_SECRET}`;

    // Call the Instagram oEmbed API
    const oembedUrl = new URL('https://graph.facebook.com/v21.0/instagram_oembed');
    oembedUrl.searchParams.set('url', url);
    oembedUrl.searchParams.set('access_token', appToken);
    oembedUrl.searchParams.set('fields', 'thumbnail_url,author_name,html,media_id');

    console.log('[resolve-instagram-post] Resolving URL:', url);

    const oembedResponse = await fetch(oembedUrl.toString());
    const oembedData = await oembedResponse.json();

    if (!oembedResponse.ok || oembedData.error) {
      console.error('[resolve-instagram-post] oEmbed error:', oembedData);
      const msg = oembedData?.error?.message || 'Could not resolve this Instagram post. Make sure the post is public.';
      return new Response(
        JSON.stringify({ error: msg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Extract the shortcode from the URL for reference
    const shortcodeMatch = url.match(/\/(p|reel|tv)\/([\w-]+)/);
    const shortcode = shortcodeMatch?.[2] || null;

    const result = {
      thumbnail_url: oembedData.thumbnail_url || null,
      author_name: oembedData.author_name || null,
      media_id: oembedData.media_id || null,
      shortcode,
      permalink: url.split('?')[0], // clean URL
    };

    console.log('[resolve-instagram-post] Resolved:', { author: result.author_name, media_id: result.media_id, shortcode });

    return new Response(
      JSON.stringify(result),
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
