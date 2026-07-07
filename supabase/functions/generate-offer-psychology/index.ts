import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuthedUser } from "../_shared/check-subscription.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Same shape generate-product-psychology writes for a real `offers` row — this
// is the lightweight, pre-signup equivalent: no offers row exists yet in the
// ad-first flow, just a hand-typed offer hint, so this grounds compose-ad's
// OFFER PSYCHOLOGY block from that instead of leaving it empty.
// Best-effort page fetch, mirroring generate-audience-psychology's own site
// scrape — same timeout/strip/truncate approach so a slow or bot-blocked page
// degrades to "no real source" instead of hanging or crashing the request.
async function fetchPageText(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(t);
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
  } catch (e) {
    console.warn("generate-offer-psychology: page fetch failed", (e as any)?.message || e);
    return "";
  }
}

// Same shape generate-product-psychology writes for a real `offers` row — this
// is the lightweight, pre-signup equivalent: no offers row exists yet in the
// ad-first flow, just a hand-typed offer hint, so this grounds compose-ad's
// OFFER PSYCHOLOGY block from that instead of leaving it empty.
const SYSTEM_PROMPT = `You are an expert in offer positioning and buyer psychology, writing for direct-response Meta ad copy.

Given a brand's audience psychology and their offer, generate OFFER-AUDIENCE PSYCHOLOGY: how this specific audience relates to THIS specific offer (not generic advice). When real offer page copy is given, it's the highest-priority source — quote or closely paraphrase it over the brand owner's own short description.

- why_they_need_this: Why someone with this audience's psychology needs THIS specific offer (not just any solution). One or two sentences.
- moment_they_realize: The specific moment/scenario when they realize they need this. Paint a vivid, concrete picture — a real situation, not an abstraction.
- specific_hesitations: 3-5 objections specific to THIS offer (not generic "too expensive" — ground them in the audience's real pains/objections).
- what_finally_convinces: What makes them say yes to THIS specific offer.
- alternative_they_tried: What they've likely tried before that didn't work, and why this is different.
- emotional_before_after: { "before": "...", "after": "..." } — the emotional state shift this specific offer creates.

Never invent a specific price, stat, or guarantee that wasn't given. Be concrete and specific to this brand/offer, never generic boilerplate that could apply to any business.

Return ONLY valid JSON, no markdown:
{
  "why_they_need_this": "",
  "moment_they_realize": "",
  "specific_hesitations": [""],
  "what_finally_convinces": "",
  "alternative_they_tried": "",
  "emotional_before_after": { "before": "", "after": "" }
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const gate = await requireAuthedUser(req, cors);
  if (gate.blocked) return gate.blocked;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const { brand_id, offer_hint, offer_url, user_goal } = body || {};
    const hint = typeof offer_hint === "string" ? offer_hint.trim() : "";
    const url = typeof offer_url === "string" ? offer_url.trim() : "";
    if (!brand_id || (!hint && !url)) {
      return new Response(JSON.stringify({ error: "brand_id and at least one of offer_hint/offer_url are required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    // Cache key covers both inputs — either changing should invalidate the cache.
    const cacheKey = `${hint}|${url}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: brand } = await supabase
      .from("brands")
      .select("name, value_proposition, audience_psychology")
      .eq("id", brand_id)
      .maybeSingle();

    // Cache hit: same inputs we already generated for — skip the AI call entirely.
    const ap: any = brand?.audience_psychology || {};
    if (ap.onboarding_offer_psychology && ap.onboarding_offer_psychology_source_hint === cacheKey) {
      return new Response(JSON.stringify({ offer_psychology: ap.onboarding_offer_psychology, cached: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const pageText = url && /^https?:\/\//i.test(url) ? await fetchPageText(url) : "";

    const audienceContext = JSON.stringify(
      {
        painPoints: ap.painPoints || ap.pain_points || [],
        desires: ap.desires || [],
        objections: ap.objections || [],
        motivations: ap.motivations || [],
        identity: ap.identity || "",
      },
      null,
      2,
    );

    const userPrompt = `BRAND: ${brand?.name || "(unknown)"}
VALUE PROPOSITION: ${brand?.value_proposition || "(not given)"}
GOAL FOR THIS AD: ${user_goal || "get_leads"}

AUDIENCE PSYCHOLOGY:
${audienceContext}

THE OFFER, in the brand owner's own words (what happens when someone takes them up on this): ${hint ? `"${hint}"` : "(not given — use the real page copy below instead)"}
${pageText
  ? `\nREAL OFFER PAGE COPY (highest-priority source — this is what the page actually says, quote/paraphrase from it):\n${pageText}`
  : url
    ? `\n(The offer page at ${url} could not be read — fall back to the brand owner's description above.)`
    : ""}

Generate the offer-audience psychology profile for this exact offer and audience.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
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

    let offerPsychology: any;
    try {
      let cleaned = rawContent.trim();
      const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) cleaned = jsonMatch[1].trim();
      offerPsychology = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", rawContent);
      throw new Error("Failed to parse offer psychology from AI response");
    }

    // Cache on the brand for reuse (hook re-renders, script generation, retries)
    // without spending another AI call on the same offer hint.
    if (brand_id) {
      await supabase
        .from("brands")
        .update({
          audience_psychology: {
            ...ap,
            onboarding_offer_psychology: offerPsychology,
            onboarding_offer_psychology_source_hint: cacheKey,
          },
        })
        .eq("id", brand_id);
    }

    return new Response(JSON.stringify({ offer_psychology: offerPsychology, cached: false }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-offer-psychology error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
