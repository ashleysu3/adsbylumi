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
    const { brandName, strategyData, audiencePsychology, offerData, conversationInsights } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch knowledge base for creative angles
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: kbDocs } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("active", true)
      .in("category", ["creative_angles", "hooks", "visual_hooks", "copy_frameworks"]);

    const kbContext = kbDocs?.map(doc => `## ${doc.title}\n${doc.content}`).join("\n\n") || "";

    // Build conversation insights context if available
    let insightsContext = "";
    if (conversationInsights && conversationInsights.length > 0) {
      insightsContext = "\n\nPREVIOUS CONVERSATION INSIGHTS FROM USER:\n";
      insightsContext += "The user has shared the following information about their offer and audience in previous conversations. Use these insights to create more targeted and powerful angles:\n\n";
      
      conversationInsights.forEach((insight: any, idx: number) => {
        insightsContext += `--- Conversation ${idx + 1} ---\n`;
        insight.messages.forEach((msg: any) => {
          if (msg.role === 'user') {
            insightsContext += `User said: ${msg.content}\n`;
          } else if (msg.role === 'assistant') {
            insightsContext += `Lumi noted: ${msg.content}\n`;
          }
        });
        insightsContext += "\n";
      });
      
      insightsContext += "\nIMPORTANT: Incorporate these user insights to create angles that directly address their specific pain points, desires, objections, and unique value propositions mentioned in the conversations above.\n";
    }

    const systemPrompt = `You are Lumi's Creative Engine. Your job is to generate creative angle recommendations for Meta ads campaigns.

KNOWLEDGE BASE:
${kbContext}
${insightsContext}

RULES:
- Generate exactly 10-12 creative angles
- Each angle must have a short, plain-language name (2-4 words)
- Each angle must have a one-sentence description written for non-marketers
- Do NOT use marketing jargon, funnel language, or technical terms
- Write as if explaining to a friend who has never run ads
- Focus on what resonates emotionally, not why it works strategically
${conversationInsights?.length > 0 ? "- PRIORITIZE angles that address the specific insights shared by the user in previous conversations" : ""}

ANGLE TYPES TO CONSIDER (but don't expose these labels):
- Relatable Struggle (showing the problem they face)
- Fast Win (quick result they can achieve)
- Authority Proof (demonstrating expertise)
- Before / After (transformation stories)
- Myth Bust (correcting misconceptions)
- Simple System (easy process to follow)
- Social Proof (others' success)
- "If This Is You" Callout (direct identification)
- Behind the Scenes (authenticity)
- Urgency/Scarcity (limited opportunity)

OUTPUT FORMAT:
Return a JSON object with an "angles" array. Each angle object must have:
- id: unique string (lowercase, underscore-separated)
- name: short display name (2-4 words)
- description: one sentence for non-marketers
- psychologyTrigger: (optional) if based on user insights, briefly note what insight it addresses`;

    const userPrompt = `Generate creative angles for this campaign:

BRAND: ${brandName}

OFFER: ${offerData?.name || "Not specified"}
${offerData?.description ? `Description: ${offerData.description}` : ""}
${offerData?.price ? `Price: ${offerData.price}` : ""}

STRATEGY CONTEXT:
${JSON.stringify(strategyData, null, 2)}

${audiencePsychology ? `AUDIENCE INSIGHTS:\n${JSON.stringify(audiencePsychology, null, 2)}` : ""}

Generate 10-12 creative angles that would resonate with this audience and offer.${conversationInsights?.length > 0 ? " Make sure to incorporate the user's specific insights from their previous conversations." : ""}`;

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
        response_format: { type: "json_object" },
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
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in generate-creative-angles:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate angles";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: errorMessage.includes("429") ? 429 : errorMessage.includes("402") ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
