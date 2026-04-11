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

    // Use Firecrawl to scrape the post page and extract og:image + meta tags
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (firecrawlApiKey) {
      try {
        const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: permalink,
            formats: ['html'],
            onlyMainContent: false,
            waitFor: 2000,
          }),
        });

        const scrapeData = await scrapeRes.json();

        if (scrapeRes.ok && scrapeData.success) {
          const html = scrapeData.data?.html || scrapeData.html || '';
          
          // Extract og:image
          const ogImageMatch = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i)
            || html.match(/content="([^"]+)"\s+(?:property|name)="og:image"/i);
          if (ogImageMatch) {
            thumbnail_url = ogImageMatch[1];
          }

          // Extract og:title for caption
          const ogTitleMatch = html.match(/<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/i)
            || html.match(/content="([^"]+)"\s+(?:property|name)="og:title"/i);
          if (ogTitleMatch) {
            title = ogTitleMatch[1];
          }

          // Extract og:description as fallback caption
          if (!title) {
            const ogDescMatch = html.match(/<meta\s+(?:property|name)="og:description"\s+content="([^"]+)"/i)
              || html.match(/content="([^"]+)"\s+(?:property|name)="og:description"/i);
            if (ogDescMatch) {
              title = ogDescMatch[1];
            }
          }

          // Extract author from page title or meta
          const authorMatch = html.match(/<meta\s+(?:property|name)="og:title"\s+content="[^"]*@(\w+)[^"]*"/i);
          if (authorMatch) {
            author_name = authorMatch[1];
          }

          console.log('[resolve-instagram-post] Firecrawl scraped:', {
            has_thumbnail: !!thumbnail_url,
            has_title: !!title,
            author_name,
          });
        } else {
          console.warn('[resolve-instagram-post] Firecrawl failed:', scrapeData.error || 'unknown');
        }
      } catch (e) {
        console.warn('[resolve-instagram-post] Firecrawl error:', e);
      }
    }

    // Fallback thumbnail
    if (!thumbnail_url) {
      thumbnail_url = `https://www.instagram.com/${type}/${shortcode}/media/?size=m`;
    }

    console.log('[resolve-instagram-post] Resolved:', { type, shortcode, has_thumb: !!thumbnail_url });

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
