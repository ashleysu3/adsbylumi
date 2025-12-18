import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cell, angle, brandName, strategyData, audiencePsychology, offerData } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const rowLabels: Record<string, string> = {
      attention: "Get Attention (scroll-stopping hook)",
      trust: "Build Trust (credibility/social proof)",
      action: "Drive Action (clear CTA)"
    };

    const formatLabels: Record<string, string> = {
      talking_head: "Talking Head Video",
      broll: "B-Roll / Lo-Fi Video",
      graphic: "Static Graphic / Image"
    };

    const systemPrompt = `You are an expert Meta Ads creative strategist specializing in psychology-driven marketing.
Your task is to generate a FRESH creative idea for a specific slot in a creative grid.

Rules:
- Create a NEW hook and guidance that's different from the original
- Keep the same format (${formatLabels[cell.format]}) and row type (${rowLabels[cell.row]})
- The hook should be punchy, attention-grabbing, and specific to the audience
- Guidance should be practical production notes
- Use psychology-driven messaging that connects emotionally
- Avoid generic or templated language

Output ONLY valid JSON with this exact structure:
{
  "hook": "The new creative hook text",
  "guidance": "Production guidance and notes"
}`;

    const userPrompt = `Generate a fresh creative idea for this slot:

Angle: ${angle.name} - ${angle.description}
Format: ${formatLabels[cell.format]}
Row Purpose: ${rowLabels[cell.row]}

Original idea to replace:
- Hook: "${cell.hook}"
- Guidance: "${cell.guidance}"

Context:
- Brand: ${brandName}
- Offer: ${offerData?.name || 'N/A'} - ${offerData?.description || 'N/A'}
- Price: ${offerData?.price || 'N/A'}
- Audience Psychology: ${JSON.stringify(audiencePsychology || {})}
- Strategy: ${JSON.stringify(strategyData?.messaging_levers || strategyData?.objectives || {})}

Create something COMPLETELY DIFFERENT from the original. Be creative and bold!`;

    console.log("Regenerating cell:", cell.id, "for angle:", angle.name);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted. Please add credits in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    const regeneratedCell = {
      ...cell,
      hook: parsed.hook,
      guidance: parsed.guidance,
    };

    console.log("Successfully regenerated cell:", regeneratedCell.id);

    return new Response(JSON.stringify({ cell: regeneratedCell }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error regenerating cell:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to regenerate creative";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
