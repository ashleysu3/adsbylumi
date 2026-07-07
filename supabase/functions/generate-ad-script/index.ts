import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuthedUser } from "../_shared/check-subscription.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Keep in sync with CATEGORIES in src/pages/admin/StockBroll.tsx — these are
// the only tags real stock footage is filed under, so a beat tagged outside
// this list can never be matched to a clip.
const CATEGORIES = [
  "working-laptop", "coffee", "hobby", "lifestyle", "animals",
  "driving-in-car", "work-event", "meeting-podcast", "teaching",
  "travel-vacation", "misc",
];

const SYSTEM_PROMPT = `You write short talking-head video ad scripts for coaches, course creators, and service providers. The creator will read this OUT LOUD to camera, so it must sound like natural spoken language — never like banner-ad copy or a headline.

STRUCTURE (exactly 4 beats, in this order):
1. HOOK — call out the exact person or exact pain in one breath. Stop the scroll the way a person talking would, not a slogan.
2. PROBLEM — name the specific struggle or mistake this audience has, in their own words.
3. SOLUTION — what changes / what you actually do about it. Concrete, not vague ("I'll show you X", not "let's elevate your business").
4. CTA — the exact next step, matching the real offer. Say what happens when they take it.

HARD RULES:
- Each beat is ONE short spoken sentence, 6-14 words. This is spoken out loud, not read — contractions and casual phrasing are good.
- Sound like a real person talking to one person, in THIS brand's voice — never generic marketer-speak.
- The CTA must match the real offer/goal given. Never say "learn more" or "click the link" — say the actual thing that happens (book a call, get the guide, join the waitlist, etc).
- Never invent a specific price, stat, or claim that wasn't given in context.
- "category" must be exactly one of: ${CATEGORIES.join(", ")}. Pick whichever best matches the VISUAL BACKDROP for that beat (what b-roll should play behind this line while they talk) — not the beat's topic. Vary categories across beats when it makes sense; "misc" is a safe fallback.
- "seconds" is how long that beat takes to say out loud, normally 3-5.

OUTPUT — return ONLY valid JSON, no markdown:
{
  "beats": [
    { "line": "...", "category": "...", "seconds": 4 }
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const gate = await requireAuthedUser(req, cors);
  if (gate.blocked) return gate.blocked;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const { brand_id, user_goal, offer_hint } = body || {};
    if (!brand_id) {
      return new Response(JSON.stringify({ error: "brand_id is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: brand } = await supabase
      .from("brands")
      .select("name, industry, brand_voice, target_audience, value_proposition, audience_psychology")
      .eq("id", brand_id)
      .maybeSingle();

    const brandContext = JSON.stringify(
      {
        brandName: brand?.name || "",
        industry: brand?.industry || "",
        brandVoice: brand?.brand_voice || "",
        targetAudience: brand?.target_audience || "",
        valueProposition: brand?.value_proposition || "",
        audiencePsychology: brand?.audience_psychology || null,
        userGoal: user_goal || "get_leads",
        offer: offer_hint || "(no specific offer given — keep the CTA to the stated goal)",
      },
      null,
      2,
    );

    const userPrompt = `Write the 4-beat talking-head script for this brand.

BRAND CONTEXT:
${brandContext}

Remember: this is spoken out loud by the creator, on camera, in one continuous take. Keep every line something a real person would actually say.`;

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

    let beats: Array<{ line: string; category: string; seconds: number }> = [];
    try {
      let cleaned = rawContent.trim();
      const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) cleaned = jsonMatch[1].trim();
      const parsed = JSON.parse(cleaned);
      beats = Array.isArray(parsed.beats) ? parsed.beats : [];
    } catch (parseErr) {
      console.error("Failed to parse AI response:", rawContent);
      throw new Error("Failed to parse script from AI response");
    }

    // Sanitize: only keep well-formed beats with a category we actually stock footage for.
    const validCategories = new Set(CATEGORIES);
    beats = beats
      .filter((b) => b && typeof b.line === "string" && b.line.trim())
      .map((b) => ({
        line: b.line.trim(),
        category: validCategories.has(b.category) ? b.category : "misc",
        seconds: typeof b.seconds === "number" && b.seconds > 0 ? Math.min(8, Math.max(2, b.seconds)) : 4,
      }));

    if (!beats.length) throw new Error("No script beats returned");

    return new Response(JSON.stringify({ beats }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-ad-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
