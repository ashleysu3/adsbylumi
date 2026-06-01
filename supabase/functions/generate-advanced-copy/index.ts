import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      brandName,
      brandVoice,
      voiceProfile,
      offerName,
      offerDescription,
      offerUrl,
      offerPrice,
      productPsychology,
      audiencePsychology,
      brandEmojis,
      bulletEmoji,
      useEmojis,
      copyPerspective,
      neverUseWords,
      messagingGuidelines,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch knowledge base docs for copy formulas + psychology triggers
    let kbContext = "";
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: kbDocs } = await supabase
        .from("knowledge_documents")
        .select("title, content, category")
        .eq("active", true)
        .in("category", [
          "copy_formulas",
          "psychology",
          "buyer_psychology",
          "meta_best_practices",
          "hooks",
          "cta_frameworks",
        ])
        .order("priority", { ascending: false })
        .limit(10);

      if (kbDocs && kbDocs.length > 0) {
        kbContext = kbDocs
          .map((doc) => `### ${doc.title} (${doc.category})\n${doc.content}`)
          .join("\n\n")
          .slice(0, 6000);
      }
    } catch (e) {
      console.warn("KB fetch failed, continuing without KB:", e);
    }

    const perspective = copyPerspective === "We" ? "We/Our" : "I/My";
    const emojiInstruction = useEmojis !== false
      ? `USE EMOJIS liberally. Brand emojis: ${(brandEmojis || ["✨", "🎯", "💡", "🚀", "💪"]).join(" ")}. Bullet emoji: ${bulletEmoji || "✅"}. Place emojis at the start of key lines and as bullet points.`
      : "Do NOT use emojis.";

    const neverWords = neverUseWords?.length > 0
      ? `NEVER use these words: ${neverUseWords.join(", ")}`
      : "";

    const psychContext = productPsychology
      ? `\n## Product Psychology\n${JSON.stringify(productPsychology, null, 2).slice(0, 2000)}`
      : "";

    const audienceContext = audiencePsychology
      ? `\n## Audience Psychology\n${JSON.stringify(audiencePsychology, null, 2).slice(0, 2000)}`
      : "";

    const guidelinesContext = messagingGuidelines && Object.keys(messagingGuidelines).length > 0
      ? `\n## Messaging Guidelines\n${JSON.stringify(messagingGuidelines, null, 2).slice(0, 1500)}`
      : "";

    const systemPrompt = `You are the world's best Meta Ads copywriter working for "${brandName || "a premium brand"}". You write psychology-driven, emotionally compelling, conversion-optimized ad copy.

## VOICE & PERSPECTIVE
- Brand voice: ${brandVoice || "Professional, warm, strategic"}
- Write in ${perspective} perspective consistently
- Match the brand's tone exactly — be their voice, not a generic marketer
${voiceProfile ? `\n## DETAILED BRAND VOICE PROFILE (MATCH THIS — it's how the brand actually sounds across their website and social. Override any generic copywriting instinct that conflicts.)\n${JSON.stringify(voiceProfile, null, 2).slice(0, 2000)}` : ""}

## FORMATTING RULES (CRITICAL)
- Primary text MUST follow this structure:
  1. Start with a POWERFUL hook line that stops the scroll (pattern interrupt, bold claim, or emotional trigger)
  2. Follow with a BLANK LINE
  3. Then 2-3 short paragraphs (1-2 sentences each) with BLANK LINES between them
  4. Use ${bulletEmoji || "✅"} bullet points for benefits/features
  5. End with a clear call-to-action line
- ${emojiInstruction}
- NO walls of text. Every line should breathe.
- Hook → Problem → Solution → Benefits → CTA

## CHARACTER LIMITS (STRICT)
- Headline: MAXIMUM 26 characters (this is a hard limit — Meta truncates beyond this)
- Description: MAXIMUM 27 characters (short, complementary action phrase)
- Primary text: 150-300 characters ideal, up to 500 max

## COPY QUALITY RULES
- Each variation must use a DIFFERENT psychology angle (problem-solution, social proof, curiosity/open loop, transformation/before-after, urgency/scarcity)
- Lead with the audience's #1 pain point or deepest desire
- Use specific numbers, outcomes, or timeframes when possible
- ${neverWords}
- ALWAYS use digits for numbers: "7 days" not "seven days", "$997" not "$nine hundred ninety-seven"
- Keep sentences punchy and scannable — no filler words, double-check spelling
- NEVER use hype words like "revolutionary", "game-changing", "unlock your potential"
- NEVER make income claims, health guarantees, or personal attribute assumptions
- NEVER use generic phrases like "Don't miss out" or "Act now" without context

${kbContext ? `\n## KNOWLEDGE BASE REFERENCE\n${kbContext}` : ""}

Return exactly 5 variations using the tool provided. Each must feel distinctly different in angle and psychology.`;

    const userPrompt = `Write 5 high-converting ad copy variations for this campaign.

## BRAND
Brand: ${brandName || "Unknown"}

## OFFER DETAILS
Offer: ${offerName || "Unknown"}
Description: ${offerDescription || "N/A"}
URL: ${offerUrl || "N/A"}
Price: ${offerPrice || "N/A"}
${psychContext}
${audienceContext}
${guidelinesContext}

## REQUIRED ANGLES (one per variation)
1. Problem-Solution: Lead with the pain, present the offer as the fix
2. Social Proof / Authority: Imply credibility, results, trust
3. Curiosity / Open Loop: Tease a result or insight without revealing everything
4. Transformation: Paint the before/after picture
5. Direct Benefit: Lead with the strongest tangible outcome

Remember:
- Headlines ≤ 26 chars (STRICT)
- Descriptions ≤ 27 chars (short action phrase like "Try it free today" or "Start your journey")
- Primary text: hook line → blank line → short paragraphs → CTA
- Each variation MUST feel completely different`;

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
                description: "Return 5 ad copy variations with different psychology angles",
                parameters: {
                  type: "object",
                  properties: {
                    variations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          primary_text: { type: "string", description: "Main ad copy with hook, spacing, and CTA. Use \\n\\n for paragraph breaks." },
                          headline: { type: "string", description: "Max 26 characters" },
                          description: { type: "string", description: "Max 27 characters" },
                          angle: { type: "string", description: "The psychology angle used (e.g. problem-solution, social-proof, curiosity, transformation, direct-benefit)" },
                        },
                        required: ["primary_text", "headline", "description", "angle"],
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
