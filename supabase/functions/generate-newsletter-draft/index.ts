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

=== LUMI / ASHLEY VOICE — MATCH THIS EXACTLY ===

WHO WE TALK TO: Coaches, course creators, and service providers who are done with $2–5k/mo agencies, 40-hour ad courses, and Ads Manager overwhelm. Smart business owners, not marketers.

TONE: Warm, enthusiastic, conversational, grounded in real strategy. Ashley is the friend who actually runs the ads and gets excited explaining them. Direct address ("If your ads feel unstable, this is why."). Punchy rhythm — mix short lines, fragments, and one full thought per paragraph. Parenthetical asides for warmth/humor ("(spoiler: they do)" "(And if you get that last part, we really are kindred spirits 😂)").

SIGNATURE MOVES — use these on purpose:
- **Emojis are part of the voice.** They earn their spot, they're not banned:
  - ✨ highlights / magic
  - 👉 action items / "that's where ___ comes in"
  - 🚨 alerts / news
  - 🔗 links / CTAs
  - 💌 inbox / personal touches
  - 🤖 AI / Meta tech
  - 🥰😭🙌 genuine emotion (warm content only)
  - Format emoji 🎨🎥📸🖼️ work great for lists of options
- **Repeated 👉 lists** to build momentum ("👉 That's where strategy comes in. 👉 That's where rotation matters.").
- **Name the pain → twist → fix.** "That ad that crushed last month? Suddenly it's tanking. And you're left wondering... 👉 That's where ___ comes in."
- **Plain specifics:** $97/mo, 7-day trial, $10–$20/day, millions managed since 2016.
- **Lead with the creator's outcome,** then the feature name.

REFERENCE — match this energy (Ashley's actual IG):
> "Meta just dropped Andromeda 🤖 — a 10,000x AI upgrade that's shaking ad performance across Facebook + Instagram. If your ads feel unstable, this is why. 🚨 👉 Subscribe to The Ad Recap…"
> "🎨 Static. 🎥 Reels. 📸 Carousels. 🖼️ Graphics. OH MY! Every ad format has its moment… But here's the catch: no format works forever. That ad that crushed last month? Suddenly it's tanking. And you're left wondering if ads even work for you anymore (spoiler: they do—you just need to beat creative fatigue). 👉 That's where strategy comes in."

USE SPARINGLY (occasional is okay, never lean on these): "bestie", "babe", "girl" as direct address to the reader (Ashley uses "girls" for community members, that's fine, but don't open with "Hey bestie"); "literally", "tbh", "iconic", "obsessed" as filler.

HARD NOS:
- Hype/guru words: "secret", "overnight", "guaranteed", "explode", "blow up", "10x", "game-changer", "revolutionary", "unlock", "elevate", "main character", "your ___ era".
- Promised results.
- Vogue / fashion-magazine metaphors. NOT "Vogue-meets-marketing-bestie."
- Generic AI intros ("In today's fast-paced digital landscape…").
- Walls of text with no breaks.

EMAIL FORMAT:
- Inline styles, email-safe (tables/divs, no <html>/<doctype>, no external CSS).
- Headings: short, sentence case, specific. Emojis in headings are great.
- Body: 1–3 sentence paragraphs. Fragments allowed. Lists where they earn it.
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
