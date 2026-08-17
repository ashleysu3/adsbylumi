// Shared prompt block: THIS brand's voice + the offer's messaging guidelines +
// the offer/brand buyer psychology, plus any real examples the user gave us.
//
// Angles and concepts were previously generated without the brand's voice, so
// they sounded like generic direct-response copy. Every creative generator
// should ground itself in the same voice source of truth.

type Db = { from: (t: string) => any };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).filter(Boolean) : [];

function voiceProfileLines(vp: any): string {
  if (!vp || typeof vp !== "object") return "";
  const out: string[] = [];
  const push = (label: string, val: unknown) => {
    const s = typeof val === "string" ? val.trim() : arr(val).join(" | ");
    if (s) out.push(`- ${label}: ${s}`);
  };
  push("Voice summary", vp.summary);
  push("Tone", vp.tone ?? vp.tone_descriptors);
  push("Personality", vp.personality ?? vp.traits);
  push("Sentence style / rhythm", vp.style ?? vp.sentence_style ?? vp.rhythm);
  push("Vocabulary they actually use", vp.vocabulary ?? vp.signature_phrases ?? vp.phrases);
  push("Words / phrases to avoid", vp.avoid ?? vp.never_use ?? vp.banned_words);
  push("How they address the reader", vp.point_of_view ?? vp.audience_address);
  push("Emoji / punctuation habits", vp.emoji ?? vp.punctuation);
  const samples = arr(vp.examples ?? vp.sample_sentences ?? vp.sample_copy);
  if (samples.length) {
    out.push("- REAL SENTENCES IN THEIR VOICE (match this cadence, do not copy verbatim):");
    samples.slice(0, 8).forEach((s) => out.push(`   • ${s}`));
  }
  return out.join("\n");
}

function psychLines(label: string, p: any): string {
  if (!p || typeof p !== "object") return "";
  const out: string[] = [];
  const push = (l: string, v: unknown) => {
    const s = typeof v === "string" ? v.trim() : arr(v).join(" | ");
    if (s) out.push(`- ${l}: ${s}`);
  };
  push("Pain points", p.pain_points ?? p.painPoints);
  push("Desires", p.desires);
  push("Objections / hesitations", p.objections ?? p.specific_hesitations);
  push("Moment they realize they need this", p.moment_they_realize);
  push("What they already tried", p.alternative_they_tried);
  push("What finally convinces them", p.what_finally_convinces);
  push("Buying triggers", p.buying_triggers ?? p.buyingTriggers);
  push("Emotional before → after", p.emotional_before_after);
  push("Identity shift", p.identity_shift);
  if (!out.length) return "";
  return `\n${label}:\n${out.join("\n")}`;
}

/**
 * Builds the "write it in THEIR voice" block. Returns "" when we have nothing,
 * so callers can interpolate it unconditionally.
 */
export async function buildBrandVoiceBlock(
  supabase: Db,
  brandId?: string | null,
  offerId?: string | null,
): Promise<string> {
  if (!brandId && !offerId) return "";

  let brand: any = null;
  let offer: any = null;

  try {
    if (brandId) {
      const { data } = await supabase
        .from("brands")
        .select("name, brand_voice, voice_profile, value_proposition, target_audience, audience_psychology")
        .eq("id", brandId)
        .maybeSingle();
      brand = data;
    }
  } catch (_e) { /* voice is additive — never block generation */ }

  try {
    if (offerId) {
      const { data } = await supabase
        .from("offers")
        .select("name, description, messaging_guidelines, product_psychology, offer_audience_psychology, target_outcome, price_point")
        .eq("id", offerId)
        .maybeSingle();
      offer = data;
    }
  } catch (_e) { /* ignore */ }

  const sections: string[] = [];

  const voiceSummary = str(brand?.brand_voice);
  const vpLines = voiceProfileLines(brand?.voice_profile);
  if (voiceSummary || vpLines) {
    sections.push(
      `BRAND VOICE — ${brand?.name || "this brand"} (NON-NEGOTIABLE):\n` +
        (voiceSummary ? `- In their own words: ${voiceSummary}\n` : "") +
        (vpLines ? `${vpLines}\n` : "") +
        `Every angle name, description, hook and line of copy must sound like it came from this brand's own mouth. If a phrasing would feel out of place on their site or in their emails, rewrite it.`,
    );
  }

  const vp = str(brand?.value_proposition);
  const ta = str(brand?.target_audience);
  if (vp || ta) {
    sections.push(
      `BRAND POSITIONING:\n${vp ? `- Value proposition: ${vp}\n` : ""}${ta ? `- Who they serve: ${ta}\n` : ""}`.trimEnd(),
    );
  }

  if (offer) {
    const mg = str(offer.messaging_guidelines);
    const bits = [
      offer.name ? `- Offer: ${offer.name}` : "",
      offer.description ? `- What it is: ${str(offer.description)}` : "",
      offer.target_outcome ? `- Outcome it delivers: ${str(offer.target_outcome)}` : "",
      offer.price_point ? `- Price point: ${str(String(offer.price_point))}` : "",
      mg ? `- MESSAGING GUIDELINES FOR THIS OFFER (follow exactly): ${mg}` : "",
    ].filter(Boolean);
    if (bits.length) sections.push(`OFFER-SPECIFIC MESSAGING:\n${bits.join("\n")}`);
  }

  const buyer =
    psychLines("BUYER PSYCHOLOGY — THIS OFFER'S AUDIENCE", offer?.offer_audience_psychology) +
    psychLines("PRODUCT PSYCHOLOGY — WHY THEY BUY THIS", offer?.product_psychology) +
    psychLines("BRAND-LEVEL AUDIENCE PSYCHOLOGY", brand?.audience_psychology);
  if (buyer.trim()) {
    sections.push(
      `${buyer.trim()}\n\nGround every angle in the psychology above — name the real moment, the real objection, the real desire. Generic "struggling to grow?" framing is a fail.`,
    );
  }

  if (!sections.length) return "";

  return `\n\n=== THIS BRAND'S VOICE, OFFER & BUYER PSYCHOLOGY (HIGHEST PRIORITY CONTEXT) ===\n${sections.join("\n\n")}\n`;
}
