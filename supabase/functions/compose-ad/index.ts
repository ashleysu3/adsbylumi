import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VOICE_RULES = `You are a world-class direct-response copywriter writing Meta ad copy for coaches, course creators, and service providers. Your copy stops the scroll and converts. Write in the brand's REAL voice — like a sharp human, never like a marketer. Study the brand voice samples and mirror tone, rhythm, word choice, and punctuation.

Produce DISTINCT options — each a genuinely different proven angle: a direct callout, a contrarian take, a curiosity gap, problem-then-agitate, a specific result, or a pointed question naming a real pain.

WHAT MAKES IT CONVERT (non-negotiable):
- HOOK: the first 3 words must stop the scroll. No throat-clearing.
- SPECIFIC over vague, always ("your first 5 clients in 60 days", not "grow your business").
- SUB earns the click with ONE concrete benefit or proof. Never hedge ("maybe it's time", "consider").
- CTA is specific, active, and MATCHES THE OFFER: free class → "Save my seat"; download → "Send me the guide"; training → "Watch the training"; waitlist → "Join the waitlist". The CTA must reflect what actually happens on click.
- Mirror the brand's voice samples. Sound like a real person talking to one person.

LENGTH DISCIPLINE (non-negotiable):
- Prioritize ONE dominant headline. Stay within every slot's word limit so type renders large and consistent — never exceed a limit to fit more words.
- If an idea won't fit the budget, cut words or pick a sharper idea. Do NOT spill into the next slot.

BANNED — using any of these is an instant fail: "learn more", "find out more", "click here", "sign up", "get started", "simplify your approach", "take it to the next level", "maybe it's time", "unlock", "discover the secrets", "proven strategies", "elevate", "game-changer", "in today's world", "are you ready to", "look no further", "the ultimate", "supercharge", "dive in", "kickstart", "level up". No exclamation-mark spam — use the brand's punctuation only.

CALIBRATION — match STRONG, never WEAK:
WEAK   -> headline: "Your last shiny object subscription?" | sub: "Maybe it's time to simplify your approach." | cta: "Learn more"
STRONG -> headline: "You don't need another app. You need clients." | sub: "The free class that books 5 clients in 60 days — and replaces your whole tool stack." | cta: "Save my seat"

SENTENCE CASE headlines (first word + proper nouns only). COMPLIANCE: never promise guaranteed income or results; imply, never guarantee.`;

// exact slots per template (keys + length guidance)
const CTA_RULE = `cta (<=4 words, MUST match the brief's offer/format — e.g. free class → "Save my seat", download → "Send me the guide", waitlist → "Join the waitlist"; NEVER "Learn more", "Sign up", "Get started")`;
const SLOTS: Record<string,string> = {
  cutout: `eyebrow (<=5 words), headlinePre (1-3 words), headlineHL (1-3 words, the highlighted phrase), headlinePost (2-6 words), accent (optional italic kicker <=6 words or ""), sub (one sentence <=15 words), ${CTA_RULE}, badgeTop (<=2 words), badgeBottom (<=3 words)`,
  spotlight: `eyebrow (<=6 words, a details line), headline (<=8 words), sub (one sentence <=18 words), ${CTA_RULE}`,
  framed: `headlinePre (1-4 words, lowercase lead-in), headlineHL (2-5 words, bold phrase in CAPS), headlinePost (2-6 words, lowercase tail), ${CTA_RULE}, sig (brand or person name)`,
  split: `eyebrow (<=3 words), headline (<=9 words, shown in CAPS), ${CTA_RULE}`,
  highlighter: `headlinePre (1-3 words), headlineAccent (1-3 words, accent color), headlineHL (1-3 words, highlighted phrase), sub (one sentence <=14 words), badgeTop (<=2 words e.g. FREE), badgeBottom (<=2 words e.g. Download)`,
  overlay: `eyebrow (<=5 words), headline (<=8 words, bold), sub (one sentence <=16 words), ${CTA_RULE}`,
  devicemockup: `eyebrow (<=5 words), headline (<=8 words), sub (one sentence <=16 words), ${CTA_RULE}`,
  testimonial: `eyebrow (<=4 words, e.g. "Real result"), quote (a short testimonial in the customer's own voice, <=22 words), author (first name + last initial), role (title or business, 2-4 words)`,
  statgrid: `eyebrow (<=5 words, e.g. "Real planner results"), headline (<=8 words — the claim the numbers prove), stat1Num (the metric itself, very short: "85%", "3X", "2 hrs", "$42K"), stat1Label (<=6 words — what that number means), stat2Num, stat2Label, stat3Num, stat3Label, stat4Num, stat4Label (use 2–4 stats total; set unused Num/Label to ""), sub (optional, one sentence <=14 words, or ""), ${CTA_RULE}`,
  checklist: `eyebrow (<=5 words, e.g. "Inside the masterclass"), headline (<=8 words — what the list delivers), item1, item2, item3, item4, item5, item6 (each a concrete deliverable or step, <=7 words; use 3–6 items, set the rest to ""), sub (optional <=14 words or ""), ${CTA_RULE}`,
  chatproof: `eyebrow (<=5 words, e.g. "What planners are saying"), headline (<=8 words), msg1 (a short text-message line — the question or objection, <=12 words), msg2 (the reply, <=12 words), msg3 (the win/result, <=12 words), msg4 (optional 4th bubble or ""), sub (optional <=14 words or ""), cta (<=4 words, matches the offer)`,
  event: `eyebrow (<=4 words, e.g. "Free live class"), headline (<=8 words — the event title), meta (the date/time line; if the brief does NOT give a real date, output a bracketed placeholder like "[Day, Mon DD · time ET]" for the user to fill — NEVER invent a date), sub (<=16 words — what they'll learn), host (optional "with <name>" or ""), cta (<=4 words, e.g. "Save my seat")`,
  offer: `eyebrow (<=4 words, e.g. "This week only"), offerBig (the discount/price hero — short: "40% off", "$200 off"; if the brief gives no real number use "[your offer]"), headline (<=7 words — what's on sale), sub (<=14 words — what's included), expiry (urgency line only if the brief gives a real deadline, else ""), tickerTop (optional short repeating phrase like "Flash sale · Flash sale" or ""), tickerBottom (optional like "Ends Sunday · Ends Sunday" or ""), cta (<=4 words)`,
  bigtype: `eyebrow (<=5 words), headlinePre (lead-in words, <=4 words), headlineHL (the punchy highlighted phrase, <=4 words), headlinePost (closing words, <=5 words), sub (optional <=12 words or ""), cta (<=4 words). Keep the full headline under ~10 words total — the type is huge`,
  collage: `eyebrow (<=5 words), headline (<=7 words), sub (optional <=12 words or ""), cta (<=4 words)`,
};

