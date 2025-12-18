import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FlodeskRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  segment: 'waitlist' | 'active';
}

// Flodesk segment names - these must match exactly what's in Flodesk
const SEGMENT_NAMES = {
  waitlist: 'LUMI Waitlist',
  active: 'LUMI (active)'
};

// Cache for segment IDs to avoid fetching every time
let segmentIdCache: Record<string, string> = {};

async function getSegmentId(authHeader: string, segmentName: string): Promise<string | null> {
  // Check cache first
  if (segmentIdCache[segmentName]) {
    console.log(`[FLODESK] Using cached segment ID for "${segmentName}": ${segmentIdCache[segmentName]}`);
    return segmentIdCache[segmentName];
  }

  console.log(`[FLODESK] Fetching segments from Flodesk...`);
  
  const response = await fetch('https://api.flodesk.com/v1/segments', {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[FLODESK] Failed to fetch segments: ${response.status} - ${errorText}`);
    return null;
  }

  const data = await response.json();
  console.log(`[FLODESK] Available segments:`, JSON.stringify(data, null, 2));

  // Flodesk returns { data: [...segments] }
  const segments = data.data || data;
  
  if (!Array.isArray(segments)) {
    console.error(`[FLODESK] Unexpected segments response format:`, data);
    return null;
  }

  // Find the segment by name (case-insensitive match)
  const targetSegment = segments.find((s: any) => 
    s.name?.toLowerCase() === segmentName.toLowerCase()
  );

  if (!targetSegment) {
    console.error(`[FLODESK] Segment "${segmentName}" not found. Available segments:`, 
      segments.map((s: any) => s.name).join(', ')
    );
    return null;
  }

  console.log(`[FLODESK] Found segment "${segmentName}" with ID: ${targetSegment.id}`);
  
  // Cache the ID
  segmentIdCache[segmentName] = targetSegment.id;
  
  return targetSegment.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FLODESK_API_KEY = Deno.env.get('FLODESK_API_KEY');
    if (!FLODESK_API_KEY) {
      console.error('[FLODESK] FLODESK_API_KEY is not configured');
      throw new Error('FLODESK_API_KEY is not configured');
    }

    const { email, firstName, lastName, segment }: FlodeskRequest = await req.json();
    console.log(`[FLODESK] Request received:`, { email, firstName, lastName, segment });

    if (!email || !segment) {
      console.error('[FLODESK] Missing required fields:', { email, segment });
      throw new Error('Email and segment are required');
    }

    const segmentName = SEGMENT_NAMES[segment];
    if (!segmentName) {
      console.error(`[FLODESK] Invalid segment type: ${segment}`);
      throw new Error(`Invalid segment type: ${segment}`);
    }

    console.log(`[FLODESK] Adding subscriber ${email} to segment: ${segmentName}`);

    // Flodesk API uses Basic Auth with API key as username
    const authHeader = btoa(`${FLODESK_API_KEY}:`);

    // Step 1: Get the segment ID
    const segmentId = await getSegmentId(authHeader, segmentName);
    if (!segmentId) {
      console.error(`[FLODESK] Could not find segment ID for "${segmentName}". Please create this segment in Flodesk.`);
      // Still create the subscriber even if segment not found
      console.log('[FLODESK] Proceeding to create subscriber without segment assignment...');
    }

    // Step 2: Create or update the subscriber
    const subscriberPayload: Record<string, string> = {
      email: email.toLowerCase().trim(),
    };

    if (firstName) subscriberPayload.first_name = firstName;
    if (lastName) subscriberPayload.last_name = lastName;

    console.log(`[FLODESK] Creating/updating subscriber:`, subscriberPayload);

    const subscriberResponse = await fetch('https://api.flodesk.com/v1/subscribers', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscriberPayload),
    });

    const subscriberResponseText = await subscriberResponse.text();
    console.log(`[FLODESK] Subscriber response: ${subscriberResponse.status} - ${subscriberResponseText}`);

    if (!subscriberResponse.ok && subscriberResponse.status !== 409) {
      // 409 = subscriber already exists, which is fine
      console.error('[FLODESK] Subscriber creation failed:', subscriberResponse.status, subscriberResponseText);
      throw new Error(`Flodesk subscriber error: ${subscriberResponse.status} - ${subscriberResponseText}`);
    }

    console.log('[FLODESK] Subscriber created/updated successfully');

    // Step 3: Add subscriber to segment (if we have a segment ID)
    if (segmentId) {
      console.log(`[FLODESK] Adding subscriber to segment ID: ${segmentId}`);
      
      const segmentResponse = await fetch(
        `https://api.flodesk.com/v1/subscribers/${encodeURIComponent(email.toLowerCase().trim())}/segments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            segment_ids: [segmentId],  // Use segment_ids, not segment_names
          }),
        }
      );

      const segmentResponseText = await segmentResponse.text();
      console.log(`[FLODESK] Segment assignment response: ${segmentResponse.status} - ${segmentResponseText}`);

      if (!segmentResponse.ok) {
        console.error('[FLODESK] Segment assignment failed:', segmentResponse.status, segmentResponseText);
        // Don't throw - subscriber was created, just segment assignment failed
        return new Response(
          JSON.stringify({ 
            success: true, 
            warning: `Subscriber created but segment assignment failed: ${segmentResponse.status}`,
            message: `Subscriber ${email} created but could not be added to segment: ${segmentName}` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[FLODESK] Successfully added ${email} to segment: ${segmentName}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Subscriber ${email} synced to Flodesk${segmentId ? ` and added to segment: ${segmentName}` : ' (no segment assigned)'}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[FLODESK] Error:', error.message, error.stack);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
