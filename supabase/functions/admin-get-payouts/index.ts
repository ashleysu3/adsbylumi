import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleRow } = await adminClient.from('user_roles').select('role')
      .eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleRow) return json({ error: 'Forbidden' }, 403);

    const apiSecret = Deno.env.get('REWARDFUL_API_SECRET');
    if (!apiSecret) return json({ error: 'REWARDFUL_API_SECRET not configured' });
    const rwAuth = 'Basic ' + btoa(apiSecret + ':');

    // Fetch all payouts in every meaningful state, expand affiliate + commissions
    const states = ['pending', 'due', 'processing', 'paid'];
    const stateParams = states.map((s) => `state[]=${s}`).join('&');
    const url = `https://api.getrewardful.com/v1/payouts?${stateParams}&expand[]=affiliate&expand[]=commissions&per_page=100`;
    const res = await fetch(url, { headers: { Authorization: rwAuth } });
    const body = await res.json();
    if (!res.ok) {
      console.error('Rewardful payouts error', body);
      return json({ error: body?.error || `Rewardful ${res.status}` });
    }
    const payouts = Array.isArray(body) ? body : (body.data || []);

    // Enrich with internal partner record (paypal email override, partner_user_id) if available
    const affiliateIds = Array.from(new Set(payouts.map((p: any) => p.affiliate?.id).filter(Boolean)));
    let partnerByAffiliate = new Map<string, any>();
    if (affiliateIds.length > 0) {
      const { data: partners } = await adminClient
        .from('partner_access_tokens')
        .select('id, partner_display_name, partner_email, email, rewardful_affiliate_id')
        .in('rewardful_affiliate_id', affiliateIds as string[]);
      (partners || []).forEach((p: any) => partnerByAffiliate.set(p.rewardful_affiliate_id, p));
    }

    const enriched = payouts.map((p: any) => ({
      ...p,
      partner_record: p.affiliate?.id ? partnerByAffiliate.get(p.affiliate.id) || null : null,
    }));

    return json({ payouts: enriched });
  } catch (e: any) {
    console.error('admin-get-payouts error', e);
    return json({ error: e.message || String(e) });
  }
});
