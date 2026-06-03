import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const KEY = Deno.env.get("OPENAI_API_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VOICE_RULES = `You are a senior direct-response copywriter writing Meta ad creative for coaches, course creators, and service providers. You write like a sharp, warm, real human IN THIS BRAND'S VOICE — never like a marketer. Study the brand voice samples and mirror their tone, rhythm, word choice, and punctuation.
VOICE RULES (non-negotiable):
- BANNED clichés: "unlock the secrets", "discover the roadmap", "proven strategies", "kickstart", "supercharge", "unleash", "take it to the next level", "let's make it happen", "secret to success", "game-changer", "dive in", "elevate", "level up".
- NO exclamation marks unless the brand's samples use them. Prefer the brand's punctuation (if they use "..." or "--", use those).
- SENTENCE CASE: capitalize only the first word and proper nouns. Never Title-Case random words.
- Be concrete: name the real thing (a portfolio, a certification, the first 5 clients), never "success" or "strategies".
- If a line sounds like generic marketing, rewrite it until it sounds like a real person in this brand.
- COMPLIANCE: never promise guaranteed income or results; avoid "guaranteed" and income/health before-after claims (Meta policy). Imply, never guarantee.`;

// exact slots per template (keys + length guidance)
const SLOTS: Record<string,string> = {
  cutout: `eyebrow (<=5 words), headlinePre (1-3 words), headlineHL (1-3 words, the punchy highlighted phrase), headlinePost (2-6 words), accent (optional italic kicker <=6 words or ""), sub (one sentence <=15 words), cta (<=4 words), badgeTop (<=2 words), badgeBottom (<=3 words)`,
  spotlight: `eyebrow (<=6 words, a details line e.g. "Free training · Jun 8 @ 1pm ET"), headline (<=8 words), sub (one sentence <=18 words), cta (<=4 words)`,
  framed: `headlinePre (1-4 words, lowercase lead-in), headlineHL (2-5 words, the bold phrase shown in CAPS), headlinePost (2-6 words, lowercase tail), cta (<=5 words, e.g. "Watch the free training"), sig (the brand or person's name)`,
  split: `eyebrow (<=3 words, e.g. "Free download"), headline (<=9 words, shown in CAPS), cta (<=3 words, e.g. "Free download")`,
  highlighter: `headlinePre (1-3 words), headlineAccent (1-3 words, shown in accent color), headlineHL (1-3 words, the highlighted phrase), sub (one sentence <=14 words), badgeTop (<=2 words e.g. FREE), badgeBottom (<=2 words e.g. Download)`,
};

function mapStyle(styleHint?: string, format?: string): string {
  if (format === "carousel") return "carousel";
  const m: Record<string,string> = { "photo-forward":"cutout","card":"spotlight","framed":"framed","type-led":"split","testimonial":"spotlight","highlighter":"highlighter" };
  return (styleHint && m[styleHint]) || "cutout";
}

function instruction(template: string, count: number): string {
  if (template === "carousel") {
    return `Return ${count} option(s). Each option is {"slides":[...]} with one slide per slidePlan role (3-6 slides). Each slide = {"eyebrow":"<=4 words","headline":"<=8 words","sub":"one sentence <=15 words","cta":"ONLY on the last slide, <=4 words; omit otherwise"}. Slide 1 = the hook; last slide = the CTA.`;
  }
  return `Return ${count} DISTINCT option(s) (different angles). For template "${template}", each option is a JSON object with EXACTLY these keys: ${SLOTS[template] || SLOTS.cutout}. Use "" for any optional field you skip. Full headline reads as one natural line, <=8 words.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { brief = {}, brandVoice = {}, count = 3 } = await req.json();
    const template = brief.template || mapStyle(brief.styleHint, brief.format);
    const user = `Creative brief:\n${JSON.stringify(brief)}\n\nBrand voice samples:\n${JSON.stringify(brandVoice)}\n\n${instruction(template, count)}\n\nOutput ONLY valid JSON: {"template":"${template}","options":[ ... ]}`;
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", temperature: 0.9, response_format: { type: "json_object" },
        messages: [ { role: "system", content: VOICE_RULES }, { role: "user", content: user } ] }),
    });
    const d = await r.json();
    if (!r.ok) {
      const msg = d?.error?.message || `OpenAI HTTP ${r.status}`;
      console.error("compose-ad openai error:", msg, JSON.stringify(d).slice(0, 500));
      return new Response(JSON.stringify({ error: msg, options: [] }), { status: 200, headers: { ...cors, "content-type": "application/json" } });
    }
    const content = d?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("compose-ad empty content:", JSON.stringify(d).slice(0, 500));
      return new Response(JSON.stringify({ error: "AI returned no content", options: [] }), { status: 200, headers: { ...cors, "content-type": "application/json" } });
    }
    return new Response(content, { status: 200, headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    console.error("compose-ad exception:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e), options: [] }), { status: 200, headers: { ...cors, "content-type": "application/json" } });
  }
});