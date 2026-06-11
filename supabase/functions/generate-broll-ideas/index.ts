import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getAuthenticatedUser } from "../_shared/internal-auth.ts";
import { requirePaidUser } from "../_shared/check-subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const gate = await requirePaidUser(req, corsHeaders);
  if (gate.blocked) return gate.blocked;
  const user = { id: gate.userId! };


  try {
    const body = await req.json();
    const { brandId } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Pull rich brand context server-side
    let brandName = body.brandName || "";
    let industry = body.industry || "";
    let targetAudience = body.targetAudience || "";
    let valueProposition = body.valueProposition || "";
    let brandVoice = "";
    let audiencePsychology: any = null;
    let offers: any[] = [];
    let audiences: any[] = [];

    if (brandId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: brand } = await supabase
        .from("brands")
        .select("name, industry, brand_voice, target_audience, value_proposition, audience_psychology, website_url")
        .eq("id", brandId)
        .maybeSingle();

      if (brand) {
        brandName = brandName || brand.name || "";
        industry = industry || brand.industry || "";
        targetAudience = targetAudience || brand.target_audience || "";
        valueProposition = valueProposition || brand.value_proposition || "";
        brandVoice = brand.brand_voice || "";
        audiencePsychology = brand.audience_psychology || null;
      }

      const [{ data: offerRows }, { data: audienceRows }] = await Promise.all([
        supabase.from("offers").select("name, type, price, auto_summary, offer_psychology").eq("brand_id", brandId).limit(5),
        supabase.from("audiences").select("name, psychology_profile, pain_points, desires").eq("brand_id", brandId).limit(5),
      ]);
      offers = offerRows || [];
      audiences = audienceRows || [];
    }

    const brandContext = JSON.stringify(
      {
        brandName,
        industry,
        brandVoice,
        targetAudience,
        valueProposition,
        audiencePsychology,
        offers,
        audiences,
      },
      null,
      2,
    );

    const systemPrompt = `You generate B-roll ideas for Meta ads. The B-roll plays BEHIND text/copy overlays — viewers READ the ad, the footage just adds warmth, motion, and a sense of the creator's world.

YOUR JOB: Use the brand context (industry, audience psychology, pains, desires, offers, brand voice) to suggest B-roll clips that:
1. RESONATE with this specific audience — they should silently signal "this is for me" because the scene mirrors the audience's life, environment, aspirations, or daily reality.
2. CONVEY THE BRAND'S VIBE — energy, aesthetic, and world (e.g. cozy/slow vs. fast/ambitious vs. luxe vs. raw/real).
3. ARE DEAD SIMPLE to film on a phone in under 60 seconds, alone, with no crew, no actors, no props they don't already own.

HARD RULES (non-negotiable):
- Action-based only. The creator is doing a real, mundane action — never "acting," posing, or performing to camera.
- Lofi aesthetic. Phone footage, natural light, real environments. No production value required.
- No talking, no facial expressions, no choreography. Often the creator's face isn't even in frame (hands, feet, over-the-shoulder, POV, environment shots all preferred).
- No props or locations that require buying, renting, or traveling.
- One simple sentence per direction. Tell them exactly what to point the phone at.

HOW TO MAKE IT RESONANT (without breaking the rules):
- Pull from the audience's daily reality (e.g. a busy mom audience → folding tiny laundry; a corporate-escape audience → laptop closing at a kitchen table; a wellness audience → tea steeping, journal open).
- Pull from the creator's actual world signaled by the brand (e.g. a coach → notebook + highlighter on a desk; a designer → moodboard pinned to a wall; a fitness brand → water bottle + sneakers by the door).
- Match the brand voice / vibe in WHAT is in frame (cozy lamp + linen vs. clean white desk + Aesop bottle vs. messy creative chaos).
- It's fine — and good — for scenes to subtly echo the offer's transformation (e.g. "open laptop with a calm morning coffee" for a "quit the 9–5" offer), as long as the action stays generic and unstaged.

WHAT TO AVOID:
- Generic stock-feeling scenes that could be ANY business with zero connection to this brand.
- On-the-nose product/offer shots (no holding up a course mockup, no screen recordings of the offer, no logos).
- Anything requiring acting, multiple takes, or a second person.
- Anything cinematic, drone, slider, gimbal, or "produced."

OUTPUT — return ONLY valid JSON, no markdown:
{
  "ideas": [
    {
      "emoji": "☕",
      "scene": "Short scene title (3-5 words)",
      "direction": "One sentence: exactly where to point the phone and what action to do.",
      "mood": "Calm",
      "whyItResonates": "One short line tying this scene to a specific audience pain/desire or brand vibe."
    }
  ]
}

Generate exactly 15 ideas. Vary the moods, settings, and times of day. Mood must be one of: Calm, Productive, Relatable, Warm, Authentic, Energetic, Aspirational, Grounded.`;

    const userPrompt = `Generate 15 B-roll clip ideas tailored to this brand and audience. Use the audience psychology (pains, desires, daily life) and brand voice/vibe to make each scene resonate — while keeping every clip lofi, action-based, no-acting, and filmable on a phone in under a minute.

BRAND CONTEXT:
${brandContext}

Remember: the footage plays behind ad copy. It should make THIS audience feel "that's my life" or "that's the life I want," and feel like THIS brand's world — without being on-the-nose about the offer.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI gateway returned ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    let ideas;
    try {
      let cleaned = rawContent.trim();
      const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        cleaned = jsonMatch[1].trim();
      }
      const parsed = JSON.parse(cleaned);
      ideas = parsed.ideas || parsed;
    } catch (parseErr) {
      console.error("Failed to parse AI response:", rawContent);
      throw new Error("Failed to parse B-roll ideas from AI response");
    }

    return new Response(JSON.stringify({ ideas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-broll-ideas error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
