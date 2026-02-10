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
       nicheContext,
       brandId,
       offerId,
       offerAudiencePsychology
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

     // Fetch content assets for this brand
     let contentAssetsContext = "";
     if (brandId) {
       const { data: contentAssets } = await supabase
         .from("brand_content_assets")
         .select("*")
         .eq("brand_id", brandId);
       
       if (contentAssets?.length) {
         contentAssetsContext = "\n\n=== USER-PROVIDED CONTENT ASSETS ===\n";
         contentAssetsContext += "REAL content from the user. Use these testimonials, scripts, and pain points to make hooks and scripts authentic:\n\n";
         
         contentAssets.forEach((asset: any) => {
           // Filter by offer if specified
           if (offerId && asset.offer_ids?.length > 0 && !asset.offer_ids.includes(offerId)) {
             return;
           }
           
           const typeLabels: Record<string, string> = {
             testimonials: 'CLIENT TESTIMONIALS (use these exact quotes/phrases)',
             webinar_scripts: 'WEBINAR/CHALLENGE SCRIPTS (borrow delivery style)',
             survey_answers: 'SURVEY RESPONSES (real pain points in client words)',
             client_objections: 'CLIENT OBJECTIONS (address these directly)',
             client_questions: 'CLIENT QUESTIONS (answer these in hooks)',
             other: 'OTHER CONTENT'
           };
           
           contentAssetsContext += `## ${typeLabels[asset.asset_type] || asset.asset_type.toUpperCase()}\n${asset.content}\n\n`;
         });
         
         contentAssetsContext += "CRITICAL: Pull specific phrases, numbers, and pain points from the above content. These are REAL words from REAL clients - use them to make hooks irresistible.\n";
       }
     }
 
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
    
    // Also extract offer-audience psychology insights
    const offerHesitations = ensureArray(offerAudiencePsychology?.specific_hesitations);

    const systemPrompt = `You are an elite Meta Ads creative strategist who creates scroll-stopping, psychology-driven ad concepts. Your creative MUST be specific, emotionally resonant, and impossible to ignore.

KNOWLEDGE BASE:
${kbContext}
 ${contentAssetsContext}

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

=== TALKING HEAD FORMAT - DESIGNED FOR NON-ACTORS ===
Your users are coaches, course creators, and service providers - NOT actors or professional content creators.
They want to record a simple video on their phone and get back to work. No elaborate productions.

SCRIPT PHILOSOPHY:
- Write like they're texting a friend, not performing on stage
- Each line = one breath, one thought (easy to read on teleprompter)
- Include natural speech patterns ("Look...", "Here's the thing...", "So...", "Honestly?")
- Suggest delivery cues sparingly: "(pause)" or "(lean in)" only when essential
- Structure: Hook → "Here's the thing" transition → Problem → Pivot → Soft CTA

LOW-PRODUCTION VISUAL HOOK OPTIONS (always provide 2-3 alternatives):
Based on the user's niche, suggest EVERYDAY activities they might actually do:
- Coaches/consultants: "at your desk", "walking to car", "morning coffee", "post-meeting in hallway"
- Health/fitness: "post-workout", "in kitchen", "getting ready", "at the gym"
- Creatives: "at workspace", "with your tools", "mid-project", "studio background"
- Service providers: "between client calls", "checking emails", "end of day", "walking outside"
- General (always appropriate): "sitting in parked car", "petting your dog", "walking down stairs", "making coffee"

MID-SENTENCE START TECHNIQUE (use for at least 1 of 3 talking head cells per angle):
This is extremely effective because it creates instant curiosity - viewers feel like they walked into a private conversation.
Examples:
- "—anyway, that's when I knew I had to change something."
- "—and she looked at me like I was crazy, but..."
- "—so I tried it, and honestly? I didn't expect this."
- "—but here's what nobody tells you about that."
- "—and that's exactly why I stopped doing it."

HOOK TECHNIQUE TYPES (label each talking_head with one):
- "mid_sentence" - Starting mid-thought (most powerful, feels like eavesdropping)
- "confession" - Vulnerable admission ("I used to...", "I'll be honest...")
- "controversial" - Bold/contrarian take ("Funnels are dead.", "Don't hire a VA.")
- "specific_number" - Using exact numbers for credibility ("47 calls", "$12,000")
- "pattern_interrupt" - Unexpected statement that stops the scroll

For ALL talking_head format cells, include these REQUIRED fields:

1. **verbal_hook**: The opening spoken line (pattern interrupt, controversial take, or vulnerable confession)
2. **written_hook**: The text overlay that appears on screen at the start (complements but differs from verbal - creates curiosity gap)
3. **visual_hook**: What the viewer SEES in the first 1-3 seconds (setting, expression, action, prop, or unexpected visual) - make it EVERYDAY and SIMPLE
4. **visual_hook_options**: Array of 2-3 ALTERNATIVE simple visual hooks so user can pick what works for their space
5. **hook_technique**: One of "mid_sentence", "confession", "controversial", "specific_number", "pattern_interrupt"
6. **delivery_style**: Brief note on how to deliver ("conversational, like telling a friend" NOT "act excited")
7. **script_lines**: Array of 4-8 short spoken lines (3-5 seconds each). Structure: Hook → Problem → Agitation → Solution tease → CTA
8. **text_overlays**: Array of 3-5 text overlays with timing. Each should ADD context, not just repeat what's spoken.
9. **caption_reminder**: Always true (85% watch without sound)

=== HOOK TYPES THAT WORK ===
VERBAL HOOKS (what they say):
- Confession: "I lost $12,000 on my first launch..."
- Controversial: "Funnels are dead. Here's what's replacing them."
- Pattern interrupt: "Don't hire a VA. Seriously."
- Specific number: "I made 47 cold calls. 3 answered. 1 changed everything."
- Mid-sentence: "—anyway, that's when I realized..."

WRITTEN HOOKS (text on screen):
- Curiosity gap: "What I wish I knew before..." 
- Bold claim: "This simple shift = 3x conversions"
- Social proof: "How I went from $0 → $50k/mo"
- Direct challenge: "Still doing THIS in 2024?"

VISUAL HOOKS (what they see) - KEEP THESE SIMPLE:
- Everyday moments: "sitting at desk with messy coffee cup", "in car after a meeting", "petting dog on couch"
- Subtle emotion: "slightly tired face", "knowing smile", "contemplative look"
- Low-effort actions: "walking while talking", "looking at phone then up", "closing laptop"
- NO elaborate staging: Don't suggest burning paper, empty wallets, or anything that requires props they don't have

Example talking_head output:
{
  "format": "talking_head",
  "hook": "—anyway, that's when I knew something had to change.",
  "verbal_hook": "—anyway, that's when I knew something had to change.",
  "written_hook": "The moment everything shifted",
  "visual_hook": "Sitting in car after a meeting, slightly tired expression",
  "visual_hook_options": [
    "Sitting in parked car, slightly tired expression",
    "Walking into your home office, coffee in hand",
    "At desk with natural lighting, end of day vibe"
  ],
  "hook_technique": "mid_sentence",
  "delivery_style": "Conversational, like debriefing with a friend after a long day. No acting required - just be real.",
  "script_lines": [
    "—anyway, that's when I knew something had to change.",
    "I'd been doing the same thing for months...",
    "Working harder, not smarter. Sound familiar?",
    "(pause) Here's what I realized...",
    "The problem wasn't my effort. It was my approach.",
    "Once I switched to [method], everything clicked."
  ],
  "text_overlays": [
    { "text": "The moment everything shifted", "timing": "0-3s", "type": "hook" },
    { "text": "Sound familiar? 👀", "timing": "6-9s", "type": "transition" },
    { "text": "The ONE thing I changed →", "timing": "15-18s", "type": "cta" }
  ],
  "caption_reminder": true,
  "guidance": "Record in your car or at your desk. Natural lighting. You're just telling a friend about a realization you had. No performance needed."
}

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

${offerAudiencePsychology ? `
=== OFFER-SPECIFIC AUDIENCE INSIGHTS ===
Use these to make creative hyper-targeted to THIS specific offer:

