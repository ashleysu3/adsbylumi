import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const cors = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type, apikey, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS" };

const SYSTEM_SINGLE = `You are a senior direct-response copywriter writing Meta ad creative for coaches, course creators, and service providers. You write like a sharp, warm, real human IN THIS BRAND'S VOICE — never like a marketer.

You receive: a creative direction, the offer/context, and the brand's voice samples (real lines from their website). STUDY the voice samples and mirror their tone, rhythm, word choice, and punctuation. Produce the requested number of DISTINCT options (different angles).

Slots and HARD limits (breaking them breaks the design):
- eyebrow: <= 5 words
- headlinePre: 1-3 words
- headlineHL: 1-3 words (the punchiest phrase; it gets highlighted)
- headlinePost: 2-6 words
- accent: optional italic kicker <= 6 words, or "" (empty)
- sub: ONE sentence, <= 15 words, concrete and specific
- cta: <= 4 words
- badgeTop: <= 2 words ; badgeBottom: <= 3 words
- Full headline (pre + hl + post) <= 8 words and reads as one natural line.

VOICE RULES — non-negotiable:
- BANNED clichés (never use these or anything like them): "unlock the secrets", "discover the roadmap", "proven strategies", "kickstart", "supercharge", "unleash", "take it to the next level", "let's make it happen", "secret to success", "game-changer", "dive in", "elevate", "level up".
- NO exclamation marks unless the brand's own voice samples use them. Prefer the brand's punctuation — if their samples use "..." or "--", use those.
- SENTENCE CASE headlines: capitalize only the first word and proper nouns. Never Title-Case random words like "A Certification".
- Be concrete: name the real thing (a portfolio, a certification, the first 5 clients) — never "success" or "strategies".
- If a line sounds like generic marketing, rewrite it until it sounds like a real person in THIS brand. If you wouldn't text it to a friend, don't write it.
- COMPLIANCE: never promise guaranteed income or results; avoid "guaranteed" and income/health before-after claims (they violate Meta ad policy). Imply outcomes, never guarantee them.

Output ONLY valid JSON: {"options":[{"eyebrow":"","headlinePre":"","headlineHL":"","headlinePost":"","accent":"","sub":"","cta":"","badgeTop":"","badgeBottom":""}]}`;

const SYSTEM_CAROUSEL = `You are a senior direct-response copywriter writing Meta carousel ad creative for coaches, course creators, and service providers. You write like a sharp, warm, real human IN THIS BRAND'S VOICE — never like a marketer.

You receive: a creative brief (angle, concept, key message, offer, CTA, audience, proof point, style hint), the brand's voice samples, and a slidePlan describing each slide's role. STUDY the voice samples and mirror their tone, rhythm, word choice, and punctuation.

Produce ONE option containing one slide per role in slidePlan (same order). Slide 1 is the HOOK (stop the scroll, name the tension). The LAST slide is the CTA (drive the click).

Per-slide slots and HARD limits:
- eyebrow: <= 4 words (slide role label, e.g. "The problem", "The proof", "Your turn")
- headline: <= 8 words, sentence case, concrete and specific
- sub: ONE sentence, <= 15 words

VOICE RULES — non-negotiable:
- BANNED clichés (never use these or anything like them): "unlock the secrets", "discover the roadmap", "proven strategies", "kickstart", "supercharge", "unleash", "take it to the next level", "let's make it happen", "secret to success", "game-changer", "dive in", "elevate", "level up".
- NO exclamation marks unless the brand's own voice samples use them. Prefer the brand's punctuation.
- SENTENCE CASE headlines: capitalize only the first word and proper nouns.
- Be concrete: name the real thing — never "success" or "strategies".
- If a line sounds like generic marketing, rewrite it until it sounds like a real person in THIS brand.
- COMPLIANCE: never promise guaranteed income or results; avoid "guaranteed" and income/health before-after claims. Imply outcomes, never guarantee them.

Output ONLY valid JSON: {"options":[{"slides":[{"eyebrow":"","headline":"","sub":""}]}]}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const { creativeDirection = "", offer = "", brandVoice = {}, count = 3, brief = null } = body;

    const isCarousel = brief && brief.format === "carousel";
    const SYSTEM = isCarousel ? SYSTEM_CAROUSEL : SYSTEM_SINGLE;

    let user = "";
    if (brief) {
      const briefLines = [
        `Format: ${brief.format || "single_graphic"}`,
        brief.angle && `Angle: ${brief.angle}`,
        brief.concept && `Concept: ${brief.concept}`,
        brief.keyMessage && `Key message: ${brief.keyMessage}`,
        brief.offer && `Offer: ${brief.offer}`,
        brief.cta && `CTA: ${brief.cta}`,
        brief.audience && `Audience: ${brief.audience}`,
        brief.proofPoint && `Proof point: ${brief.proofPoint}`,
        brief.styleHint && `Style hint: ${brief.styleHint}`,
      ].filter(Boolean).join("\n");

      if (isCarousel) {
        const plan = Array.isArray(brief.slidePlan) ? brief.slidePlan : [];
        const slideCount = plan.length || brief.slideCount || 5;
        user = `${briefLines}\nBrand voice samples: ${JSON.stringify(brandVoice)}\nSlide plan (${slideCount} slides, in order — slide 1 is the hook, last is the CTA):\n${plan.map((r: any, i: number) => `${i + 1}. ${typeof r === "string" ? r : (r?.role || r?.name || "slide")}${typeof r === "object" && r?.note ? ` — ${r.note}` : ""}`).join("\n")}\nReturn exactly 1 option with ${slideCount} slides matching this plan in order.`;
      } else {
        user = `${briefLines}\nBrand voice samples: ${JSON.stringify(brandVoice)}\nReturn exactly ${count} options.`;
      }
    } else {
      user = `Creative direction: ${creativeDirection}\nOffer / context: ${offer}\nBrand voice samples: ${JSON.stringify(brandVoice)}\nReturn exactly ${count} options.`;
    }

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
    return new Response(JSON.stringify({ error: String(e), options: [] }), { status: 200, headers: { ...cors, "content-type": "application/json" } });
  }
});
