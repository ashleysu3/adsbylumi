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

    const systemPrompt = `You are a creative director helping small business owners film simple, authentic B-roll for their Meta ads. Your job is to suggest everyday scenes they can film on their phone — no crew, no staging, no production budget needed.

PHILOSOPHY:
- These are NOT cinematic shots. They are slices of real life.
- Every idea should be something the person could film TODAY with their phone.
- The goal is to "romanticize" their everyday life — make the ordinary feel warm, intentional, and human.
- Think: morning coffee, walking the dog, sitting at a desk, journaling, chatting with a friend. Not: dramatic drone shots, elaborate lighting setups, or anything requiring a crew.
- The best B-roll for coaches and service providers looks like it was filmed casually. That authenticity IS the appeal.

RULES:
- All suggestions must be achievable with a phone camera in natural light
- No suggestions that require equipment, crew, or elaborate staging
- Suggestions should feel personal and lifestyle-driven — not corporate or stock-photo generic
- Every suggestion should connect to their brand world or daily life as a business owner
- Include a mix of business-adjacent scenes (desk, laptop, working) and life scenes (coffee, walking, home)

Return ONLY valid JSON with this structure:
{
  "ideas": [
    {
      "emoji": "☕",
      "scene": "Morning coffee pour",
      "direction": "Close up on the liquid pouring into your mug. Natural window light. No need to clean up the counter.",
      "mood": "Calm"
    }
  ]
}

Generate exactly 15 ideas. Mood must be one of: Calm, Productive, Relatable, Warm, Authentic, Energetic.`;

    const userPrompt = `Generate 15 B-roll ideas for this business owner:

Brand: ${brandName || "Unknown"}
Industry: ${industry || "Not specified"}
Who they serve: ${targetAudience || "Not specified"}
What they do: ${valueProposition || "Not specified"}

Make the ideas feel personal to their world as a ${industry || "business"} owner. Include a mix of work scenes, lifestyle scenes, and everyday moments that would resonate with their specific audience.`;

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
