import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      cell, 
      angle, 
      brandName, 
      strategyData, 
      audiencePsychology, 
      offerData,
      brandVoice,
      messagingGuidelines,
      productPsychology
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch knowledge base for context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: kbDocs } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("active", true)
      .in("category", ["hooks", "visual_hooks", "psychology", "buyer_psychology", "copy_frameworks"]);

    const kbContext = kbDocs?.map(doc => `## ${doc.title}\n${doc.content}`).join("\n\n") || "";

    // Extract specific pain points and desires
    const painPoints = audiencePsychology?.painPoints || audiencePsychology?.pain_points || [];
    const desires = audiencePsychology?.desires || [];
    const objections = audiencePsychology?.objections || [];
    const buyingTriggers = productPsychology?.buying_triggers || productPsychology?.buyingTriggers || [];

    const rowLabels: Record<string, string> = {
      attention: "Get Attention - stops the scroll with pattern interruption",
      trust: "Build Trust - creates relatability and proof",
      action: "Drive Action - creates urgency or clarity"
    };

    const formatLabels: Record<string, string> = {
      talking_head: "Talking Head Video (vulnerable, real, unpolished)",
      broll: "B-Roll / Lo-Fi Video (cinematic micro-moments)",
      graphic: "Static Graphic / Image (bold, unexpected, thumb-stopping)"
    };

    const systemPrompt = `You are an elite Meta Ads creative strategist who creates scroll-stopping, psychology-driven ad concepts.

KNOWLEDGE BASE:
${kbContext}

Your task is to generate a FRESH, SPECIFIC creative idea for a specific slot in a creative grid. The new idea must be COMPLETELY DIFFERENT from the original while being even MORE compelling.

=== CRITICAL RULES ===

❌ BANNED PHRASES (NEVER USE):
- "Take your X to the next level"
- "Ready to transform your Y?"
- "Struggling with X?"
- "Want to achieve X?"
- "Tired of X?"
- "What if you could X?"
- "The secret to X"
- Any hook that could apply to ANY business

✅ WHAT MAKES A HOOK SCROLL-STOPPING:
- Names a SPECIFIC moment the audience has experienced
- Uses unexpected specificity (numbers, details, micro-moments)
- Creates pattern interruption
- Feels like reading their diary or text messages
- Is emotionally charged without being salesy

=== EXAMPLE OUTPUT COMPARISON ===

**GENERIC (DO NOT DO):**
Hook: "Want more clients? Here's how."
Guidance: "Show testimonials and results."

**EXCELLENT (DO THIS):**
Hook: "My 3rd discovery call this week. Same objection. 'I need to think about it.' Again."
Guidance: "POV shot of you hanging up phone, slump in chair. B-roll of empty calendar. Text overlay: 'Sound familiar?' at 2 seconds."

=== PSYCHOLOGY TO USE ===
${painPoints.length > 0 ? `Pain Points: ${painPoints.slice(0, 3).map((p: string) => `"${p}"`).join(', ')}` : ''}
${desires.length > 0 ? `Desires: ${desires.slice(0, 3).map((d: string) => `"${d}"`).join(', ')}` : ''}
${objections.length > 0 ? `Objections to address: ${objections.slice(0, 2).map((o: string) => `"${o}"`).join(', ')}` : ''}
${buyingTriggers.length > 0 ? `Triggers: ${buyingTriggers.slice(0, 2).map((t: string) => `"${t}"`).join(', ')}` : ''}

Output ONLY valid JSON with this exact structure:
{
  "hook": "The new creative hook text - MUST be specific, not generic",
  "guidance": "Detailed production guidance with camera angles, timing, overlays",
  "psychology_trigger": "The psychological lever being pulled",
  "pain_point_addressed": "Which specific pain point this targets",
  "why_this_works": "One sentence explanation for user education"
}`;

    const userPrompt = `Generate a FRESH, COMPLETELY DIFFERENT creative idea for this slot:

Angle: ${angle.name} - ${angle.description}
Format: ${formatLabels[cell.format]}
Row Purpose: ${rowLabels[cell.row]}

Original idea to REPLACE (create something totally different):
- Hook: "${cell.hook}"
- Guidance: "${cell.guidance}"

Context:
- Brand: ${brandName}
${brandVoice ? `- Brand Voice: ${brandVoice}` : ''}
- Offer: ${offerData?.name || 'N/A'} - ${offerData?.description || 'N/A'}
- Price: ${offerData?.price || 'N/A'}

${messagingGuidelines ? `Messaging Guidelines: ${JSON.stringify(messagingGuidelines)}` : ''}
${productPsychology ? `Product Psychology: ${JSON.stringify(productPsychology)}` : ''}

Full Audience Psychology: ${JSON.stringify(audiencePsychology || {})}
Strategy: ${JSON.stringify(strategyData?.messaging_levers || strategyData?.objectives || {})}

REQUIREMENTS:
1. Create something COMPLETELY DIFFERENT from the original
2. The hook must name a SPECIFIC micro-moment or scenario
3. Use the pain points and desires listed above
4. Include detailed production notes in guidance
5. Make it feel like you've read their journal - specific, not generic`;

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
      psychology_trigger: parsed.psychology_trigger || "curiosity",
      pain_point_addressed: parsed.pain_point_addressed || "general",
      why_this_works: parsed.why_this_works || "",
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
