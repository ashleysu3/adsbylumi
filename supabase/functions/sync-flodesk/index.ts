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

// Flodesk segment IDs - these are the segment names you provided
const SEGMENTS = {
  waitlist: 'LUMI Waitlist',
  active: 'LUMI (active)'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FLODESK_API_KEY = Deno.env.get('FLODESK_API_KEY');
    if (!FLODESK_API_KEY) {
      throw new Error('FLODESK_API_KEY is not configured');
    }

    const { email, firstName, lastName, segment }: FlodeskRequest = await req.json();

    if (!email || !segment) {
      throw new Error('Email and segment are required');
    }

    console.log(`[FLODESK] Adding subscriber ${email} to segment: ${SEGMENTS[segment]}`);

    // Flodesk API uses Basic Auth with API key as username
    const authHeader = btoa(`${FLODESK_API_KEY}:`);

    // First, create or update the subscriber
    const subscriberPayload: Record<string, string> = {
      email: email.toLowerCase().trim(),
    };

    if (firstName) subscriberPayload.first_name = firstName;
    if (lastName) subscriberPayload.last_name = lastName;

    const subscriberResponse = await fetch('https://api.flodesk.com/v1/subscribers', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscriberPayload),
    });

    if (!subscriberResponse.ok) {
      const errorText = await subscriberResponse.text();
      console.error('[FLODESK] Subscriber creation error:', subscriberResponse.status, errorText);
      
      // If subscriber already exists, that's fine - continue to add to segment
      if (subscriberResponse.status !== 409) {
        throw new Error(`Flodesk subscriber error: ${subscriberResponse.status}`);
      }
    }

    console.log('[FLODESK] Subscriber created/updated successfully');

    // Add subscriber to the appropriate segment
    const segmentName = SEGMENTS[segment];
    
    const segmentResponse = await fetch(`https://api.flodesk.com/v1/subscribers/${encodeURIComponent(email.toLowerCase().trim())}/segments`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        segment_names: [segmentName],
      }),
    });

    if (!segmentResponse.ok) {
      const errorText = await segmentResponse.text();
      console.error('[FLODESK] Segment add error:', segmentResponse.status, errorText);
      // Don't throw - subscriber was created, segment might just not exist yet
      console.log('[FLODESK] Warning: Could not add to segment. Segment may need to be created in Flodesk.');
    } else {
      console.log(`[FLODESK] Successfully added ${email} to segment: ${segmentName}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Subscriber ${email} synced to Flodesk segment: ${segmentName}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[FLODESK] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
