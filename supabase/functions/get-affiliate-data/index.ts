import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(
        JSON.stringify({ error: true, message: 'email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiSecret = Deno.env.get('REWARDFUL_API_SECRET');
    if (!apiSecret) throw new Error('REWARDFUL_API_SECRET not configured');

    const authHeader = 'Basic ' + btoa(apiSecret + ':');
    const url = `https://api.rewardful.com/v1/affiliates?expand[]=links&email=${encodeURIComponent(email)}`;

    const res = await fetch(url, {
      headers: { 'Authorization': authHeader },
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Rewardful lookup error:', data);
      throw new Error('Failed to fetch affiliate data');
    }

    // data is an array of affiliates
    const affiliates = Array.isArray(data) ? data : data.data || [];
    const affiliate = affiliates[0];

    if (!affiliate) {
      return new Response(
        JSON.stringify({ exists: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const referralLink = affiliate.links?.[0]?.url || '';
    const referralCode = affiliate.links?.[0]?.token || '';

    return new Response(
      JSON.stringify({
        exists: true,
        id: affiliate.id,
        referralLink,
        referralCode,
        leadsCount: affiliate.leads_count || affiliate.visitors_count || 0,
        conversionsCount: affiliate.conversions_count || 0,
        earningsCents: affiliate.earnings_balance?.amount_cents || affiliate.commissions_total_cents || 0,
        campaignName: affiliate.campaign?.name || '',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('get-affiliate-data error:', error);
    return new Response(
      JSON.stringify({ error: true, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
