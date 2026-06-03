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
    const prompt = `You are writing the LUMI monthly newsletter on behalf of Ashley Braswell, founder of LUMI (adsbylumi.com) and After Organic — a Meta ads agency that has managed millions in real ad spend since 2016 and is still actively running client campaigns today.

=== LUMI BRAND VOICE — MATCH THIS EXACTLY ===

WHO WE TALK TO: Coaches, course creators, and service providers who are done with $2–5k/mo agencies, 40-hour ad courses, and Ads Manager overwhelm. Smart business owners, not marketers. They want results without becoming an ads expert.

TONE:
- Direct, confident, plain-English. No fluff. No hype. No marketing-speak.
- Founder-built credibility. We've actually run the ads. We sound like an operator, not a guru.
- Warm but not cutesy. We are NOT a "bestie / babe / girl / hey friend" brand. Never use those words.
- NOT "Vogue-meets-marketing-bestie." NOT editorial. NOT precious. NOT a fashion magazine.
- Short, punchy sentences. Real punctuation. One-line paragraphs are welcome.
- Anti-overwhelm: name the pain plainly, then show the simpler way.
- Clean parallel comparisons. "Generic AI does X. LUMI does Y." No hedging.

SIGNATURE MOVES:
- "Stop X. Start Y." framing for CTAs ("Stop overthinking your ads. Start running them.").
- Tight lists with ❌ for the old way and ✅ for the LUMI way.
- ✨ used sparingly — once or twice per email max. Never decoration spam.
- Plain numbers and specifics ($97/mo, 7-day trial, $10–$20/day starting budgets, millions managed since 2016).
- Lead with the creator's outcome (time back, campaign live, fatigue caught) — feature names come second, in service of the win.

NEVER USE:
- "bestie", "babe", "girl", "hey friend", "xoxo", "spill the tea", "the tea is", "obsessed", "iconic", "main character", "your ads era", "let's gooo", "literally" as filler, "tbh".
- Stacked emoji sentences. Vogue / fashion metaphors.
- Hype words: "secret", "overnight", "guaranteed", "explode", "blow up", "10x", "game-changer", "revolutionary", "unlock", "elevate".
- Promised results.
- Walls of text.

EMAIL FORMAT:
- Inline styles, email-safe (tables/divs, no <html>/<doctype>, no external CSS).
- Headings: short, sentence case, specific.
- Body: 1–3 sentence paragraphs. Lists where they earn it.
- One clear CTA per section, max two in the whole email.
- USER version ends with a "FOOTER_FORWARD_BLOCK" marker we will replace.

=== THIS MONTH ===
Month: ${monthLabel}

Updates to highlight (lead with the creator's outcome, not the feature name):
${JSON.stringify(selectedUpdates, null, 2)}

Angles per update:
${JSON.stringify(angles, null, 2)}

Ashley's note — weave in naturally, don't quote verbatim:
${customNote || '(none)'}

=== OUTPUT ===
Write TWO versions: USER (for LUMI customers) and PARTNER (for affiliates).
Subject lines under 55 chars. Resend subjects must take a different angle from the first — new hook, specific number, or curiosity gap. No clickbait, no all-caps, no exclamation stacking.

Return strict JSON only:
{
  "user_subject_options": ["...", "...", "..."],
  "user_resend_subject_options": ["...", "...", "..."],
  "partner_subject_options": ["...", "...", "..."],
  "partner_resend_subject_options": ["...", "...", "..."],
  "user_html": "<inline-styled email body, ending with the FOOTER_FORWARD_BLOCK marker>",
  "partner_html": "<same content as user_html, plus a 'How to share this month' section with 3–5 short shareable lines partners can drop into stories/posts/DMs. No FOOTER_FORWARD_BLOCK marker.>",
  "partner_share_tidbits": ["short caption 1", "short caption 2", "short caption 3"]
}`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
