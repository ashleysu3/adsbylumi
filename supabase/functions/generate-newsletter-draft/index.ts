import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { selectedUpdates, angles, customNote, monthLabel } = await req.json();

    const apiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const prompt = `You are Ashley, founder of Lumi (adsbylumi.com) — an AI Meta Ads assistant for coaches and creators. Your tone is warm, clever, Vogue-meets-marketing-bestie.

Generate a monthly newsletter for ${monthLabel}. Write TWO versions: a USER version (for Lumi customers) and a PARTNER version (for affiliates).

UPDATES TO HIGHLIGHT:
${JSON.stringify(selectedUpdates, null, 2)}

ANGLES TO HIT (per update):
${JSON.stringify(angles, null, 2)}

ASHLEY'S CUSTOM NOTE (weave it in naturally):
${customNote || '(none)'}

Output strict JSON only with this shape:
{
  "user_subject_options": ["...", "...", "..."],
  "user_resend_subject_options": ["...", "...", "..."],
  "partner_subject_options": ["...", "...", "..."],
  "partner_resend_subject_options": ["...", "...", "..."],
  "user_html": "<full HTML email body, no <html> wrapper, no doctype, just inner content. Use inline styles. End with a section labeled FOOTER_FORWARD_BLOCK that we will replace.>",
  "partner_html": "<same content as user_html but append a 'How to share this month' section with 3-5 shareable copy tidbits and the angle ideas formatted for partners. Do NOT include the FOOTER_FORWARD_BLOCK marker.>",
  "partner_share_tidbits": ["short caption 1", "short caption 2", "short caption 3"]
}

Keep subject lines under 55 chars. Make resend subjects feel different (curiosity gap, urgency, or playful). HTML must be email-safe (tables/divs, inline styles, no external CSS).`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const errTxt = await aiRes.text();
      console.error('AI error:', errTxt);
      return new Response(JSON.stringify({ error: `AI gateway error: ${aiRes.status}`, details: errTxt }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    return new Response(JSON.stringify({ success: true, draft: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('generate-newsletter-draft error:', e);
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
