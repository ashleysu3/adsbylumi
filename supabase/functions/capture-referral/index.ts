import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user || !user.email) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { code, action } = await req.json();
    if (!code) return new Response(JSON.stringify({ error: 'code required' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Find referrer
    const { data: referrer } = await supabase.from('profiles').select('id').eq('referral_code', code.toUpperCase()).maybeSingle();
    if (!referrer) return new Response(JSON.stringify({ error: 'Invalid code' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (referrer.id === user.id) return new Response(JSON.stringify({ error: 'Self-referral not allowed' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Upsert referral (one per referred_user)
    const { data: existing } = await supabase.from('referrals').select('id, status').eq('referred_user_id', user.id).maybeSingle();
    if (!existing) {
      await supabase.from('referrals').insert({
        referrer_user_id: referrer.id,
        referred_user_id: user.id,
        referred_email: user.email,
        code: code.toUpperCase(),
        status: action === 'paid' ? 'paid' : 'signed_up',
      });
    }

    if (action === 'paid') {
      // Mark paid and grant $40 credit if not yet credited
      const { data: ref } = await supabase.from('referrals').select('*').eq('referred_user_id', user.id).maybeSingle();
      if (ref && ref.status !== 'credited') {
        await supabase.from('referrals').update({ status: 'credited', credited_at: new Date().toISOString() }).eq('id', ref.id);
        await supabase.from('account_credits').insert({
          user_id: ref.referrer_user_id,
          amount_cents: 4000,
          currency: 'usd',
          source: 'friend_referral',
          source_ref: ref.id,
          note: `Friend signed up: ${user.email}`,
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
