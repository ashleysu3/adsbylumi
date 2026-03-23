import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`Fetch attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error('All retries exhausted');
}

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
    const url = `https://api.getrewardful.com/v1/affiliates?expand[]=links&email=${encodeURIComponent(email)}`;

    const res = await fetchWithRetry(url, {
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

    // Look up partner trial code
    let partnerTrialCode = '';
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const { data: tokenData } = await supabase
        .from('partner_access_tokens')
        .select('partner_trial_code')
        .eq('email', email)
        .maybeSingle();
      partnerTrialCode = tokenData?.partner_trial_code || '';
    } catch (e) {
      console.error('Failed to look up trial code:', e);
    }

    return new Response(
      JSON.stringify({
        exists: true,
        id: affiliate.id,
        referralLink,
        referralCode,
        partnerTrialCode,
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
