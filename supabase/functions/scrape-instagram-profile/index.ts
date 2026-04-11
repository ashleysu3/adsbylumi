import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username } = await req.json();

    if (!username || typeof username !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Instagram username is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const cleanUsername = username.replace(/^@/, '').trim();
    if (!cleanUsername) {
      return new Response(
        JSON.stringify({ error: 'Invalid username' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ error: 'Scraping service not configured', posts: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[scrape-instagram-profile] Scraping profile: @${cleanUsername}`);

    const profileUrl = `https://www.instagram.com/${cleanUsername}/`;

    const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: profileUrl,
        formats: ['html', 'links'],
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeRes.json();

    if (!scrapeRes.ok || !scrapeData.success) {
      console.warn('[scrape-instagram-profile] Firecrawl cannot scrape Instagram:', scrapeData.error || 'unknown');
      // Return empty posts gracefully — frontend will show URL paste fallback
      return new Response(
        JSON.stringify({
          username: cleanUsername,
          posts: [],
          source: 'firecrawl',
          fallback: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const html = scrapeData.data?.html || scrapeData.html || '';
    const links = scrapeData.data?.links || scrapeData.links || [];

    // Extract post URLs from links
    const postUrlPattern = /instagram\.com\/(p|reel|tv)\/([\w-]+)/;
    const seenShortcodes = new Set<string>();
    const posts: Array<{
      shortcode: string;
      permalink: string;
      thumbnail_url: string;
      media_type: string;
    }> = [];

    // First extract from links array
    for (const link of links) {
      const linkStr = typeof link === 'string' ? link : link?.url || link?.href || '';
      const match = linkStr.match(postUrlPattern);
      if (match && !seenShortcodes.has(match[2])) {
        seenShortcodes.add(match[2]);
        const type = match[1];
        const shortcode = match[2];
        posts.push({
          shortcode,
          permalink: `https://www.instagram.com/${type}/${shortcode}/`,
          thumbnail_url: `https://www.instagram.com/${type}/${shortcode}/media/?size=m`,
          media_type: type === 'reel' ? 'VIDEO' : 'IMAGE',
        });
      }
    }

    // Also extract from HTML if links didn't yield enough
    if (posts.length < 12) {
      const htmlMatches = html.matchAll(/instagram\.com\/(p|reel|tv)\/([\w-]+)/gi);
      for (const match of htmlMatches) {
        if (!seenShortcodes.has(match[2]) && posts.length < 18) {
          seenShortcodes.add(match[2]);
          const type = match[1];
          const shortcode = match[2];
          posts.push({
            shortcode,
            permalink: `https://www.instagram.com/${type}/${shortcode}/`,
            thumbnail_url: `https://www.instagram.com/${type}/${shortcode}/media/?size=m`,
            media_type: type === 'reel' ? 'VIDEO' : 'IMAGE',
          });
        }
      }
    }

    // Try to extract thumbnail URLs from og:image meta tags or JSON-LD in HTML
    // Instagram embeds image URLs in the page source
    const ogImageMatches = html.matchAll(/content="(https:\/\/[^"]*?cdninstagram[^"]*?)"/gi);
    const cdnImages: string[] = [];
    for (const m of ogImageMatches) {
      cdnImages.push(m[1]);
    }

    // Also look for image URLs in JSON data within the HTML
    const jsonImageMatches = html.matchAll(/"(https:\/\/[^"]*?cdninstagram\.com[^"]*?)"/gi);
    for (const m of jsonImageMatches) {
      if (!cdnImages.includes(m[1])) {
        cdnImages.push(m[1]);
      }
    }

    // Assign CDN thumbnails to posts if available
    for (let i = 0; i < Math.min(posts.length, cdnImages.length); i++) {
      posts[i].thumbnail_url = cdnImages[i];
    }

    console.log(`[scrape-instagram-profile] Found ${posts.length} posts for @${cleanUsername}`);

    return new Response(
      JSON.stringify({
        username: cleanUsername,
        posts: posts.slice(0, 18),
        source: 'firecrawl',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('[scrape-instagram-profile] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to scrape profile', posts: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
