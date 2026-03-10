import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

interface PixelDetectionResult {
  pixelIds: string[];
  hasMetaPixel: boolean;
  hasEventsCode: boolean;
  detectedEvents: string[];
  rawMatches: string[];
}

function detectPixelInHtml(html: string): PixelDetectionResult {
  const pixelIds: string[] = [];
  const detectedEvents: string[] = [];
  const rawMatches: string[] = [];

  // Pattern 1: fbq('init', 'PIXEL_ID')
  const initPattern = /fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/gi;
  let match;
  while ((match = initPattern.exec(html)) !== null) {
    if (!pixelIds.includes(match[1])) {
      pixelIds.push(match[1]);
      rawMatches.push(match[0]);
    }
  }

  // Pattern 2: data-pixel-id="PIXEL_ID" (some integrations)
  const dataPattern = /data-pixel-id\s*=\s*['"](\d+)['"]/gi;
  while ((match = dataPattern.exec(html)) !== null) {
    if (!pixelIds.includes(match[1])) {
      pixelIds.push(match[1]);
      rawMatches.push(match[0]);
    }
  }

  // Pattern 3: _fbq.push(['track', 'PIXEL_ID', ...]) (legacy)
  const legacyPattern = /_fbq\.push\s*\(\s*\[\s*['"]track['"]\s*,\s*['"](\d+)['"]/gi;
  while ((match = legacyPattern.exec(html)) !== null) {
    if (!pixelIds.includes(match[1])) {
      pixelIds.push(match[1]);
      rawMatches.push(match[0]);
    }
  }

  // Check for fbevents.js script
  const hasMetaPixel = html.includes('connect.facebook.net') && 
    (html.includes('fbevents.js') || html.includes('fbq'));

  // Detect tracked events
  const eventPattern = /fbq\s*\(\s*['"]track['"]\s*,\s*['"]([^'"]+)['"]/gi;
  while ((match = eventPattern.exec(html)) !== null) {
    if (!detectedEvents.includes(match[1])) {
      detectedEvents.push(match[1]);
    }
  }

  // Check for standard events in various formats
  const standardEvents = ['Purchase', 'Lead', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'CompleteRegistration'];
  for (const event of standardEvents) {
    if (html.includes(`'${event}'`) || html.includes(`"${event}"`)) {
      if (!detectedEvents.includes(event)) {
        detectedEvents.push(event);
      }
    }
  }

  return {
    pixelIds,
    hasMetaPixel,
    hasEventsCode: detectedEvents.length > 0,
    detectedEvents,
    rawMatches
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId, url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL format
    let validUrl: URL;
    try {
      validUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Verifying pixel on URL:', validUrl.toString());

    // Fetch the page HTML
    const pageResponse = await fetch(validUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    if (!pageResponse.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to fetch page: ${pageResponse.status} ${pageResponse.statusText}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await pageResponse.text();
    console.log(`Fetched ${html.length} bytes of HTML`);

    // Detect pixel in HTML
    const detection = detectPixelInHtml(html);
    console.log('Pixel detection result:', detection);

    // If brand ID provided, check if detected pixels match brand's ad account
    let matchesBrand = false;
    let brandPixelId: string | null = null;

    if (brandId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: brand } = await supabase
        .from('brands')
        .select('meta_pixel_id, meta_account_id, meta_access_token')
        .eq('id', brandId)
        .single();

      if (brand?.meta_pixel_id) {
        brandPixelId = brand.meta_pixel_id;
        matchesBrand = detection.pixelIds.includes(brand.meta_pixel_id);
      }

      // If we have an access token, try to fetch pixels to compare
      if (!matchesBrand && brand?.meta_account_id) {
        // Read token directly (service-role context lacks auth.uid() for vault RPC)
        const accessToken = brand.meta_access_token;
        
        if (accessToken) {
          const adAccountId = brand.meta_account_id.startsWith('act_') 
            ? brand.meta_account_id 
            : `act_${brand.meta_account_id}`;
          
          const pixelsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/adspixels?fields=id&access_token=${accessToken}`;
          const pixelsResponse = await fetch(pixelsUrl);
          const pixelsData = await pixelsResponse.json();

          if (pixelsData.data) {
            const accountPixelIds = pixelsData.data.map((p: { id: string }) => p.id);
            matchesBrand = detection.pixelIds.some(id => accountPixelIds.includes(id));
          }
        }
      }
    }

    // Determine overall status
    let status: 'success' | 'warning' | 'error' = 'error';
    let message = '';

    if (!detection.hasMetaPixel && detection.pixelIds.length === 0) {
      status = 'error';
      message = 'No Meta Pixel detected on this page';
    } else if (detection.pixelIds.length > 0 && brandId && !matchesBrand) {
      status = 'warning';
      message = 'Meta Pixel found but it doesn\'t match your ad account';
    } else if (detection.pixelIds.length > 0) {
      status = 'success';
      message = matchesBrand 
        ? 'Your Meta Pixel is installed correctly' 
        : 'Meta Pixel detected on this page';
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: validUrl.toString(),
        status,
        message,
        detection: {
          hasPixel: detection.hasMetaPixel || detection.pixelIds.length > 0,
          pixelIds: detection.pixelIds,
          matchesBrand,
          brandPixelId,
          detectedEvents: detection.detectedEvents,
          hasEventTracking: detection.detectedEvents.length > 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-landing-page-pixel:', error);
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to verify landing page' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