${offerAudiencePsychology.why_they_need_this ? `Why They Need THIS Offer: "${offerAudiencePsychology.why_they_need_this}"` : ''}
${offerAudiencePsychology.moment_they_realize ? `The Moment They Realize: "${offerAudiencePsychology.moment_they_realize}"` : ''}
${offerHesitations.length > 0 ? `\nHesitations About THIS Offer:\n${offerHesitations.map((h: string, i: number) => `${i + 1}. "${h}"`).join('\n')}` : ''}
${offerAudiencePsychology.what_finally_convinces ? `\nWhat Convinces Them: "${offerAudiencePsychology.what_finally_convinces}"` : ''}
${offerAudiencePsychology.emotional_before_after ? `\nEmotional Journey:\n  BEFORE: "${offerAudiencePsychology.emotional_before_after.before}"\n  AFTER: "${offerAudiencePsychology.emotional_before_after.after}"` : ''}
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

ADDITIONAL FIELDS FOR talking_head FORMAT ONLY:
- verbal_hook: The opening spoken line (pattern interrupt, confession, or controversial take)
- written_hook: The text overlay that appears first (creates curiosity gap, differs from verbal)
- visual_hook: What viewers SEE in first 1-3 seconds - MUST be simple/everyday (no elaborate staging)
- visual_hook_options: Array of 2-3 alternative simple visual hook ideas
- hook_technique: One of "mid_sentence", "confession", "controversial", "specific_number", "pattern_interrupt"
- delivery_style: Brief note on how to deliver (emphasize authenticity, not acting)
- script_lines: Array of 4-8 short script lines (one sentence/phrase each, 3-5 seconds to speak)
- text_overlays: Array of objects with "text", "timing", and "type" (hook/transition/insight/cta) properties
- caption_reminder: boolean (always true for talking_head)

