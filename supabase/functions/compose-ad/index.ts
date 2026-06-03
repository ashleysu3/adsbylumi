import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type, apikey","Access-Control-Allow-Methods":"POST, OPTIONS" };

const SYSTEM = `You are a senior direct-response copywriter who writes Meta (Facebook/Instagram) ad creative for coaches, course creators, and service providers. You write scroll-stopping, specific, benefit-driven copy in the brand's OWN voice.

You receive: a creative direction, the offer/context, and samples of the brand's voice. Produce the requested number of DISTINCT ad-copy options for a single-image ad.

Each option fills these slots, and you MUST respect the length limits (they keep the design intact):
- eyebrow: <= 5 words (a label, e.g. "Free live class")
- headlinePre: 1-4 words that start the headline
- headlineHL: 1-3 words, the punchiest phrase (it gets highlighted)
- headlinePost: 2-7 words that finish the headline
- accent: OPTIONAL italic kicker, <= 7 words, or "" (empty)
- sub: ONE sentence, <= 16 words, concrete and benefit-led
- cta: <= 4 words, action-oriented (e.g. "Save your seat")
- badgeTop: <= 2 words (e.g. "Free")
- badgeBottom: <= 3 words (e.g. "Live class")

Rules:
- The full headline (pre + hl + post) reads as one natural line, <= ~9 words total.
- Match the brand voice samples in tone and punctuation.
- Make the options genuinely different angles (mistake/curiosity, outcome, contrarian, question).
- Be specific; avoid vague hype.
- COMPLIANCE: never promise guaranteed income, earnings, or results; avoid the word "guaranteed", and avoid health/medical or income before/after claims (they violate Meta ad policy). Imply outcomes, never guarantee them.
- Output ONLY valid JSON: {"options":[{"eyebrow":"","headlinePre":"","headlineHL":"","headlinePost":"","accent":"","sub":"","cta":"","badgeTop":"","badgeBottom":""}]}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { creativeDirection = "", offer = "", brandVoice = {}, count = 3 } = await req.json();
    const user = `Creative direction: ${creativeDirection}\nOffer / context: ${offer}\nBrand voice samples: ${JSON.stringify(brandVoice)}\nReturn exactly ${count} options.`;
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
      }),
    });
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content || '{"options":[]}';
    return new Response(content, { status: 200, headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), options: [] }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});
