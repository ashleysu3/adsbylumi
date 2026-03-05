import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, campaignId } = await req.json();

    if (!email || !firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: true, message: 'email, firstName, and lastName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiSecret = Deno.env.get('REWARDFUL_API_SECRET');
    if (!apiSecret) throw new Error('REWARDFUL_API_SECRET not configured');

    const effectiveCampaignId = campaignId || Deno.env.get('REWARDFUL_STANDARD_CAMPAIGN_ID');

    const authHeader = 'Basic ' + btoa(apiSecret + ':');

    const res = await fetch('https://api.rewardful.com/v1/affiliates', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        first_name: firstName,
        last_name: lastName,
        campaign_id: effectiveCampaignId,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Check for duplicate email
      if (res.status === 422 && JSON.stringify(data).toLowerCase().includes('already')) {
        return new Response(
          JSON.stringify({ exists: true, message: 'Account already exists' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('Rewardful API error:', data);
      return new Response(
        JSON.stringify({ error: true, message: data?.error || data?.message || 'Failed to create affiliate' }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract referral link from the links array
    const referralLink = data.links?.[0]?.url || data.referral_link || '';
    const referralCode = data.links?.[0]?.token || data.referral_code || '';

    return new Response(
      JSON.stringify({
        success: true,
        id: data.id,
        referralLink,
        referralCode,
        affiliate: data,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('create-affiliate error:', error);
    return new Response(
      JSON.stringify({ error: true, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
