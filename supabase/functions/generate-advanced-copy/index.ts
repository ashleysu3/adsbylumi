import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      brandName,
      brandVoice,
      offerName,
      offerDescription,
      offerUrl,
      offerPrice,
      productPsychology,
      audiencePsychology,
      assetFilename,
      assetType,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const isVideo = assetType?.startsWith("video/");
    const fileHint = assetFilename
      ? `The creative file is named "${assetFilename}" (${isVideo ? "video" : "image"}). Infer likely angles from the filename.`
      : "";

    const psychContext = productPsychology
      ? `Product Psychology: ${JSON.stringify(productPsychology).slice(0, 1500)}`
      : "";
    const audienceContext = audiencePsychology
      ? `Audience Psychology: ${JSON.stringify(audiencePsychology).slice(0, 1500)}`
      : "";

    const systemPrompt = `You are a world-class Meta Ads copywriter. You write psychology-driven, compliant ad copy that converts.
You NEVER use hype, guarantees, or personal attribute claims. You match the brand voice exactly.
Return exactly 5 variations. Each variation has: primary_text, headline (under 25 chars), description.
Use the tool provided to return structured output.`;

    const userPrompt = `Write 5 ad copy variations for this creative asset.

Brand: ${brandName || "Unknown"}
Brand Voice: ${brandVoice || "Professional, warm, strategic"}
Offer: ${offerName || "Unknown"}
Description: ${offerDescription || "N/A"}
URL: ${offerUrl || "N/A"}
Price: ${offerPrice || "N/A"}
${psychContext}
${audienceContext}
${fileHint}

Each variation should take a slightly different angle — e.g., problem-solution, social proof, curiosity, urgency, transformation.
Headlines must be under 25 characters. Primary text should be 1-3 sentences. Description is optional but helpful.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
                name: "return_copy_variations",
                description: "Return 5 ad copy variations",
                parameters: {
                  type: "object",
                  properties: {
                    variations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          primary_text: { type: "string" },
                          headline: { type: "string" },
                          description: { type: "string" },
                        },
                        required: ["primary_text", "headline", "description"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["variations"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "return_copy_variations" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    let variations = [];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      variations = parsed.variations || [];
    }

    return new Response(JSON.stringify({ variations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-advanced-copy error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
