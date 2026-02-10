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
    const { brand, offer, ideaType, existingIdeas, count = 5 } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a creative strategist for meta ads. Generate unique, psychology-driven content ideas for ads.

Your suggestions should be:
- Based on proven psychological triggers (social proof, urgency, transformation, pain/pleasure, curiosity)
- Specific and actionable (not generic)
- Tailored to the brand voice and target audience
- Fresh and not repetitive of existing ideas

For hooks: Create attention-grabbing opening lines (first 3 seconds)
For scripts: Outline a 30-60 second talking head script structure
For visuals: Describe compelling visual concepts or b-roll ideas
For general ideas: Provide creative angles or campaign concepts

Always explain the psychology behind each idea briefly.`;

    const existingContext = existingIdeas?.length > 0 
      ? `\n\nExisting ideas to avoid duplicating:\n${existingIdeas.map((i: any) => `- ${i.title}`).join('\n')}`
      : '';

    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const userPrompt = `Today's date is ${currentDate}. Ensure all content is seasonally appropriate and relevant to this time period. Do NOT reference holidays, seasons, or events that are not upcoming or current.

Generate ${count} ${ideaType || 'creative'} content idea${count > 1 ? 's' : ''} for this brand and offer:

BRAND:
- Name: ${brand?.name || 'Unknown'}
- Industry: ${brand?.industry || 'Not specified'}
- Brand Voice: ${brand?.brand_voice || 'Professional and friendly'}
- Target Audience: ${brand?.target_audience || 'Not specified'}
- Value Proposition: ${brand?.value_proposition || 'Not specified'}

${brand?.audience_psychology ? `AUDIENCE PSYCHOLOGY:
${JSON.stringify(brand.audience_psychology, null, 2)}` : ''}

${offer ? `OFFER:
- Name: ${offer.name}
- Description: ${offer.description || 'Not provided'}
- Price: ${offer.price_point || 'Not specified'}
- Target Outcome: ${offer.target_outcome || 'Not specified'}
${offer.product_psychology ? `- Psychology: ${JSON.stringify(offer.product_psychology)}` : ''}` : 'No specific offer selected.'}
${existingContext}

Return a JSON array with exactly ${count} idea${count > 1 ? 's' : ''}, each with:
- title: A catchy, descriptive title (max 60 chars)
- content: The full idea/script/concept (detailed but concise)
- type: One of "hook", "script", "visual", "video", or "idea"
- psychology: Brief explanation of why this works psychologically (1-2 sentences)
- tags: Array of 2-3 relevant tags`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_content_ideas",
              description: "Return the generated content ideas",
              parameters: {
                type: "object",
                properties: {
                  ideas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        content: { type: "string" },
                        type: { type: "string", enum: ["hook", "script", "visual", "video", "idea"] },
                        psychology: { type: "string" },
                        tags: { type: "array", items: { type: "string" } },
                      },
                      required: ["title", "content", "type", "psychology", "tags"],
                    },
                  },
                },
                required: ["ideas"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_content_ideas" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
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

    const data = await response.json();
    
    // Extract ideas from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const ideas = JSON.parse(toolCall.function.arguments).ideas;

    return new Response(JSON.stringify({ ideas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-content-ideas error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate ideas" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