function mapStyle(styleHint?: string, format?: string): string {
  if (format === "carousel") return "carousel";
  const m: Record<string,string> = { "photo-forward":"cutout","card":"spotlight","framed":"framed","type-led":"split","testimonial":"testimonial","highlighter":"highlighter","stats":"statgrid","data":"statgrid","checklist":"checklist","list":"checklist","steps":"checklist","chat":"chatproof","proof":"chatproof","testimonialchat":"chatproof","event":"event","webinar":"event","offer":"offer","sale":"offer","discount":"offer","bigtype":"bigtype","type-hero":"bigtype","collage":"collage","grid":"collage" };
  return (styleHint && m[styleHint]) || "cutout";
}

function instruction(template: string, count: number): string {
  if (template === "carousel") {
    return `Return ${count} option(s). Each option is {"slides":[...]} with one slide per slidePlan role (3-6 slides). Each slide = {"eyebrow":"<=4 words","headline":"<=8 words","sub":"one sentence <=15 words","cta":"ONLY on the last slide, <=4 words, MUST match the brief's offer/format — e.g. free class → \\"Save my seat\\", download → \\"Send me the guide\\", waitlist → \\"Join the waitlist\\"; NEVER \\"Learn more\\", \\"Sign up\\", \\"Get started\\"; omit on other slides"}. Slide 1 = the hook; last slide = the CTA.`;
  }
  return `Return ${count} DISTINCT option(s) (different angles). For template "${template}", each option is a JSON object with EXACTLY these keys: ${SLOTS[template] || SLOTS.cutout}. Use "" for any optional field you skip. Full headline reads as one natural line, <=8 words.`;
}

