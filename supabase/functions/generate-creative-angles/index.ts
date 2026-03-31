import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandName, strategyData, audiencePsychology, offerData, conversationInsights, brandId, offerId, offerAudiencePsychology, productPsychology, preGenerationContext, creativeIntelligence, previouslyUsedAngles, neverUseWords, singleAngleReplacement, maxAngles } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch knowledge base for creative angles
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[generate-creative-angles] Fetching knowledge base...");

    const { data: kbDocs } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("active", true)
      .in("category", ["creative_angles", "hooks", "visual_hooks", "copy_frameworks"]);

    const kbContext = kbDocs?.map(doc => `## ${doc.title}\n${doc.content}`).join("\n\n") || "";

    // Fetch content assets for this brand
    let contentAssetsContext = "";
    if (brandId) {
      const { data: contentAssets } = await supabase
        .from("brand_content_assets")
        .select("*")
        .eq("brand_id", brandId);
      
      const hasTestimonials = contentAssets?.some(
        (a: any) => a.asset_type === 'testimonials' && a.content?.trim()
      );

      if (contentAssets?.length) {
        contentAssetsContext = "\n\nUSER-PROVIDED CONTENT ASSETS:\n";
        contentAssetsContext += "The user has provided the following real content. Use this authentic language, testimonials, and insights to create more specific and genuine angles:\n\n";
        
        contentAssets.forEach((asset: any) => {
          if (offerId && asset.offer_ids?.length > 0 && !asset.offer_ids.includes(offerId)) {
            return;
          }
          
          const typeLabels: Record<string, string> = {
            testimonials: 'CLIENT TESTIMONIALS',
            webinar_scripts: 'WEBINAR/CHALLENGE SCRIPTS',
            survey_answers: 'SURVEY RESPONSES',
            client_objections: 'CLIENT OBJECTIONS & QUESTIONS',
            client_questions: 'CLIENT QUESTIONS',
            other: 'OTHER CONTENT'
          };
          
          contentAssetsContext += `## ${typeLabels[asset.asset_type] || asset.asset_type.toUpperCase()}:\n${asset.content}\n\n`;
        });
        
        contentAssetsContext += "IMPORTANT: Incorporate specific phrases, pain points, and language from the above content to create authentic, resonant angles that sound like the user's actual clients.\n";
        
        if (hasTestimonials) {
          contentAssetsContext += "\nTESTIMONIAL DIRECTIVE: You MUST include at least 1 angle focused on Testimonial Proof — using real client words and screenshot-style social proof. Pull the strongest quotes from the testimonials provided. This angle should leverage the client's EXACT words as the foundation.\n";
        }
      }
    }

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

    // Build pre-generation context from user direction
    let preGenContext = "";
    if (preGenerationContext) {
      preGenContext = "\n\n=== USER DIRECTION FOR THIS CREATIVE ROUND ===\n";
      
      if (preGenerationContext.quickSelections?.length > 0) {
        preGenContext += "The user indicated the following about their audience/needs:\n";
        
        const selectionMappings: Record<string, string> = {
          "audience_early_journey": "- Audience is early in their awareness journey and needs more education before they'll buy",
          "audience_skeptical": "- Audience is skeptical and has objections that need to be addressed (trust is key)",
          "previous_generic": "- Previous creative felt too generic - need more specific, authentic angles",
          "need_urgency": "- Need more urgency and scarcity messaging to drive action",
          "highlight_transformation": "- Want to emphasize the transformation and end results",
          "focus_pain_point": "- Focus deeply on the core pain point"
        };
        
        preGenerationContext.quickSelections.forEach((sel: string) => {
          if (selectionMappings[sel]) {
            preGenContext += selectionMappings[sel] + "\n";
          }
        });
      }
      
      if (preGenerationContext.additionalNotes?.trim()) {
        preGenContext += `\nAdditional direction from user: "${preGenerationContext.additionalNotes}"\n`;
      }
      
      preGenContext += "\nIMPORTANT: Prioritize angles that address the user's specific direction above. This is fresh input for THIS creative round.\n";
    }

    // Build offer-audience psychology context
    let offerAudienceContext = "";
    if (offerAudiencePsychology) {
      offerAudienceContext = "\n\n=== OFFER-SPECIFIC AUDIENCE PSYCHOLOGY ===\n";
      offerAudienceContext += "How your ideal client relates to THIS specific offer:\n\n";
      
      if (offerAudiencePsychology.why_they_need_this) {
        offerAudienceContext += `Why They Need This: ${offerAudiencePsychology.why_they_need_this}\n\n`;
      }
      if (offerAudiencePsychology.moment_they_realize) {
        offerAudienceContext += `The Moment They Realize: ${offerAudiencePsychology.moment_they_realize}\n\n`;
      }
      if (offerAudiencePsychology.specific_hesitations?.length) {
        offerAudienceContext += `Specific Hesitations:\n${offerAudiencePsychology.specific_hesitations.map((h: string) => `- ${h}`).join('\n')}\n\n`;
      }
      if (offerAudiencePsychology.what_finally_convinces) {
        offerAudienceContext += `What Convinces Them: ${offerAudiencePsychology.what_finally_convinces}\n\n`;
      }
      if (offerAudiencePsychology.emotional_before_after) {
        offerAudienceContext += `Emotional Journey:\n  Before: ${offerAudiencePsychology.emotional_before_after.before}\n  After: ${offerAudiencePsychology.emotional_before_after.after}\n\n`;
      }
      
      offerAudienceContext += "IMPORTANT: Create angles that address the specific hesitations and highlight the transformation described above.\n";
    }

    // Build creative intelligence context if available
    let intelligenceContext = "";
    if (creativeIntelligence?.hasData) {
      intelligenceContext = "\n\n=== DATA-INFORMED CREATIVE INTELLIGENCE ===\n";
      intelligenceContext += `The user's top-performing ads in the last 90 days show these patterns:\n`;
      intelligenceContext += `Summary: ${creativeIntelligence.summary}\n`;
      if (creativeIntelligence.topFormats?.length) {
        intelligenceContext += `Top formats: ${creativeIntelligence.topFormats.join(', ')}\n`;
      }
      if (creativeIntelligence.topCopyAngles?.length) {
        intelligenceContext += `Top copy angles that WORK: ${creativeIntelligence.topCopyAngles.join(', ')}\n`;
      }
      if (creativeIntelligence.keyPatterns?.length) {
        intelligenceContext += `Key patterns:\n${creativeIntelligence.keyPatterns.map((p: string) => `- ${p}`).join('\n')}\n`;
      }
      if (creativeIntelligence.recommendations?.length) {
        intelligenceContext += `Recommendations:\n${creativeIntelligence.recommendations.map((r: string) => `- ${r}`).join('\n')}\n`;
      }
      intelligenceContext += "\nIMPORTANT: Weight your angle suggestions toward what has proven to work based on the data above, while still including 1-2 fresh test angles that explore new directions.\n";
    } else {
      intelligenceContext = "\n\n=== FIRST CAMPAIGN / NO HISTORICAL DATA ===\n";
      intelligenceContext += "This is the user's first campaign or they have no historical data. Generate a balanced mix of formats and angles to TEST what resonates with their audience. Include a diversity of talking head, b-roll, and graphic concepts.\n";
    }

    // Build previously used angles context to avoid repetition
    let previousAnglesContext = "";
    if (previouslyUsedAngles?.length > 0) {
      previousAnglesContext = "\n\n=== PREVIOUSLY USED ANGLES (DO NOT REPEAT) ===\n";
      previousAnglesContext += "The following angle names have ALREADY been generated for this offer in previous rounds. You MUST NOT reuse these names or generate angles that are essentially the same idea reworded:\n\n";
      previouslyUsedAngles.forEach((name: string) => {
        previousAnglesContext += `- "${name}"\n`;
      });
      previousAnglesContext += "\nCRITICAL: Every angle you generate must be meaningfully DIFFERENT from the above list. Do not simply rephrase or slightly rename a previously used angle. Explore entirely new psychological territories, emotional triggers, or messaging frameworks that were NOT covered before. If you find yourself generating something similar to an angle above, STOP and think of a genuinely new direction.\n";
    }

    const systemPrompt = `You are Lumi's Creative Engine. Your job is to generate creative angle recommendations for Meta ads campaigns.

KNOWLEDGE BASE:
${kbContext}
${contentAssetsContext}
${insightsContext}
${offerAudienceContext}
${preGenContext}
${intelligenceContext}
${previousAnglesContext}
${Array.isArray(neverUseWords) && neverUseWords.length > 0 ? `\n🚫 BANNED WORDS/PHRASES (strictly forbidden in all output):\n${neverUseWords.map((w: string) => `- "${w}"`).join('\n')}\nDo NOT use any of these words in angle names, descriptions, or any generated text. Find alternative phrasing.\n` : ''}

=== CRITICAL PERSPECTIVE RULE ===
${preGenerationContext?.perspectiveRole === 'buyer' 
  ? 'The person recording/posting these ads personally experienced the transformation. Frame scripts in first person: "I went from..." or "When I discovered..." — this is their own story and journey.'
  : preGenerationContext?.perspectiveRole === 'both'
  ? 'The person recording/posting these ads is a BUSINESS OWNER who ALSO personally experienced the transformation. Mix BOTH framings: personal story ("I went from...") AND client results ("My clients also..."). Use their founder story as credibility, then reference client transformations as proof of scale.'
  : 'The person recording/posting these ads is the BUSINESS OWNER — a coach, course creator, or service provider. They are NOT the person who experienced the transformation. Their CUSTOMERS/CLIENTS are the ones who got results. Frame scripts accordingly: "My client went from..." or "One of my students..." — NOT "I went from..." unless it\'s clearly the founder\'s own origin story. When referencing testimonials, attribute them to clients. The user sells the solution; their customers experienced the results.'
}

RULES:
- Generate exactly ${maxAngles === 1 ? '1 creative angle' : '8 creative angles'}${singleAngleReplacement ? `\n- You are REPLACING the angle "${singleAngleReplacement}" — generate a COMPLETELY DIFFERENT angle that serves a similar strategic purpose but takes a fresh approach` : ''}
- Each angle must have a short, plain-language name (2-4 words)
- Each angle must have a one-sentence description written for non-marketers
- Do NOT use marketing jargon, funnel language, or technical terms
- Write as if explaining to a friend who has never run ads
- Focus on what resonates emotionally, not why it works strategically
${conversationInsights?.length > 0 ? "- PRIORITIZE angles that address the specific insights shared by the user in previous conversations" : ""}
${preGenerationContext ? "- PRIORITIZE the user's specific direction for this creative round" : ""}
${creativeIntelligence?.hasData ? "- PRIORITIZE angles aligned with the user's proven top-performing creative patterns, while including 1-2 fresh test angles" : "- Generate a balanced TEST MIX of diverse angle types since there's no historical data"}
${previouslyUsedAngles?.length > 0 ? "- CRITICAL: Do NOT repeat or rephrase any angle from the PREVIOUSLY USED ANGLES list. Every angle must be a genuinely new direction." : ""}

ANGLE TYPES TO CONSIDER (but don't expose these labels to the user):
- The Moment They Realized (built from moment_they_realize — name the exact scenario)
- The Failed Alternative (built from alternative_they_tried — why what they did before didn't work)
- The Hidden Cost (what staying stuck is actually costing them emotionally, financially, in self-belief)
- The Identity Shift (who they become after — built from emotional_before_after.after)
- The Specific Objection (built directly from specific_hesitations — one angle per major hesitation)
- The Convincing Evidence (built from what_finally_convinces — lead with whatever pushes them over the line)
- The Before State (built from emotional_before_after.before — describe their current emotional reality in vivid detail)
- Social Proof Moment (someone like them who had the same doubts and crossed anyway)
- The Contrarian Take (challenge the conventional solution they've already tried)
- The Micro-Win (the smallest possible result they could get, making it feel safe to start)
- Direct Callout (name their exact identity, situation, and struggle in the first sentence)

CRITICAL ANGLE GENERATION RULES:
- Every angle MUST be built from a specific field in the psychology profiles, not invented generically
- The angle name should hint at the emotional territory, not describe a marketing technique
- The description should feel like you're reading someone's diary, not writing a marketing brief
- If moment_they_realize is provided, one angle MUST use it verbatim as the hook scenario
- If alternative_they_tried is provided, one angle MUST address exactly why that didn't work
- If emotional_before_after is provided, one angle MUST open in the "before" state with zero mention of the solution
- Angles should feel uncomfortably specific — if it could apply to any business, it's too generic

OUTPUT FORMAT:
Return ONLY valid JSON (RFC8259) with an "angles" array. No markdown, no code fences, no extra text.
Each angle object must have:
- id: unique string (lowercase, underscore-separated)
- name: short display name (2-4 words)
- description: one sentence for non-marketers
- psychologyTrigger: (optional) if based on user insights, briefly note what insight it addresses`;

    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Detect DM leads campaign context
    const isDmLeads = strategyData?.dmLeadsCampaign === true;
    const dmContext = isDmLeads ? `\n\n=== DM LEADS CAMPAIGN CONTEXT ===
This is a DM Leads campaign. The goal is to get people to SEND A DIRECT MESSAGE (DM) on ${strategyData?.conversionLocation === 'facebook' ? 'Facebook Messenger' : 'Instagram'}.
CRITICAL RULES FOR DM CAMPAIGNS:
- Every angle must be designed to make someone want to START A CONVERSATION, not click a link or buy immediately
- The CTA psychology should be low-commitment: "DM me", "Send me a message", "Ask me about..."
- Hooks should create curiosity or a personal connection that makes DM'ing feel natural
- Avoid "buy now" or "sign up" framing — this is about opening a conversation
- Think about what would make someone comfortable enough to message a stranger
- Use language that implies a 1:1 personal response (not automated/mass)
- Consider angles like: personal invitation, exclusive access via DM, quick question, free resource via DM, "tell me your situation"
` : '';

    const userPrompt = `Today's date is ${currentDate}. Ensure all content is seasonally appropriate and relevant to this time period. Do NOT reference holidays, seasons, or events that are not upcoming or current.

Generate creative angles for this campaign:

BRAND: ${brandName}

OFFER: ${offerData?.name || "Not specified"}
${offerData?.description ? `Description: ${offerData.description}` : ""}
${offerData?.price ? `Price: ${offerData.price}` : ""}

STRATEGY CONTEXT:
${JSON.stringify(strategyData, null, 2)}
${dmContext}

${audiencePsychology ? `BRAND-LEVEL AUDIENCE PSYCHOLOGY:\n${JSON.stringify(audiencePsychology, null, 2)}` : ""}

${productPsychology ? `PRODUCT PSYCHOLOGY:\n${JSON.stringify(productPsychology, null, 2)}` : ""}

Generate ${maxAngles === 1 ? 'exactly 1 creative angle as a replacement for "' + (singleAngleReplacement || '') + '"' : 'exactly 11 creative angles'} that would resonate with this audience and offer. Use both the brand-level psychology for broad appeal and the offer-specific insights for targeted messaging.${conversationInsights?.length > 0 ? " Make sure to incorporate the user's specific insights from their previous conversations." : ""}${isDmLeads ? " Remember: every angle must drive DM conversations, not link clicks or purchases." : ""}`;

    console.log("[generate-creative-angles] Calling AI API...");

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
      console.error("[generate-creative-angles] AI API error:", response.status, errorText);
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
      console.error("[generate-creative-angles] Unexpected AI response shape:", aiResponse);
      throw new Error("AI response was empty");
    }

    console.log("[generate-creative-angles] Parsing AI response...");

    // Resilient JSON extraction + repair for malformed LLM output
    const extractJson = async (text: string) => {
      const parseWithHeuristics = (input: string) => {
        const codeBlock = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
        let raw = (codeBlock?.[1] ?? input).trim();

        // Find the outermost JSON structure — either { or [
        const firstBrace = raw.indexOf("{");
        const firstBracket = raw.indexOf("[");
        
        // Determine which comes first
        let first = -1;
        let openChar = "{";
        let closeChar = "}";
        
        if (firstBrace === -1 && firstBracket === -1) throw new Error("No JSON found");
        if (firstBrace === -1) { first = firstBracket; openChar = "["; closeChar = "]"; }
        else if (firstBracket === -1) { first = firstBrace; }
        else if (firstBracket < firstBrace) { first = firstBracket; openChar = "["; closeChar = "]"; }
        else { first = firstBrace; }
        
        let depth = 0;
        let endIdx = -1;
        for (let i = first; i < raw.length; i++) {
          if (raw[i] === openChar) depth++;
          else if (raw[i] === closeChar) { depth--; if (depth === 0) { endIdx = i; break; } }
        }
        if (endIdx !== -1) {
          raw = raw.slice(first, endIdx + 1);
        } else {
          raw = raw.slice(first);
        }

        raw = raw
          .replace(/^\uFEFF/, "")
          .replace(/,\s*([}\]])/g, "$1")
          .replace(/[\x00-\x1F\x7F]/g, " ")
          .replace(/"\s*\n\s*"/g, '", "')
          .trim();

        try {
          return JSON.parse(raw);
        } catch {
          let repaired = raw;

          const openBraces = (repaired.match(/{/g) || []).length;
          const closeBraces = (repaired.match(/}/g) || []).length;
          if (openBraces > closeBraces) repaired += "}".repeat(openBraces - closeBraces);

          const openBrackets = (repaired.match(/\[/g) || []).length;
          const closeBrackets = (repaired.match(/\]/g) || []).length;
          if (openBrackets > closeBrackets) repaired += "]".repeat(openBrackets - closeBrackets);

          repaired = repaired
            .replace(/,\s*([}\]])/g, "$1")
            .replace(/,\s*$/, "")
            .trim();

          return JSON.parse(repaired);
        }
      };

      try {
        return parseWithHeuristics(text);
      } catch (initialParseError) {
        console.warn("[generate-creative-angles] Initial JSON parse failed, attempting AI repair...");

        const repairResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content:
                  "You repair malformed JSON. Return ONLY valid JSON with identical meaning. No markdown, no commentary.",
              },
              {
                role: "user",
                content: `Repair this malformed JSON and return only valid JSON:\n\n${text}`,
              },
            ],
          }),
        });

        if (!repairResponse.ok) {
          throw initialParseError;
        }

        const repairPayload = await repairResponse.json();
        const repairedContent =
          repairPayload?.choices?.[0]?.message?.content ??
          repairPayload?.choices?.[0]?.text ??
          repairPayload?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ??
          "";

        if (!repairedContent) {
          throw initialParseError;
        }

        return parseWithHeuristics(repairedContent);
      }
    };

    const parsed = await extractJson(rawContent);

    // Normalize: AI may return angles under different keys
    let angles = parsed.angles || parsed.creative_angles || parsed.data?.angles || [];
    
    // If parsed is an array itself, treat it as angles
    if (Array.isArray(parsed)) {
      angles = parsed;
    }

    // If we still have no angles, look for any array property that contains objects with 'name' and 'description'
    if (!angles.length && typeof parsed === 'object') {
      for (const key of Object.keys(parsed)) {
        const val = parsed[key];
        if (Array.isArray(val) && val.length > 0 && val[0]?.name && val[0]?.description) {
          angles = val;
          console.log(`[generate-creative-angles] Found angles under key "${key}" instead of "angles"`);
          break;
        }
      }
    }

    console.log("[generate-creative-angles] Success - generated", angles?.length || 0, "angles");
    
    // Log first angle name for debugging
    if (angles?.length > 0) {
      console.log("[generate-creative-angles] First angle:", angles[0]?.name);
    } else {
      console.error("[generate-creative-angles] WARNING: 0 angles generated. Raw content preview:", rawContent.substring(0, 500));
    }

    return new Response(JSON.stringify({ angles }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[generate-creative-angles] Error:", error);
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
