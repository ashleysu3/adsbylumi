// Shared helper: turn what we scraped off the user's own sales page into a
// prompt block the angle + copy generators can actually use.
//
// The scrape (extract-offer-info) already captures headline highlights, CTA
// language, tone notes, benefits, pain points and social proof. Before this
// helper those fields were saved to `offers.messaging_guidelines` and then
// either dropped or JSON-truncated into 600 chars of noise. Now every
// generator gets the same structured, quotable block.

export type PageLanguageSource = {
  messagingGuidelines?: any;
  offerAudiencePsychology?: any;
  productPsychology?: any;
  pageExcerpt?: string | null;
  url?: string | null;
};

const toList = (v: unknown, max = 8): string[] => {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
  return arr
    .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
};

const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

const bullets = (label: string, items: string[]) =>
  items.length ? `${label}:\n${items.map((s) => `- "${clamp(s, 240)}"`).join("\n")}\n\n` : "";

/**
 * Build the "USE THEIR WORDS" block. Returns "" when we have nothing real,
 * so callers can safely concatenate.
 */
export function buildPageLanguageBlock(src: PageLanguageSource): string {
  const mg = (src.messagingGuidelines && typeof src.messagingGuidelines === "object")
    ? src.messagingGuidelines as Record<string, any>
    : {};
  const oap = (src.offerAudiencePsychology && typeof src.offerAudiencePsychology === "object")
    ? src.offerAudiencePsychology as Record<string, any>
    : {};
  const pp = (src.productPsychology && typeof src.productPsychology === "object")
    ? src.productPsychology as Record<string, any>
    : {};

  const highlights = toList(mg.raw_copy_highlights ?? mg.headlines ?? mg.approved_examples);
  const usps = toList(mg.unique_selling_points ?? mg.key_benefits ?? oap.desires);
  const ctas = toList(mg.cta_language ?? mg.ctas, 6);
  const pains = toList(oap.pain_points ?? mg.pain_points);
  const hooks = toList(oap.emotional_hooks ?? mg.emotional_hooks);
  const objections = toList(oap.objections ?? mg.objections_addressed, 5);
  const dontSay = toList(mg.dont_say ?? mg.never_say, 8);
  const core = typeof mg.core_message === "string" ? mg.core_message.trim() : "";
  const tone = typeof (mg.tone_and_voice ?? mg.tone_notes) === "string"
    ? String(mg.tone_and_voice ?? mg.tone_notes).trim()
    : "";
  const proofRaw = pp.social_proof ?? mg.social_proof;
  const proof = typeof proofRaw === "string"
    ? [proofRaw]
    : Array.isArray(proofRaw)
      ? toList(proofRaw, 3)
      : proofRaw && typeof proofRaw === "object" && proofRaw.quote
        ? [String(proofRaw.quote)]
        : [];
  const excerpt = typeof src.pageExcerpt === "string" ? src.pageExcerpt.trim() : "";

  const hasAny =
    highlights.length || usps.length || ctas.length || pains.length || hooks.length ||
    objections.length || core || tone || proof.length || excerpt;
  if (!hasAny) return "";

  let out =
    "\n\n=== THEIR SALES PAGE — SOURCE LANGUAGE (HIGHEST-PRIORITY RAW MATERIAL) ===\n" +
    "Everything below was pulled from this brand's own live page" +
    (src.url ? ` (${src.url})` : "") +
    ". It is already converting language written in their voice.\n\n" +
    "HOW TO USE IT:\n" +
    "1. Mine it first. Before inventing a hook, angle or headline, look for one that already exists here.\n" +
    "2. Reuse exact phrases when they're strong — verbatim short phrases (3-10 words) from the page beat paraphrase.\n" +
    "3. Match their vocabulary and rhythm: same nouns for the offer, same words for the transformation, same level of formality. Do not upgrade their words into marketer-speak.\n" +
    "4. Never invent a claim, number, result, guarantee, bonus, deadline or testimonial that is not on the page.\n" +
    "5. If the page contradicts a generic best practice, the page wins.\n\n";

  if (core) out += `CORE MESSAGE: "${clamp(core, 400)}"\n\n`;
  if (tone) out += `THEIR VOICE / TONE (mirror this): ${clamp(tone, 400)}\n\n`;
  out += bullets("EXACT LINES FROM THE PAGE (quote or near-quote these)", highlights);
  out += bullets("WHAT THEY PROMISE (benefits / USPs, in their words)", usps);
  out += bullets("PAIN THEY NAME (in their words)", pains);
  out += bullets("EMOTIONAL HOOKS ALREADY ON THE PAGE", hooks);
  out += bullets("OBJECTIONS THE PAGE ANSWERS (safe to address)", objections);
  out += bullets("THEIR CTA LANGUAGE (match the button/action wording)", ctas);
  out += bullets("REAL SOCIAL PROOF ON THE PAGE (only proof you may reference)", proof);
  if (dontSay.length) out += bullets("NEVER SAY", dontSay);
  if (excerpt) {
    out += `RAW PAGE COPY (excerpt — pull phrasing from here):\n"""\n${clamp(excerpt, 6000)}\n"""\n\n`;
  }
  return out;
}

/**
 * Fetch an offer and build the block in one call. Safe: returns "" on any error.
 */
export async function fetchOfferPageLanguageBlock(
  supabase: any,
  offerId?: string | null,
): Promise<string> {
  if (!offerId) return "";
  try {
    const { data } = await supabase
      .from("offers")
      .select("url, messaging_guidelines, offer_audience_psychology, product_psychology, page_excerpt")
      .eq("id", offerId)
      .maybeSingle();
    if (!data) return "";
    return buildPageLanguageBlock({
      messagingGuidelines: (data as any).messaging_guidelines,
      offerAudiencePsychology: (data as any).offer_audience_psychology,
      productPsychology: (data as any).product_psychology,
      pageExcerpt: (data as any).page_excerpt,
      url: (data as any).url,
    });
  } catch (_e) {
    return "";
  }
}
