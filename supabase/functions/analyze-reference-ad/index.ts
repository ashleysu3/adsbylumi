import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAuthedUser } from "../_shared/check-subscription.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// One line per template describing its visual personality — not its copy
// slots (compose-ad already knows those). This is what the model matches
// the reference ad's LOOK against, independent of what the reference is
// actually about.
const TEMPLATE_PERSONALITIES: Record<string, string> = {
  spotlight: "Full photo background behind a centered card (eyebrow/headline/sub/cta). Clean, premium, serif display headline.",
  framed: "Photo background, bold all-caps highlighted phrase, signature line at bottom. Magazine editorial feel.",
  split: "Photo background, short bold all-caps headline, minimal. Simple and direct.",
  overlay: "Full-bleed photo, eyebrow/headline/sub/cta. Clean and versatile, no strong personality of its own.",
  // devicemockup deliberately excluded: its photo slot renders as the literal
  // phone/laptop SCREEN content (a product/website screenshot), not a person
  // photo. The remix flow only has personal-photo sourcing today, so matching
  // to this template produces an unusable "personal photo squished onto a
  // device screen" result. Re-add once there's a real screenshot source.
  testimonial: "No photo — a quote and author name on a soft background. Warm, serif, editorial, social-proof-led.",
  statgrid: "No photo — 2-4 bold stat callouts in a grid. Data-driven, numeric, results-led.",
  checklist: "No photo — headline plus a checklist of items. Clear, benefit-listing, informational.",
  chatproof: "No photo — stylized chat/text bubbles as the design device. Conversational, modern.",
  event: "No photo — date/host/headline structured like a class or webinar promo.",
  offer: "No photo — a big discount/price number as the hero. Bold, sale/urgency-driven.",
  bigtype: "No photo — one huge bold headline fills the frame. Maximalist, high-energy, type-as-image.",
  collage: "Photo tiled/collaged as the background. Dynamic, busy, lifestyle-forward.",
  notesapp: "No photo — mimics a real iOS Notes app screenshot. Native, unpolished, personal, NOT ad-looking.",
  textthread: "No photo — mimics a real iMessage conversation. Native, conversational, NOT ad-looking.",
  nativecaption: "Full photo with plain bold caption text directly on it, no card or badge. Native, minimal, authentic.",
};

const SYSTEM_PROMPT = `You are a senior art director. You're shown ONE reference ad image. Your job is to figure out which of LUMI's existing ad templates would best recreate its STRUCTURE and FEEL — not its content, since the content will be replaced with a different brand's own offer and copy.

TEMPLATES AVAILABLE (name: visual personality):
${Object.entries(TEMPLATE_PERSONALITIES).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

HOW TO JUDGE:
1. Does the reference use a real photo of a person/scene, or is it text-only? Match needsPhoto accordingly — don't pick a photo template for a text-only reference or vice versa.
2. What's the typographic PERSONALITY — is it a huge bold maximalist headline, a quiet premium serif, a playful highlighter style, a native/unpolished screenshot look? Pick the template whose default typography feel is closest. If the reference's specific font/lettering is clearly load-bearing to its identity (a distinctive script, a signature display face that IS the design), say so explicitly and weight template choice toward one with a similarly distinctive typographic feel — you cannot literally copy a font file, so the honest move is picking the closest-personality match, not pretending to preserve the exact font.
3. What structural role does each visible text element play (a small eyebrow/kicker, the main headline, a supporting line, a CTA, a badge, a stat, a checklist item, a quote)? Describe this mapping so a copywriter can write NEW copy for a different brand/offer into the same structure.

Return ONLY valid JSON, no markdown:
{
  "template": "one of the exact template names above",
  "needs_photo": true/false,
  "font_personality": "one phrase describing the reference's typographic feel",
  "font_is_load_bearing": true/false,
  "template_reason": "1-2 sentences on why this template is the closest structural + typographic match",
  "structural_notes": "1-3 sentences mapping what content sits where in the reference (e.g. 'small kicker above a two-line bold headline, one supporting sentence, a pill-shaped CTA bottom-left') so a copywriter can write new content into the same shape"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const gate = await requireAuthedUser(req, cors);
  if (gate.blocked) return gate.blocked;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const { reference_image_url } = body || {};
    if (!reference_image_url || typeof reference_image_url !== "string") {
      return new Response(JSON.stringify({ error: "reference_image_url is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this reference ad and return the JSON described in your instructions." },
              { type: "image_url", image_url: { url: reference_image_url } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
          status: 402,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    let analysis: any;
    try {
      let cleaned = rawContent.trim();
      const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) cleaned = jsonMatch[1].trim();
      analysis = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", rawContent);
      throw new Error("Failed to parse reference-ad analysis from AI response");
    }

    // Guard against a hallucinated template name — fall back to a safe default
    // based on the photo flag rather than letting an unknown name reach the engine.
    if (!TEMPLATE_PERSONALITIES[analysis?.template]) {
      console.warn("analyze-reference-ad: unknown template returned, falling back", analysis?.template);
      analysis.template = analysis?.needs_photo ? "spotlight" : "bigtype";
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-reference-ad error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