Return a JSON object with a "grid" array containing all cells.`;

    // Separate default angle from AI-generated angles
    const hasDirectAngle = angles.some((a: any) => a.id === "direct_from_page");
    const aiAngles = angles.filter((a: any) => a.id !== "direct_from_page");
    
    const anglesDescription = aiAngles.map((a: any) => `- ID: "${a.id}" | Name: ${a.name}: ${a.description}`).join("\n");

    // Build special instructions for the direct_from_page angle
    let directAngleInstructions = "";
    if (hasDirectAngle) {
      directAngleInstructions = `

=== SPECIAL ANGLE: "direct_from_page" (Straight from Your Page) ===
For the angle with ID "direct_from_page", generate 3-4 simple, DIRECT creative concepts that use the offer's actual content verbatim. This is NOT a psychology-driven angle — it's a straightforward representation of the offer.

Rules for this angle:
- Use the offer name as the headline VERBATIM (e.g., "Free Webinar: ${offerData?.name || '[Offer Name]'}")
- Use the offer description as primary copy — mirror the sales page language
- Generate simple CTAs: "Sign Up Now," "Download Free," "Register Today," "Learn More," "Enroll Now"
- Suggest basic visual concepts: offer name as text overlay, simple branded graphic, screenshot of the sales page
- NO psychology tricks, NO creative hooks — just clear, direct messaging
- For talking_head: script should be a simple, direct pitch of the offer as described on the page
- For broll: suggest showing the product/offer page/landing page
- For graphic: simple branded graphic with offer name, price (if applicable), and CTA

Example hooks for this angle:
- "${offerData?.name || 'Course Name'} — Enroll Now"
- "Free ${offerData?.name || 'Resource'}: Download Today"
- "${offerData?.name || 'Offer'} | ${offerData?.price || 'Limited Time'}"
`;
    }

    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const allAnglesDescription = angles.map((a: any) => `- ID: "${a.id}" | Name: ${a.name}: ${a.description}`).join("\n");

    const userPrompt = `Today's date is ${currentDate}. Ensure all content is seasonally appropriate and relevant to this time period. Do NOT reference holidays, seasons, or events that are not upcoming or current.

Generate a 3×3 creative grid for each of these angles:

${allAnglesDescription}
${directAngleInstructions}

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

