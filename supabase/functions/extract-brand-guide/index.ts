import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuthedUser } from "../_shared/check-subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requireAuthedUser(req, corsHeaders);
    if (gate.blocked) return gate.blocked;

    const { fileDataUrl, fileName, mimeType, brandId } = await req.json();
    if (!fileDataUrl || !mimeType) {
      return new Response(JSON.stringify({ error: "Missing file" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const isImage = mimeType.startsWith("image/");
    const userContent: any[] = [
      {
        type: "text",
        text: `Extract brand guide info from this document. Return ONLY the fields you find. Leave anything you can't find as empty string / empty array. Hex colors must be like "#RRGGBB". Fonts must be common Google Font family names when possible.`,
      },
    ];
    if (isImage) {
      userContent.push({ type: "image_url", image_url: { url: fileDataUrl } });
    } else {
      userContent.push({
        type: "file",
        file: { filename: fileName || "brand-guide.pdf", file_data: fileDataUrl },
      });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You extract brand style guide info from documents. Be accurate. Return empty values for anything not clearly stated." },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_brand_guide",
            description: "Return extracted brand guide data",
            parameters: {
              type: "object",
              properties: {
                colors: {
                  type: "object",
                  properties: {
                    bg: { type: "string", description: "Background/base color hex" },
                    ink: { type: "string", description: "Primary text/ink color hex" },
                    accent: { type: "string", description: "Accent color hex" },
                    pop: { type: "string", description: "Pop/CTA color hex" },
                    highlight: { type: "string", description: "Highlight color hex" },
                    cream: { type: "string", description: "Cream/neutral color hex" },
                  },
                },
                fonts: {
                  type: "object",
                  properties: {
                    displayFamily: { type: "string" },
                    bodyFamily: { type: "string" },
                  },
                },
                brand_voice: { type: "string", description: "Voice / tone summary in 1-3 sentences" },
                value_proposition: { type: "string" },
                target_audience: { type: "string" },
                taglines: { type: "array", items: { type: "string" } },
                keywords: { type: "array", items: { type: "string" } },
              },
              required: ["colors", "fonts", "brand_voice", "value_proposition", "target_audience"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_brand_guide" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits depleted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error ${aiRes.status}`);
    }

    const data = await aiRes.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No extraction returned");
    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ extracted, brandId: brandId || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("extract-brand-guide error", e);
    return new Response(JSON.stringify({ error: e?.message || "Failed to extract brand guide" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
