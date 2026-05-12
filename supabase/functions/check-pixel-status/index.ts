import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

interface PixelEventStats {
  event: string;
  count: number;
}

interface PixelData {
  id: string;
  name: string;
  events: Record<string, { active: boolean; count_7d: number }>;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId } = await req.json();

    if (!brandId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Brand ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get brand data
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('meta_account_id, meta_access_token')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      console.error('Error fetching brand:', brandError);
      return new Response(
        JSON.stringify({ success: false, error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!brand.meta_account_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Meta account not connected',
          needsConnection: true 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = brand.meta_access_token;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Meta access token not found. Please reconnect your Meta account.',
          needsConnection: true 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const adAccountId = brand.meta_account_id.startsWith('act_') 
      ? brand.meta_account_id 
      : `act_${brand.meta_account_id}`;

    console.log('Fetching pixels for ad account:', adAccountId);

    // Fetch all pixels connected to the ad account
    const pixelsUrl = `https://graph.facebook.com/v25.0/${adAccountId}/adspixels?fields=id,name&access_token=${accessToken}`;
    const pixelsResponse = await fetch(pixelsUrl);
    const pixelsData = await pixelsResponse.json();

    if (pixelsData.error) {
      console.error('Meta API error fetching pixels:', pixelsData.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: pixelsData.error.message || 'Failed to fetch pixels' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pixels: PixelData[] = [];
    const targetEvents = ['Purchase', 'Lead', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'CompleteRegistration'];

    // For each pixel, fetch event stats
    for (const pixel of pixelsData.data || []) {
      console.log(`Fetching stats for pixel ${pixel.id}: ${pixel.name}`);
      
      // Get event stats for the last 7 days using the correct endpoint
      const statsUrl = `https://graph.facebook.com/v25.0/${pixel.id}/stats?aggregation=event&access_token=${accessToken}`;
      const statsResponse = await fetch(statsUrl);
      const statsData = await statsResponse.json();

      console.log(`Pixel ${pixel.id} stats response:`, JSON.stringify(statsData).slice(0, 500));

      const events: Record<string, { active: boolean; count_7d: number }> = {};
      
      // Initialize all target events as inactive
      for (const event of targetEvents) {
        events[event] = { active: false, count_7d: 0 };
      }

      // Process the stats data - Meta returns hourly buckets with nested event entries:
      // { data: [{ start_time, aggregation: "event", data: [{ value: "Lead", count: 10 }, ...] }, ...] }
      // The inner `value` is the event NAME and `count` is the occurrence count for that bucket.
      // We aggregate counts across all buckets per event name.
      const eventTotals: Record<string, number> = {};
      if (statsData.data && Array.isArray(statsData.data)) {
        for (const bucket of statsData.data) {
          // New format: bucket has nested data array with { value: eventName, count }
          if (bucket.data && Array.isArray(bucket.data)) {
            for (const entry of bucket.data) {
              const eventName = typeof entry.value === 'string' ? entry.value : entry.event;
              const count = typeof entry.count === 'number' ? entry.count : (typeof entry.value === 'number' ? entry.value : 0);
              if (eventName && typeof eventName === 'string') {
                eventTotals[eventName] = (eventTotals[eventName] || 0) + count;
              }
            }
          } else if (bucket.event) {
            // Legacy/flat format fallback
            const count = bucket.count || bucket.value || 0;
            eventTotals[bucket.event] = (eventTotals[bucket.event] || 0) + count;
          }
        }
      }

      for (const event of targetEvents) {
        const total = eventTotals[event] || 0;
        events[event] = { active: total > 0, count_7d: total };
      }

      pixels.push({
        id: pixel.id,
        name: pixel.name,
        events
      });
    }

    // Update brand with pixel data
    if (pixels.length > 0) {
      const primaryPixel = pixels[0];
      await supabase
        .from('brands')
        .update({
          meta_pixel_id: primaryPixel.id,
          meta_pixel_name: primaryPixel.name,
          meta_pixel_events: primaryPixel.events,
          meta_pixel_verified_at: new Date().toISOString()
        })
        .eq('id', brandId);
    }

    console.log(`Found ${pixels.length} pixels with event data`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pixels,
        hasPixels: pixels.length > 0,
        primaryPixel: pixels[0] || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-pixel-status:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
