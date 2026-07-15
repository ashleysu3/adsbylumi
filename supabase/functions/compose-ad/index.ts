import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAuthedUser } from "../_shared/check-subscription.ts";
import { buildPositioningBriefBlock } from "../_shared/positioning-brief.ts";
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

// notesapp/textthread/nativecaption mimic a real phone screenshot, not a
// designed ad — the eyebrow/headline/CTA-button mindset above would break
// the illusion, so these get a different voice on top of the same brand
// grounding rules.
const NATIVE_TEMPLATES = new Set(["notesapp", "textthread", "nativecaption", "nativestroke", "nativebubbles"]);
const NATIVE_VOICE_ADDENDUM = `

NATIVE-FORMAT OVERRIDE — this template mimics a real phone screenshot (Notes app / text thread / photo caption), NOT a designed ad. For this one:
- Write like a real person typing to themselves or texting a friend — plain, unpolished, first person where natural. No headline/eyebrow/CTA-button mindset.
- BANNED here too: any CTA-button phrasing ("Save my seat", "Learn more", "Sign up"). If there's an ask, say it the way a person actually types it: "comment X and I'll send it", "link's in my bio", "DM me Y".
- Still ground every line in the real offer/audience psychology below — just say it the way a person actually talks, not the way an ad talks.`;

function voiceRulesFor(template: string): string {
  return NATIVE_TEMPLATES.has(template) ? VOICE_RULES + NATIVE_VOICE_ADDENDUM : VOICE_RULES;
}

// exact slots per template (keys + length guidance)
const CTA_RULE = `cta (<=4 words, MUST match the brief's offer/format — e.g. free class → "Save my seat", download → "Send me the guide", waitlist → "Join the waitlist"; NEVER "Learn more", "Sign up", "Get started")`;
const SLOTS: Record<string,string> = {
  spotlight: `eyebrow (<=6 words, a details line), headline (<=8 words), sub (one sentence <=18 words), ${CTA_RULE}`,
  framed: `headlinePre (1-4 words, lowercase lead-in), headlineHL (2-5 words, bold phrase in CAPS), headlinePost (2-6 words, lowercase tail), ${CTA_RULE}, sig (brand or person name)`,
  split: `eyebrow (<=3 words), headline (<=9 words, shown in CAPS), ${CTA_RULE}`,
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
  notesapp: `body (the note itself: 1-3 short paragraphs separated by a blank line, written in first person like a real personal note or confession — plain and unpolished, NOT structured like ad copy, <=55 words total), cta (optional ONE line asking them to comment/DM/save, styled as part of the note rather than a button, <=10 words, or "" to skip)`,
  textthread: `contactName (a believable first name only), contactLoc (optional short context under the name like a city, or ""), msg1 (received message — a real question a friend would text, <=14 words), msg2 (sent message — a short reply, <=12 words), msg3 (received message — a reaction or follow-up question, <=8 words, or "" to keep it to 2 messages), msg4 (sent message — the payoff; can end like "link's in my bio" instead of a formal CTA, <=18 words)`,
  nativecaption: `line1 (the setup line, plain and matter-of-fact, <=10 words), line2 (the punchline/reveal, a bolder statement, <=10 words), cta (optional tiny caption-style line, <=6 words, or "" to skip)`,
  nativestroke: `line1 (the setup line, plain and matter-of-fact, <=10 words), line2 (the punchline/reveal, a bolder statement, <=10 words), cta (optional tiny caption-style line, <=6 words, or "" to skip)`,
  nativebubbles: `bubble1 (a short standalone phrase or reaction, <=8 words — like a real caption bubble, not a headline), bubble2 (the next beat — the specific result or proof, <=10 words), bubble3 (optional closing bubble — a soft ask like "comment X" or a punchy final line, <=8 words, or "" to use just 2 bubbles)`,
};

function mapStyle(styleHint?: string, format?: string): string {
  if (format === "carousel") return "carousel";
  const m: Record<string,string> = { "photo-forward":"spotlight","card":"spotlight","framed":"framed","type-led":"split","testimonial":"testimonial","stats":"statgrid","data":"statgrid","checklist":"checklist","list":"checklist","steps":"checklist","chat":"chatproof","proof":"chatproof","testimonialchat":"chatproof","event":"event","webinar":"event","offer":"offer","sale":"offer","discount":"offer","bigtype":"bigtype","type-hero":"bigtype","collage":"collage","grid":"collage","overlay":"overlay","device":"devicemockup","devicemockup":"devicemockup","mockup":"devicemockup","notesapp":"notesapp","notes":"notesapp","textthread":"textthread","texts":"textthread","imessage":"textthread","nativecaption":"nativecaption","caption":"nativecaption","nativestroke":"nativestroke","stroke":"nativestroke","strokecaption":"nativestroke","nativebubbles":"nativebubbles","bubbles":"nativebubbles","captionbubbles":"nativebubbles" };
  return (styleHint && m[styleHint]) || "bigtype";
}

