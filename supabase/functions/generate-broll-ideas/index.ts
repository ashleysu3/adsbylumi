import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandName, industry, targetAudience, valueProposition } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are helping small business owners film dead-simple B-roll clips on their phone for Meta ads. These clips are NOT the main content — they're background footage that text/copy gets layered on top of. Think: silent, ambient, everyday life clips.

PURPOSE OF THIS B-ROLL:
- It plays BEHIND text overlays in ads. The viewer reads the copy, not watches the footage.
- It should feel lofi, casual, unstaged — like a friend filmed it on their phone.
- It exists to create visual movement and warmth while the ad copy does the selling.

WHAT TO SUGGEST:
- Typing on a laptop
- Walking somewhere (sidewalk, hallway, park)
- Pouring or stirring coffee/tea
- Fixing hair in a mirror
- Scrolling on phone
- Sitting at a desk working
- Walking a dog
- Driving (phone mounted, not handheld)
- Writing in a notebook/journal
- Picking up a bag or keys and heading out
- Cooking or prepping food
- Watering plants
- Folding laundry
- Standing at a window looking out
- Putting on shoes or a jacket

RULES:
- Every suggestion must be a GENERIC everyday action — not industry-specific or clever
- NO stylized, produced, or "cinematic" suggestions
- NO props they'd need to buy or set up
- NO specific facial expressions or acting
- NO brand-specific or offer-specific scenes
- The footage should work for ANY ad copy layered on top
- Think "stock footage you film yourself in 30 seconds"
- Keep directions to one simple sentence

Return ONLY valid JSON with this structure:
{
  "ideas": [
    {
      "emoji": "☕",
      "scene": "Pouring coffee",
      "direction": "Film yourself pouring coffee into a mug, natural light, phone propped on counter.",
      "mood": "Calm"
    }
  ]
}

Generate exactly 15 ideas. Mood must be one of: Calm, Productive, Relatable, Warm, Authentic, Energetic.`;

    const userPrompt = `Generate 15 simple, generic B-roll clip ideas for a business owner to film on their phone. These clips will have ad copy layered on top of them — so they just need to be warm, everyday, lofi background footage.

The person runs a ${industry || "business"} but the B-roll should NOT be industry-specific. It should be universal everyday life stuff: typing, walking, coffee, getting ready, working at a desk, etc.

Do NOT make suggestions that reference their specific product, audience, or offer. Keep it generic and easy to film in under 30 seconds.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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

    // Parse JSON from the response
    let ideas;
    try {
      // Extract JSON from response, handling markdown code fences
      let cleaned = rawContent.trim();
      // Remove ```json ... ``` wrapping
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
