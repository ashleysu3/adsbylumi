// Public (verify_jwt=false) kit lookup for /your-ad-pack?kit=<token>.
// Mirrors get-shared-report: the token is the whole credential, the
// SECURITY DEFINER RPC whitelists exactly which columns it exposes, and
// a miss is a plain 404. A kit link arrives by email and gets opened on
// any device with no session — this is the only door in.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { kitToken } = await req.json();
    if (!kitToken || typeof kitToken !== 'string') throw new Error('kitToken is required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: kit, error } = await supabase.rpc('get_ad_kit', { p_kit_token: kitToken });
    if (error) throw error;

    if (!kit) {
      return new Response(JSON.stringify({ error: 'Kit not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      });
    }

    return new Response(JSON.stringify({ success: true, kit }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching ad kit:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    });
  }
});