function instruction(template: string, count: number, slideCount?: number): string {
  if (template === "carousel") {
    const n = Math.max(1, Math.min(10, Number(slideCount) || 5));
    return `Return ${count} option(s). Each option is {"slides":[...]} with EXACTLY ${n} slide(s) — do NOT return fewer than ${n} and do NOT return more. Each slide = {"eyebrow":"<=4 words","headline":"<=8 words","sub":"one sentence <=15 words","cta":"ONLY on the last (${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}) slide, <=4 words, MUST match the brief's offer/format — e.g. free class → \\"Save my seat\\", download → \\"Send me the guide\\", waitlist → \\"Join the waitlist\\"; NEVER \\"Learn more\\", \\"Sign up\\", \\"Get started\\"; omit on all other slides (use \\"\\")"}. Slide 1 = the hook; the middle slides deliver the payoff/proof/steps; the final slide = the CTA. Every slide must earn its place — no filler.`;
  }
  return `Return ${count} DISTINCT option(s) (different angles). For template "${template}", each option is a JSON object with EXACTLY these keys: ${SLOTS[template] || SLOTS.bigtype}. Use "" for any optional field you skip. Full headline reads as one natural line, <=8 words.`;
}

function truncate(v: unknown, max = 1400): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function buildContextBlock(payload: any): string {
  const { offerContext, offerPsychology, audiencePsychology, brandContext, socialProofContext, referenceAdContext, angle } = payload || {};
  const parts: string[] = [];
  if (angle && (angle.name || angle.description)) {
    // The user picked this angle from a set of three during onboarding —
    // it's first in the context block because it's a constraint, not a hint.
    parts.push(
      `=== ANGLE (the user chose this — EVERY option must execute THIS angle, varying the hook/wording, never the angle itself) ===\n` +
      (angle.name ? `Angle: ${truncate(angle.name, 100)}\n` : "") +
      (angle.description ? `What it means: ${truncate(angle.description, 400)}\n` : "") +
      (angle.psychologyTrigger ? `Psychology trigger to lean on: ${truncate(angle.psychologyTrigger, 120)}\n` : "")
    );
  }
  if (referenceAdContext && (referenceAdContext.structuralNotes || referenceAdContext.fontPersonality)) {
    parts.push(
      `=== REFERENCE AD YOU'RE ADAPTING (match this structure and rhythm — write NEW copy for THIS brand's offer, never reuse the reference's content) ===\n` +
      (referenceAdContext.structuralNotes ? `Structure: ${truncate(referenceAdContext.structuralNotes, 500)}\n` : "") +
      (referenceAdContext.fontPersonality ? `Typographic feel to match in tone/rhythm: ${truncate(referenceAdContext.fontPersonality, 200)}\n` : "")
    );
  }
  if (socialProofContext && socialProofContext.quote) {
    parts.push(
      `=== REAL TESTIMONIAL (from this brand's actual site — use it, do not invent a different one) ===\n` +
      `Quote: "${truncate(socialProofContext.quote, 500)}"\n` +
      (socialProofContext.attribution ? `Attribution: ${truncate(socialProofContext.attribution, 120)}\n` : "")
    );
  }
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
    // These were generated all along and silently dropped here — the summary
    // especially is the "brief a copywriter" paragraph, i.e. exactly what this
    // prompt is for.
    if (ap.summary) block.push(`Copywriter brief: "${truncate(ap.summary, 600)}"`);
    if (ap.target_audience) block.push(`Who they are: "${truncate(ap.target_audience, 300)}"`);
    if (ap.demographics) block.push(`Demographics: "${truncate(ap.demographics, 300)}"`);
    if (ap.psychographics) block.push(`Psychographics: "${truncate(ap.psychographics, 400)}"`);
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

// ----- Slot length enforcement -----

// Parse the SLOTS description string into per-key word budgets.
// Recognizes patterns like "key (<=N words ...)" and "key (1-3 words ...)" / "key (2-6 words ...)".
function parseSlotLimits(template: string): Record<string, { maxWords: number }> {
  const desc = SLOTS[template] || SLOTS.bigtype;
  const limits: Record<string, { maxWords: number }> = {};
  const re = /(\w+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(desc)) !== null) {
    const key = m[1];
    const inner = m[2];
    let maxWords: number | null = null;
    const le = inner.match(/<=\s*~?\s*(\d+)\s*words/i);
    if (le) maxWords = parseInt(le[1], 10);
    if (maxWords == null) {
      const range = inner.match(/(\d+)\s*[-–]\s*(\d+)\s*words/i);
      if (range) maxWords = parseInt(range[2], 10);
    }
    if (maxWords != null && (!limits[key] || maxWords < limits[key].maxWords)) {
      limits[key] = { maxWords };
    }
  }
  return limits;
}