${offerAudiencePsychology ? `=== OFFER-AUDIENCE PSYCHOLOGY ===
${JSON.stringify(offerAudiencePsychology, null, 2)}` : ""}

=== YOUR TASK ===
Generate 9 creative cells (3 rows × 3 formats) for EACH angle (${angles.length} angles = ${angles.length * 9} total cells).

Remember:
1. Each hook must be SPECIFIC - name a micro-moment, use numbers, reference real scenarios
2. Each guidance must include production details (camera, timing, overlays)
3. Draw directly from the pain points and desires listed above
4. NO GENERIC HOOKS - if it could apply to any business, rewrite it
5. Make it feel like you've read their journal
6. Use the offer-audience psychology to make creative that addresses THIS specific offer's hesitations and transformation
7. For the "direct_from_page" angle (if present), follow the SPECIAL ANGLE instructions above — keep it simple and direct`;

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

    // Robust JSON extraction with error recovery
    const extractJson = (text: string): unknown => {
      // Step 1: Remove markdown code blocks
      let cleaned = text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      // Step 2: Find JSON boundaries
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("No JSON object found in response");
      }

      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

      // Step 3: Attempt parse with error handling
      try {
        return JSON.parse(cleaned);
      } catch (e) {
        console.log("Initial JSON parse failed, attempting repair...");
        
        // Step 4: Try to fix common issues
        cleaned = cleaned
          .replace(/,\s*}/g, "}") // Remove trailing commas before }
          .replace(/,\s*]/g, "]") // Remove trailing commas before ]
          .replace(/[\x00-\x1F\x7F]/g, " ") // Remove control characters
          .replace(/\n\s*\n/g, "\n") // Remove double newlines
          .replace(/"\s*\n\s*"/g, '", "') // Fix broken string arrays
          .replace(/:\s*,/g, ': "",') // Fix empty values before comma
          .replace(/:\s*}/g, ': ""}'); // Fix empty values before }

        try {
          return JSON.parse(cleaned);
        } catch (e2) {
          console.log("Second parse attempt failed, trying brace balancing...");
          
          // Step 5: Balance unbalanced braces/brackets
          let braces = 0, brackets = 0;
          for (const char of cleaned) {
            if (char === '{') braces++;
            if (char === '}') braces--;
            if (char === '[') brackets++;
            if (char === ']') brackets--;
          }
          
          // Add missing closing brackets/braces
          while (brackets > 0) { cleaned += ']'; brackets--; }
          while (braces > 0) { cleaned += '}'; braces--; }
          
          try {
            return JSON.parse(cleaned);
          } catch (e3) {
            // Step 6: Check for truncation indicators
            if (cleaned.includes('...') || cleaned.includes('[truncated]') || cleaned.length > 25000) {
              console.error("Response appears to be truncated. Length:", cleaned.length);
              throw new Error("AI response was truncated. The creative grid is too large - try generating for fewer angles.");
            }
            
            // Log the problematic area for debugging
            const errorMatch = (e3 as Error).message.match(/position (\d+)/);
            if (errorMatch) {
              const pos = parseInt(errorMatch[1]);
              console.error("JSON error near:", cleaned.substring(Math.max(0, pos - 100), pos + 100));
            }
            
            throw new Error(`Failed to parse AI response: ${(e3 as Error).message}`);
          }
        }
      }
    };

    const parsed = extractJson(rawContent) as { grid?: unknown[] };

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
        
        // Ensure talking_head specific fields have defaults
        if (cell.format === "talking_head") {
          cell.verbal_hook = cell.verbal_hook || cell.hook || "";
          cell.written_hook = cell.written_hook || "";
          cell.visual_hook = cell.visual_hook || "";
          cell.visual_hook_options = cell.visual_hook_options || [];
          cell.hook_technique = cell.hook_technique || "pattern_interrupt";
          cell.delivery_style = cell.delivery_style || "Conversational and authentic - no acting required.";
          cell.script_lines = cell.script_lines || [];
          cell.text_overlays = cell.text_overlays || [];
          cell.caption_reminder = true; // Always true for talking head
        }
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
