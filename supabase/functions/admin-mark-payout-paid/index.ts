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

    const { payout_id } = await req.json();
    if (!payout_id || typeof payout_id !== 'string') return json({ error: 'payout_id required' });

    const apiSecret = Deno.env.get('REWARDFUL_API_SECRET');
    if (!apiSecret) return json({ error: 'REWARDFUL_API_SECRET not configured' });
    const rwAuth = 'Basic ' + btoa(apiSecret + ':');

    const res = await fetch(`https://api.getrewardful.com/v1/payouts/${encodeURIComponent(payout_id)}/pay`, {
      method: 'PUT',
      headers: { Authorization: rwAuth },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Rewardful mark-paid error', body);
      return json({ error: body?.error || `Rewardful ${res.status}` });
    }
    return json({ success: true, payout: body });
  } catch (e: any) {
    console.error('admin-mark-payout-paid error', e);
    return json({ error: e.message || String(e) });
  }
});