// Carousel slides use a fixed mini-schema not in SLOTS.
const CAROUSEL_SLIDE_LIMITS: Record<string, { maxWords: number }> = {
  eyebrow: { maxWords: 4 },
  headline: { maxWords: 8 },
  sub: { maxWords: 15 },
  cta: { maxWords: 4 },
};

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function truncateToWords(s: string, maxWords: number): string {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return s.trim();
  return words.slice(0, maxWords).join(" ").replace(/[,;:\-–—.]+$/u, "").trim();
}

type Violation = { optionIndex: number; slideIndex?: number; key: string; words: number; max: number; value: string };

function findViolations(options: any[], template: string): Violation[] {
  const out: Violation[] = [];
  if (template === "carousel") {
    options.forEach((opt, oi) => {
      const slides = Array.isArray(opt?.slides) ? opt.slides : [];
      slides.forEach((slide: any, si: number) => {
        for (const [key, lim] of Object.entries(CAROUSEL_SLIDE_LIMITS)) {
          const v = slide?.[key];
          if (typeof v !== "string" || !v.trim()) continue;
          const w = wordCount(v);
          if (w > lim.maxWords) out.push({ optionIndex: oi, slideIndex: si, key, words: w, max: lim.maxWords, value: v });
        }
      });
    });
    return out;
  }
  const limits = parseSlotLimits(template);
  options.forEach((opt, oi) => {
    for (const [key, lim] of Object.entries(limits)) {
      const v = opt?.[key];
      if (typeof v !== "string" || !v.trim()) continue;
      const w = wordCount(v);
      if (w > lim.maxWords) out.push({ optionIndex: oi, key, words: w, max: lim.maxWords, value: v });
    }
  });
  return out;
}

function applyHardTruncation(options: any[], template: string, violations: Violation[]): void {
  for (const v of violations) {
    const opt = options[v.optionIndex];
    if (!opt) continue;
    if (template === "carousel" && v.slideIndex != null) {
      const slide = opt.slides?.[v.slideIndex];
      if (slide && typeof slide[v.key] === "string") {
        slide[v.key] = truncateToWords(slide[v.key], v.max);
      }
    } else if (typeof opt[v.key] === "string") {
      opt[v.key] = truncateToWords(opt[v.key], v.max);
    }
  }
}

function formatViolationsForRetry(violations: Violation[]): string {
  return violations
    .map((v) => {
      const loc = v.slideIndex != null
        ? `option ${v.optionIndex + 1}, slide ${v.slideIndex + 1}, slot "${v.key}"`
        : `option ${v.optionIndex + 1}, slot "${v.key}"`;
      return `- ${loc}: "${v.value}" (${v.words} words, max ${v.max}) — rewrite to ${v.max} words or fewer.`;
    })
    .join("\n");
}

