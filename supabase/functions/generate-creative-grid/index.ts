import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { angles, brandName, strategyData, audiencePsychology, offerData } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch knowledge base
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: kbDocs } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("active", true)
      .in("category", ["creative_angles", "hooks", "visual_hooks", "copy_frameworks", "scripts"]);

    const kbContext = kbDocs?.map(doc => `## ${doc.title}\n${doc.content}`).join("\n\n") || "";

    const systemPrompt = `You are Lumi's Creative Engine. Generate a 3×3 creative grid for each selected angle.

KNOWLEDGE BASE:
${kbContext}

GRID STRUCTURE:
For each angle, create 9 creative cells organized as:

ROWS (Audience Moment - DO NOT label these in output):
- Row 1: "attention" - Gets attention, stops the scroll
- Row 2: "trust" - Builds trust and credibility  
- Row 3: "action" - Drives toward action

COLUMNS (Format Diversity):
- Column 1: "talking_head" - Person speaking to camera
- Column 2: "broll" - B-roll footage or lofi video
- Column 3: "graphic" - Static image or graphic

RULES:
- Each cell must have a unique hook and guidance
- Do NOT reuse the same format twice within a row
- Write hooks as 1 short, compelling sentence
- Write guidance as 1 brief execution tip
- NO marketing jargon, funnel language, or technical terms
- NO explanations of why something works
- Write as if telling someone what to film or design next

OUTPUT FORMAT:
Return a JSON object with a "grid" array. Each cell object must have:
- id: unique string (e.g., "angle_attention_talking_head")
- angleId: the angle's id this belongs to
- row: "attention" | "trust" | "action"
- format: "talking_head" | "broll" | "graphic"
- hook: one compelling sentence (the opening idea)
- guidance: one sentence of execution direction`;

    const anglesDescription = angles.map((a: any) => `- ID: "${a.id}" | Name: ${a.name}: ${a.description}`).join("\n");

    const userPrompt = `Generate a 3×3 creative grid for each of these angles:

${anglesDescription}

IMPORTANT: Use the exact angle ID (not the name) for the angleId field. For example, if the angle ID is "quick_win_ads", set angleId to "quick_win_ads".

BRAND: ${brandName}

OFFER: ${offerData?.name || "Not specified"}
${offerData?.description ? `Description: ${offerData.description}` : ""}
${offerData?.price ? `Price: ${offerData.price}` : ""}

STRATEGY CONTEXT:
${JSON.stringify(strategyData, null, 2)}

${audiencePsychology ? `AUDIENCE INSIGHTS:\n${JSON.stringify(audiencePsychology, null, 2)}` : ""}

Generate 9 creative cells (3 rows × 3 formats) for EACH angle (${angles.length} angles = ${angles.length * 9} total cells).`;

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
      console.error("AI API error:", response.status, errorText);
      if (response.status === 429) {
        throw new Error("429: Rate limit exceeded");
      }
      if (response.status === 402) {
        throw new Error("402: AI credits depleted");
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const rawContent =
      aiResponse?.choices?.[0]?.message?.content ??
      aiResponse?.choices?.[0]?.text ??
      aiResponse?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ??
      "";

    if (!rawContent) {
      console.error("Unexpected AI response shape:", aiResponse);
      throw new Error("AI response was empty");
    }

    // Robust JSON extraction
    const extractJson = (text: string) => {
      const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const raw = (codeBlock?.[1] ?? text).trim();
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      return JSON.parse(first !== -1 && last !== -1 ? raw.slice(first, last + 1) : raw);
    };

    const parsed = extractJson(rawContent);

    // Post-process to ensure angleId matches actual angle IDs
    // The AI sometimes uses angle names instead of IDs
    const angleIdMap = new Map<string, string>();
    for (const angle of angles) {
      angleIdMap.set(angle.name.toLowerCase(), angle.id);
      angleIdMap.set(angle.id.toLowerCase(), angle.id);
    }

    if (parsed.grid && Array.isArray(parsed.grid)) {
      parsed.grid = parsed.grid.map((cell: any) => {
        const lookupKey = (cell.angleId || "").toLowerCase();
        const correctedId = angleIdMap.get(lookupKey);
        if (correctedId) {
          cell.angleId = correctedId;
        }
        return cell;
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in generate-creative-grid:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate grid";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: errorMessage.includes("429") ? 429 : errorMessage.includes("402") ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