function truncate(v: unknown, max = 1400): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function buildContextBlock(payload: any): string {
  const { offerContext, offerPsychology, audiencePsychology, brandContext } = payload || {};
  const parts: string[] = [];
  if (offerContext && (offerContext.name || offerContext.description || offerContext.price || offerContext.url)) {
    parts.push(
      `=== OFFER ===\n` +
      `Name: ${offerContext.name || "(unnamed)"}\n` +
      (offerContext.type ? `Type: ${offerContext.type}\n` : "") +
      (offerContext.price ? `Price: ${offerContext.price}\n` : "") +
      (offerContext.url ? `URL: ${offerContext.url}\n` : "") +
      (offerContext.description ? `Description: ${truncate(offerContext.description, 600)}\n` : "") +
      (offerContext.messagingGuidelines ? `Messaging guidelines: ${truncate(offerContext.messagingGuidelines, 600)}\n` : "")
    );
  }
  if (offerPsychology) {
    const op: any = offerPsychology;
    const block: string[] = [`=== OFFER PSYCHOLOGY (use specific lines from here verbatim or paraphrased) ===`];
    if (op.moment_they_realize) block.push(`Moment they realize they need this: "${op.moment_they_realize}"`);
    if (op.alternative_they_tried) block.push(`What they already tried (and why it failed): "${op.alternative_they_tried}"`);
    if (op.emotional_before_after) block.push(`Before: "${op.emotional_before_after.before || ""}"\nAfter: "${op.emotional_before_after.after || ""}"`);
    if (op.what_finally_convinces) block.push(`What finally convinces them: "${op.what_finally_convinces}"`);
    if (op.why_they_need_this) block.push(`Why they need this: "${op.why_they_need_this}"`);
    if (Array.isArray(op.specific_hesitations) && op.specific_hesitations.length) {
      block.push(`Specific hesitations to overcome:\n${op.specific_hesitations.slice(0,5).map((h: string, i: number) => `${i+1}. "${h}"`).join("\n")}`);
    }
    // Fallback: dump remaining shape if none of the known fields matched
    if (block.length === 1) block.push(truncate(op, 1000));
    parts.push(block.join("\n"));
  }
  if (audiencePsychology) {
    const ap: any = audiencePsychology;
    const block: string[] = [`=== AUDIENCE PSYCHOLOGY ===`];
    const arrLine = (label: string, arr: any) => {
      if (Array.isArray(arr) && arr.length) block.push(`${label}: ${arr.slice(0,5).map((x: any) => `"${typeof x === "string" ? x : JSON.stringify(x)}"`).join(" | ")}`);
    };
    arrLine("Pain points", ap.painPoints || ap.pain_points);
    arrLine("Desires", ap.desires);
    arrLine("Objections", ap.objections);
    arrLine("Motivations", ap.motivations);
    if (ap.identity) block.push(`Identity: "${truncate(ap.identity, 300)}"`);
    if (block.length === 1) block.push(truncate(ap, 1000));
    parts.push(block.join("\n"));
  }
  if (brandContext && (brandContext.name || brandContext.idealClient || brandContext.voiceNotes)) {
    parts.push(
      `=== BRAND ===\n` +
      (brandContext.name ? `Brand: ${brandContext.name}\n` : "") +
      (brandContext.idealClient ? `Ideal client: ${truncate(brandContext.idealClient, 400)}\n` : "") +
      (brandContext.voiceNotes ? `Voice notes: ${truncate(brandContext.voiceNotes, 400)}\n` : "")
    );
  }
  return parts.join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const { brief = {}, brandVoice = {}, count = 3, feedback = null } = body;
    const template = brief.template || mapStyle(brief.styleHint, brief.format);
    const feedbackBlock = feedback && (feedback.quickSelections?.length || feedback.additionalNotes)
      ? `\n\nUSER FEEDBACK ON PREVIOUS COPY — apply these changes in this rewrite:\n- Issues: ${(feedback.quickSelections || []).join(", ") || "(none)"}\n- Notes: ${feedback.additionalNotes || "(none)"}\n`
      : "";
    const contextBlock = buildContextBlock(body);
    const user =
      `${contextBlock ? contextBlock + "\n\n" : ""}` +
      `=== CREATIVE BRIEF ===\n${JSON.stringify(brief)}\n\n` +
      `=== BRAND VOICE SAMPLES (mirror the tone, rhythm, punctuation) ===\n${JSON.stringify(brandVoice)}` +
      `${feedbackBlock}\n\n` +
      `${instruction(template, count)}\n\n` +
      `Hard rule: every option must reference at least one SPECIFIC element from the OFFER PSYCHOLOGY or AUDIENCE PSYCHOLOGY above (a named moment, a real pain, a real hesitation, a concrete before/after). Generic copy that could belong to any brand is an instant fail.\n\n` +
      `Output ONLY valid JSON: {"template":"${template}","options":[ ... ]}`;
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", temperature: 0.9, response_format: { type: "json_object" },
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
    // Strip any HTML/markdown emphasis tags the model may have produced (e.g. <b>...</b>)
    const stripTags = (s: string) => s
      .replace(/<\/?[a-zA-Z][^>]*>/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const sanitize = (v: any): any => {
      if (typeof v === "string") return stripTags(v);
      if (Array.isArray(v)) return v.map(sanitize);
      if (v && typeof v === "object") {
        const out: any = {};
        for (const k of Object.keys(v)) out[k] = sanitize(v[k]);
        return out;
      }
      return v;
    };
    let cleaned = content;
    try {
      const parsed = JSON.parse(content);
      cleaned = JSON.stringify(sanitize(parsed));
    } catch {
      cleaned = stripTags(content);
    }
    return new Response(cleaned, { status: 200, headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    console.error("compose-ad exception:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e), options: [] }), { status: 200, headers: { ...cors, "content-type": "application/json" } });
  }
});