async function callModel(systemPrompt: string, userPrompt: string): Promise<any> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 0.9,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  const d = await r.json();
  return { ok: r.ok, status: r.status, data: d };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const gate = await requireAuthedUser(req, cors);
  if (gate.blocked) return gate.blocked;
  try {
    const body = await req.json();
    const { brief = {}, brandVoice = {}, count = 3, slideCount, feedback = null, positioningBrief = null } = body;
    const template = brief.template || mapStyle(brief.styleHint, brief.format);
    const feedbackBlock = feedback && (feedback.quickSelections?.length || feedback.additionalNotes)
      ? `\n\nUSER FEEDBACK ON PREVIOUS COPY — apply these changes in this rewrite:\n- Issues: ${(feedback.quickSelections || []).join(", ") || "(none)"}\n- Notes: ${feedback.additionalNotes || "(none)"}\n`
      : "";
    const contextBlock = buildContextBlock(body);
    const positioningBlock = buildPositioningBriefBlock(positioningBrief);
    const realTestimonialRule = template === "testimonial" && body.socialProofContext?.quote
      ? `Hard rule: the "quote" field must be the REAL TESTIMONIAL above, verbatim or lightly trimmed to fit the word limit without changing its meaning or voice — never write a new/invented testimonial. Set "author"/"role" from its real attribution (split "Name, context" into author="Name", role="context"); if no attribution was given, use author="Verified client" and role="".\n\n`
      : "";
    const user =
      `${contextBlock ? contextBlock + "\n\n" : ""}` +
      `${positioningBlock}` +
      `=== CREATIVE BRIEF ===\n${JSON.stringify(brief)}\n\n` +
      `=== BRAND VOICE SAMPLES (mirror the tone, rhythm, punctuation) ===\n${JSON.stringify(brandVoice)}` +
      `${feedbackBlock}\n\n` +
      `${instruction(template, count, slideCount)}\n\n` +
      `${realTestimonialRule}` +
      `Hard rule: every option must reference at least one SPECIFIC element from the OFFER PSYCHOLOGY or AUDIENCE PSYCHOLOGY above (a named moment, a real pain, a real hesitation, a concrete before/after). Generic copy that could belong to any brand is an instant fail.\n\n` +
      `Output ONLY valid JSON: {"template":"${template}","options":[ ... ]}`;

    const first = await callModel(voiceRulesFor(template), user);
    if (!first.ok) {
      const msg = first.data?.error?.message || `OpenAI HTTP ${first.status}`;
      console.error("compose-ad openai error:", msg, JSON.stringify(first.data).slice(0, 500));
      return new Response(JSON.stringify({ error: msg, options: [] }), { status: 200, headers: { ...cors, "content-type": "application/json" } });
    }
    const content = first.data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("compose-ad empty content:", JSON.stringify(first.data).slice(0, 500));
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

    let parsed: any;
    try {
      parsed = sanitize(JSON.parse(content));
    } catch {
      // Couldn't parse — return raw stripped content (preserves previous behavior).
      return new Response(stripTags(content), { status: 200, headers: { ...cors, "content-type": "application/json" } });
    }

    let options: any[] = Array.isArray(parsed?.options) ? parsed.options : [];

    // Validate slot lengths. If any slot is over, re-prompt ONCE with the specific offenders.
    let violations = findViolations(options, template);
    if (violations.length > 0) {
      console.log(`compose-ad: ${violations.length} slot(s) over budget on first pass, retrying once.`);
      const retryUser =
        `The previous JSON had slots that exceeded the per-slot word budget. ` +
        `Rewrite the SAME options keeping the same angles, ideas, and structure — only shorten the offenders. ` +
        `Do NOT spill the cut words into another slot. Output the FULL same JSON shape.\n\n` +
        `OVER-LENGTH SLOTS TO SHORTEN:\n${formatViolationsForRetry(violations)}\n\n` +
        `Previous JSON:\n${JSON.stringify(parsed)}\n\n` +
        `Output ONLY valid JSON: {"template":"${template}","options":[ ... ]}`;
      const second = await callModel(voiceRulesFor(template), retryUser);
      if (second.ok) {
        const retryContent = second.data?.choices?.[0]?.message?.content;
        if (retryContent) {
          try {
            const retryParsed = sanitize(JSON.parse(retryContent));
            if (Array.isArray(retryParsed?.options) && retryParsed.options.length > 0) {
              parsed = retryParsed;
              options = retryParsed.options;
            }
          } catch (err) {
            console.error("compose-ad retry parse failed:", err);
          }
        }
      } else {
        console.error("compose-ad retry HTTP error:", second.status);
      }

      // Last resort: hard-truncate any remaining offenders at a word boundary.
      violations = findViolations(options, template);
      if (violations.length > 0) {
        console.log(`compose-ad: hard-truncating ${violations.length} remaining over-length slot(s).`);
        applyHardTruncation(options, template, violations);
        parsed.options = options;
      }
    }

    return new Response(JSON.stringify(parsed), { status: 200, headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    console.error("compose-ad exception:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e), options: [] }), { status: 200, headers: { ...cors, "content-type": "application/json" } });
  }
});
