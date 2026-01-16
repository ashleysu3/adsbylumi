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
    const { 
      angles, 
      brandName, 
      strategyData, 
      audiencePsychology, 
      offerData,
      brandVoice,
      messagingGuidelines,
      productPsychology,
      nicheContext
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch ALL relevant knowledge base categories
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: kbDocs } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("active", true)
      .in("category", [
        "creative_angles", 
        "hooks", 
        "visual_hooks", 
        "copy_frameworks", 
        "scripts",
        "psychology",
        "buyer_psychology",
        "niche",
        "niche_knowledge",
        "meta_best_practices",
        "creative_department",
        "ad_planner",
        "customer_journey",
        "offer_mapping"
      ]);

    const kbContext = kbDocs?.map(doc => `## ${doc.title}\n${doc.content}`).join("\n\n") || "";

    // Extract specific pain points and desires for targeted prompting
    // Ensure all are arrays - data might be stored in various formats
    const ensureArray = (val: unknown): string[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') return [val];
      if (val && typeof val === 'object') return Object.values(val).filter(v => typeof v === 'string') as string[];
      return [];
    };
    
    const painPoints = ensureArray(audiencePsychology?.painPoints || audiencePsychology?.pain_points);
    const desires = ensureArray(audiencePsychology?.desires);
    const objections = ensureArray(audiencePsychology?.objections);
    const buyingTriggers = ensureArray(productPsychology?.buying_triggers || productPsychology?.buyingTriggers);

    const systemPrompt = `You are an elite Meta Ads creative strategist who creates scroll-stopping, psychology-driven ad concepts. Your creative MUST be specific, emotionally resonant, and impossible to ignore.

KNOWLEDGE BASE:
${kbContext}

=== CRITICAL RULES: SPECIFICITY IS EVERYTHING ===

❌ BANNED PHRASES (NEVER USE):
- "Take your X to the next level"
- "Ready to transform your Y?"
- "Struggling with X?"
- "Want to achieve X?"
- "Tired of X?"
- "What if you could X?"
- "Imagine if X"
- "The secret to X"
- "Finally, a solution for X"
- "Stop doing X the hard way"
- "Unlock your potential"
- Any hook that could apply to ANY business

✅ WHAT MAKES A HOOK SCROLL-STOPPING:
- Names a SPECIFIC moment the audience has experienced
- Uses unexpected specificity (numbers, details, micro-moments)
- Creates pattern interruption
- Feels like reading their diary or text messages
- Is emotionally charged without being salesy

=== EXAMPLE OUTPUT COMPARISON ===

**GENERIC (DO NOT DO THIS):**
Hook: "Struggling with your business? Watch this."
Guidance: "Speak confidently to camera about the problem."

**EXCELLENT (DO THIS):**
Hook: "I used to rehearse my pitch 47 times before a webinar... then bomb anyway."
Guidance: "Film on phone, looking slightly tired. Quick cuts between 3 frustrated moments. Text overlay: 'You too?' at 2-second mark."

**GENERIC (DO NOT DO THIS):**
Hook: "Want more clients? Here's how."
Guidance: "Show testimonials and results."

**EXCELLENT (DO THIS):**
Hook: "My 3rd discovery call this week. Same objection. 'I need to think about it.' Again."
Guidance: "POV shot of you hanging up phone, slump in chair. B-roll of empty calendar. Text: 'Sound familiar?'"

**GENERIC (DO NOT DO THIS):**
Hook: "The key to success is consistency."
Guidance: "Create motivational graphic."

**EXCELLENT (DO THIS):**  
Hook: "Day 47. Still 0 sales. Everyone's asking when I'm going back to my 9-5."
Guidance: "Handwritten note aesthetic, slightly crumpled paper texture. Raw vulnerability. Text appears like it's being typed."

=== GRID STRUCTURE ===
For each angle, create 9 creative cells organized as:

ROWS (Audience Moment):
- Row 1: "attention" - Gets attention, stops the scroll with pattern interruption
- Row 2: "trust" - Builds trust through relatability and proof
- Row 3: "action" - Drives toward action with urgency or clarity

COLUMNS (Format Diversity):
- Column 1: "talking_head" - Person speaking to camera (vulnerable, real, unpolished)
- Column 2: "broll" - B-roll footage or lofi video (cinematic micro-moments)
- Column 3: "graphic" - Static image or graphic (bold, unexpected, thumb-stopping)

=== PSYCHOLOGY INTEGRATION REQUIREMENTS ===
${painPoints.length > 0 ? `
AUDIENCE PAIN POINTS TO REFERENCE (use these SPECIFIC phrases):
${painPoints.map((p: string, i: number) => `${i + 1}. "${p}"`).join('\n')}
` : ''}

${desires.length > 0 ? `
AUDIENCE DESIRES TO PROMISE (these are what they WANT):
${desires.map((d: string, i: number) => `${i + 1}. "${d}"`).join('\n')}
` : ''}

${objections.length > 0 ? `
OBJECTIONS TO PREEMPTIVELY ADDRESS:
${objections.map((o: string, i: number) => `${i + 1}. "${o}"`).join('\n')}
` : ''}

${buyingTriggers.length > 0 ? `
BUYING TRIGGERS TO ACTIVATE:
${buyingTriggers.map((t: string, i: number) => `${i + 1}. "${t}"`).join('\n')}
` : ''}

=== OUTPUT REQUIREMENTS ===
Each cell MUST include:
- id: unique string (e.g., "angle_attention_talking_head")
- angleId: the angle's id this belongs to
- row: "attention" | "trust" | "action"
- format: "talking_head" | "broll" | "graphic"
- hook: One compelling, SPECIFIC sentence that names a micro-moment or specific scenario
- guidance: Detailed production notes (camera angles, text overlays, timing, mood)
- psychology_trigger: Which psychological lever this pulls (curiosity, fear, desire, social proof, etc.)
- pain_point_addressed: Which specific pain point from the list above this targets (or "general" if broad)
- why_this_works: One sentence explaining the psychology (for the user's education)

Return a JSON object with a "grid" array containing all cells.`;

    const anglesDescription = angles.map((a: any) => `- ID: "${a.id}" | Name: ${a.name}: ${a.description}`).join("\n");

    const userPrompt = `Generate a 3×3 creative grid for each of these angles:

${anglesDescription}

IMPORTANT: Use the exact angle ID (not the name) for the angleId field.

=== BRAND CONTEXT ===
Brand: ${brandName}
${brandVoice ? `Brand Voice: ${brandVoice}` : ''}
${nicheContext ? `Industry/Niche: ${nicheContext}` : ''}

=== OFFER CONTEXT ===
Offer: ${offerData?.name || "Not specified"}
${offerData?.description ? `Description: ${offerData.description}` : ""}
${offerData?.price ? `Price: ${offerData.price}` : ""}
${offerData?.url ? `URL: ${offerData.url}` : ""}

${messagingGuidelines ? `=== MESSAGING GUIDELINES ===
${JSON.stringify(messagingGuidelines, null, 2)}` : ''}

${productPsychology ? `=== PRODUCT PSYCHOLOGY ===
${JSON.stringify(productPsychology, null, 2)}` : ''}

=== STRATEGY CONTEXT ===
${JSON.stringify(strategyData, null, 2)}

${audiencePsychology ? `=== FULL AUDIENCE PSYCHOLOGY ===
${JSON.stringify(audiencePsychology, null, 2)}` : ""}

=== YOUR TASK ===
Generate 9 creative cells (3 rows × 3 formats) for EACH angle (${angles.length} angles = ${angles.length * 9} total cells).

Remember:
1. Each hook must be SPECIFIC - name a micro-moment, use numbers, reference real scenarios
2. Each guidance must include production details (camera, timing, overlays)
3. Draw directly from the pain points and desires listed above
4. NO GENERIC HOOKS - if it could apply to any business, rewrite it
5. Make it feel like you've read their journal`;

    console.log("Generating creative grid with enriched context for", angles.length, "angles");

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
        // Ensure new fields have defaults if AI didn't include them
        cell.psychology_trigger = cell.psychology_trigger || "curiosity";
        cell.pain_point_addressed = cell.pain_point_addressed || "general";
        cell.why_this_works = cell.why_this_works || "";
        return cell;
      });
    }

    console.log("Successfully generated", parsed.grid?.length || 0, "creative cells");

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
