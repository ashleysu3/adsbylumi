import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

interface ConversionEvent {
  eventName: 'Purchase' | 'Lead' | 'CompleteRegistration' | 'AddToCart' | 'InitiateCheckout' | 'ViewContent';
  eventTime?: number;
  eventSourceUrl: string;
  userData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    externalId?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
    fbc?: string;
    fbp?: string;
  };
  customData?: {
    value?: number;
    currency?: string;
    contentName?: string;
    contentCategory?: string;
    contentIds?: string[];
    contentType?: string;
    orderId?: string;
    numItems?: number;
  };
  actionSource?: 'website' | 'email' | 'app' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other';
}

// Hash function for user data (required by Meta CAPI)
async function hashValue(value: string): Promise<string> {
  if (!value) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Normalize and hash user data
async function normalizeUserData(userData: ConversionEvent['userData']) {
  const normalized: Record<string, string> = {};

  if (userData.email) {
    normalized.em = await hashValue(userData.email);
  }
  if (userData.phone) {
    const cleanPhone = userData.phone.replace(/\D/g, '');
    normalized.ph = await hashValue(cleanPhone);
  }
  if (userData.firstName) {
    normalized.fn = await hashValue(userData.firstName);
  }
  if (userData.lastName) {
    normalized.ln = await hashValue(userData.lastName);
  }
  if (userData.city) {
    normalized.ct = await hashValue(userData.city);
  }
  if (userData.state) {
    normalized.st = await hashValue(userData.state);
  }
  if (userData.zipCode) {
    normalized.zp = await hashValue(userData.zipCode);
  }
  if (userData.country) {
    normalized.country = await hashValue(userData.country);
  }
  if (userData.externalId) {
    normalized.external_id = await hashValue(userData.externalId);
  }
  if (userData.clientIpAddress) {
    normalized.client_ip_address = userData.clientIpAddress;
  }
  if (userData.clientUserAgent) {
    normalized.client_user_agent = userData.clientUserAgent;
  }
  if (userData.fbc) {
    normalized.fbc = userData.fbc;
  }
  if (userData.fbp) {
    normalized.fbp = userData.fbp;
  }

  return normalized;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandId, event, testEventCode } = await req.json() as {
      brandId: string;
      event: ConversionEvent;
      testEventCode?: string;
    };

    if (!brandId || !event) {
      return new Response(
        JSON.stringify({ success: false, error: 'Brand ID and event are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!event.eventName || !event.eventSourceUrl || !event.userData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Event name, source URL, and user data are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get brand data including pixel and access token via Vault
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('meta_pixel_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      console.error('Error fetching brand:', brandError);
      return new Response(
        JSON.stringify({ success: false, error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get access token from Vault
    const { data: accessToken, error: tokenError } = await supabase.rpc('get_meta_token', { p_brand_id: brandId });

    if (!brand.meta_pixel_id || !accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Pixel or access token not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pixelId = brand.meta_pixel_id;

    // Build the event payload
    const eventTime = event.eventTime || Math.floor(Date.now() / 1000);
    const normalizedUserData = await normalizeUserData(event.userData);

    const eventPayload: Record<string, any> = {
      event_name: event.eventName,
      event_time: eventTime,
      event_source_url: event.eventSourceUrl,
      action_source: event.actionSource || 'website',
      user_data: normalizedUserData
    };

    // Add custom data if provided
    if (event.customData) {
      const customData: Record<string, any> = {};
      if (event.customData.value !== undefined) customData.value = event.customData.value;
      if (event.customData.currency) customData.currency = event.customData.currency;
      if (event.customData.contentName) customData.content_name = event.customData.contentName;
      if (event.customData.contentCategory) customData.content_category = event.customData.contentCategory;
      if (event.customData.contentIds) customData.content_ids = event.customData.contentIds;
      if (event.customData.contentType) customData.content_type = event.customData.contentType;
      if (event.customData.orderId) customData.order_id = event.customData.orderId;
      if (event.customData.numItems) customData.num_items = event.customData.numItems;

      if (Object.keys(customData).length > 0) {
        eventPayload.custom_data = customData;
      }
    }

    console.log('Sending event to CAPI:', {
      pixelId,
      eventName: event.eventName,
      hasUserData: Object.keys(normalizedUserData).length > 0
    });

    // Build request body
    const requestBody: Record<string, any> = {
      data: [eventPayload]
    };

    // Add test event code if provided (for testing)
    if (testEventCode) {
      requestBody.test_event_code = testEventCode;
    }

    // Send to Meta Conversions API
    const capiUrl = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`;
    const response = await fetch(capiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('CAPI error:', responseData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: responseData.error?.message || 'Failed to send event',
          details: responseData.error
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('CAPI response:', responseData);

    return new Response(
      JSON.stringify({
        success: true,
        eventsReceived: responseData.events_received,
        fbtrace_id: responseData.fbtrace_id,
        messages: responseData.messages
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-conversion-event:', error);
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
