import { getCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { title, body } = await req.json();
    const apiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: `For this Lumi product update, suggest 4 short angle ideas (5-10 words each) we could use to talk about it in a newsletter. Return JSON: { "angles": ["...", "...", "...", "..."] }\n\nTitle: ${title}\nBody: ${body || ''}`
        }],
        response_format: { type: 'json_object' },
      }),
    });
    if (!aiRes.ok) {
      return new Response(JSON.stringify({ error: `AI: ${aiRes.status}` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const data = await aiRes.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    return new Response(JSON.stringify({ success: true, angles: parsed.angles || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
