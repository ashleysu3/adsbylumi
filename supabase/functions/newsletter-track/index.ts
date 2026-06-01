import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const PIXEL = Uint8Array.from([
  71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,0,0,44,
  0,0,0,0,1,0,1,0,0,2,1,68,0,59,
]);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const openId = url.searchParams.get('open');
  const clickId = url.searchParams.get('click');
  const target = url.searchParams.get('u');

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    if (openId) {
      await supabase
        .from('newsletter_sends')
        .update({ opened_at: new Date().toISOString() })
        .eq('id', openId)
        .is('opened_at', null);
      return new Response(PIXEL, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' } });
    }
    if (clickId && target) {
      // Increment click_count and set clicked_at
      const { data: row } = await supabase
        .from('newsletter_sends')
        .select('click_count, clicked_at, opened_at')
        .eq('id', clickId)
        .maybeSingle();
      await supabase
        .from('newsletter_sends')
        .update({
          clicked_at: row?.clicked_at || new Date().toISOString(),
          opened_at: row?.opened_at || new Date().toISOString(),
          click_count: (row?.click_count || 0) + 1,
        })
        .eq('id', clickId);
      return Response.redirect(target, 302);
    }
  } catch (e) {
    console.error('track err', e);
  }
  return new Response('ok', { status: 200 });
});
