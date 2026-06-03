import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const KEY = Deno.env.get("OPENAI_API_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VOICE_RULES = `You are a world-class direct-response copywriter who writes Meta (Facebook/Instagram) ad copy for coaches, course creators, and service providers. Your copy stops the scroll and converts. You write in the brand's REAL voice — like a sharp human, never like a marketer. Study the brand voice samples and mirror their tone, rhythm, word choice, and punctuation.

Produce DISTINCT options — each a genuinely different proven angle: a direct callout, a contrarian take, a curiosity gap, problem then agitate, a specific result, or a pointed question that names a real pain.

WHAT MAKES IT CONVERT (non-negotiable):

- HOOK: the first 3 words must stop the scroll — call the reader out, name a specific pain, or break a pattern. No throat-clearing.

- SPECIFIC over vague, always. Name the real pain, the real number, the real outcome ("your first 5 clients in 60 days", not "grow your business"). Concrete beats abstract every time.

- SUB earns the click with ONE concrete benefit or proof. Never hedge ("maybe it's time...", "consider...", "it might be...").

- CTA is specific and active: "Save my seat", "Get the free class", "Send me the guide", "Watch the training".

- Mirror the brand's voice samples. Sound like a real person talking to one person.

BANNED — using any of these (or anything like them) is an instant fail: "learn more", "find out more", "click here", "sign up", "get started", "simplify your approach", "take it to the next level", "maybe it's time", "unlock", "discover the secrets", "proven strategies", "elevate", "game-changer", "in today's world", "are you ready to", "look no further", "the ultimate", "supercharge", "dive in", "kickstart", "level up". No exclamation-mark spam — use the brand's punctuation only.

CALIBRATION — match the STRONG column, never the WEAK one:

WEAK   -> eyebrow: "Stop chasing after trends" | headline: "Your last shiny object subscription?" | sub: "Maybe it's time to simplify your approach." | cta: "Learn more"

STRONG -> eyebrow: "For coaches drowning in tools" | headline: "You don't need another app. You need clients." | sub: "The free class that replaces your whole shiny-object stack — and books 5 clients in 60 days." | cta: "Save my seat"

SENTENCE CASE headlines (capitalize the first word and proper nouns only). COMPLIANCE: never promise guaranteed income or results; imply outcomes, never guarantee them.`;

// exact slots per template (keys + length guidance)
const SLOTS: Record<string,string> = {
  cutout: `eyebrow (<=5 words), headlinePre (1-3 words), headlineHL (1-3 words, the punchy highlighted phrase), headlinePost (2-6 words), accent (optional italic kicker <=6 words or ""), sub (one sentence <=15 words), cta (<=4 words), badgeTop (<=2 words), badgeBottom (<=3 words)`,
  spotlight: `eyebrow (<=6 words, a details line e.g. "Free training · Jun 8 @ 1pm ET"), headline (<=8 words), sub (one sentence <=18 words), cta (<=4 words)`,
  framed: `headlinePre (1-4 words, lowercase lead-in), headlineHL (2-5 words, the bold phrase shown in CAPS), headlinePost (2-6 words, lowercase tail), cta (<=5 words, e.g. "Watch the free training"), sig (the brand or person's name)`,
  split: `eyebrow (<=3 words, e.g. "Free download"), headline (<=9 words, shown in CAPS), cta (<=3 words, e.g. "Free download")`,
  highlighter: `headlinePre (1-3 words), headlineAccent (1-3 words, accent color), headlineHL (1-3 words, highlighted phrase), sub (one sentence <=14 words), badgeTop (<=2 words e.g. FREE), badgeBottom (<=2 words e.g. Download)`,
  overlay: `eyebrow (<=5 words), headline (<=8 words, bold), sub (one sentence <=16 words), cta (<=4 words)`,
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