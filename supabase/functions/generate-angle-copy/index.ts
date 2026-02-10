import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { angles, brandInfo, offerData, audiencePsychology, brandId, offerId, offerAudiencePsychology } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) throw new Error('Missing LOVABLE_API_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase credentials');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch knowledge base documents
    const { data: kbDocs } = await supabase
      .from('knowledge_documents')
      .select('category, title, content')
      .eq('active', true);

    // Organize KB by category
    const kbByCategory: Record<string, string[]> = {};
    (kbDocs || []).forEach((doc: any) => {
      if (!kbByCategory[doc.category]) kbByCategory[doc.category] = [];
      kbByCategory[doc.category].push(`## ${doc.title}\n${doc.content}`);
    });

    const kbContext = Object.entries(kbByCategory)
      .map(([cat, docs]) => `### ${cat.toUpperCase()}\n${docs.join('\n\n')}`)
      .join('\n\n---\n\n');

     // Fetch content assets for this brand
     let contentAssetsContext = "";
     if (brandId) {
       const { data: contentAssets } = await supabase
         .from("brand_content_assets")
         .select("*")
         .eq("brand_id", brandId);
       
       if (contentAssets?.length) {
         contentAssetsContext = "\n\n## USER-PROVIDED CONTENT ASSETS\n";
         contentAssetsContext += "Use these real testimonials, scripts, and language patterns to write more authentic copy:\n\n";
         
         contentAssets.forEach((asset: any) => {
           // Filter by offer if specified
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
           
           contentAssetsContext += `### ${typeLabels[asset.asset_type] || asset.asset_type.toUpperCase()}\n${asset.content}\n\n`;
         });
         
         contentAssetsContext += "IMPORTANT: Pull specific quotes, phrases, and pain points from the above to make copy sound authentic.\n";
       }
     }
 
    // Helper to safely handle array-like fields
    const toArray = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') return [val];
      return [];
    };

    // Get emoji settings from brand (passed via brandInfo)
    const useEmojis = brandInfo?.use_emojis !== false; // Default true
    const brandEmojis = brandInfo?.brand_emojis || ['✨', '🎯', '💡', '🚀', '💪'];
    const bulletEmoji = brandInfo?.bullet_emoji || '✅';

    // Extract offer-specific messaging guidelines
    const messagingGuidelines = offerData?.messaging_guidelines || {};
    const productPsychology = offerData?.product_psychology || {};
    
    const painPoints = toArray(productPsychology.pain_points);
    const desires = toArray(productPsychology.desires);
    const objections = toArray(productPsychology.objections);
    const buyingTriggers = toArray(productPsychology.buying_triggers);
    const keyBenefits = toArray(messagingGuidelines.key_benefits);
    const dontSay = toArray(messagingGuidelines.dont_say);
    const alwaysInclude = toArray(messagingGuidelines.always_include);

    const systemPrompt = `You are an expert Meta Ads copywriter specializing in creating multiple high-converting copy variations for ${brandInfo?.name || 'this brand'}.

## YOUR TASK
Generate 3-5 variations of ad copy for EACH creative angle. Each variation should use a DIFFERENT copy framework/formula.

## COPY FORMULAS TO USE (vary between these)
- PAS: Pain → Agitate → Solution
- AIDA: Attention → Interest → Desire → Action
- Before/After: Paint the before state, then the transformation
- Story Opening: Start with a compelling micro-story hook
- Direct Benefit: Lead with the #1 outcome they want
- Social Proof: Lead with credibility/results
- Curiosity Gap: Create intrigue that demands a click

## BRAND CONTEXT
${brandInfo?.brand_voice ? `Brand Voice: ${brandInfo.brand_voice}` : ''}

## OFFER DETAILS
- Name: ${offerData?.name || 'Not specified'}
- Description: ${offerData?.description || 'Not specified'}
- Price: ${offerData?.price_point || 'Not specified'}
- Target Outcome: ${offerData?.target_outcome || 'Not specified'}

## MESSAGING GUIDELINES
${messagingGuidelines.core_message ? `Core Message: ${messagingGuidelines.core_message}` : ''}
${keyBenefits.length ? `Key Benefits:\n${keyBenefits.map((b: string) => `- ${b}`).join('\n')}` : ''}
${messagingGuidelines.tone_notes ? `Tone Notes: ${messagingGuidelines.tone_notes}` : ''}
${dontSay.length ? `\n⚠️ NEVER USE:\n${dontSay.map((d: string) => `- "${d}"`).join('\n')}` : ''}
${alwaysInclude.length ? `\n✅ ALWAYS INCLUDE:\n${alwaysInclude.map((a: string) => `- ${a}`).join('\n')}` : ''}

## PRODUCT PSYCHOLOGY
${productPsychology.positioning ? `Positioning: ${productPsychology.positioning}` : ''}
${painPoints.length ? `Pain Points:\n${painPoints.map((p: string) => `- ${p}`).join('\n')}` : ''}
${desires.length ? `Desires:\n${desires.map((d: string) => `- ${d}`).join('\n')}` : ''}
${objections.length ? `Objections:\n${objections.map((o: string) => `- ${o}`).join('\n')}` : ''}
${buyingTriggers.length ? `Buying Triggers:\n${buyingTriggers.map((t: string) => `- ${t}`).join('\n')}` : ''}

## AUDIENCE PSYCHOLOGY
${audiencePsychology?.core_desires?.length ? `Core Desires:\n${audiencePsychology.core_desires.map((d: string) => `- ${d}`).join('\n')}` : ''}
${audiencePsychology?.pain_points?.length ? `Pain Points:\n${audiencePsychology.pain_points.map((p: string) => `- ${p}`).join('\n')}` : ''}
${audiencePsychology?.objections?.length ? `Objections:\n${audiencePsychology.objections.map((o: string) => `- ${o}`).join('\n')}` : ''}

${kbContext}
 ${contentAssetsContext}

## OFFER-AUDIENCE PSYCHOLOGY
${offerAudiencePsychology ? `
This is how YOUR ideal client relates to THIS specific offer:

${offerAudiencePsychology.why_they_need_this ? `Why They Need This: ${offerAudiencePsychology.why_they_need_this}` : ''}
${offerAudiencePsychology.moment_they_realize ? `The Moment They Realize: ${offerAudiencePsychology.moment_they_realize}` : ''}
${offerAudiencePsychology.specific_hesitations?.length ? `\nSpecific Hesitations:\n${offerAudiencePsychology.specific_hesitations.map((h: string) => `- ${h}`).join('\n')}` : ''}
${offerAudiencePsychology.what_finally_convinces ? `\nWhat Convinces Them: ${offerAudiencePsychology.what_finally_convinces}` : ''}
${offerAudiencePsychology.emotional_before_after ? `\nEmotional Journey:\n  Before: ${offerAudiencePsychology.emotional_before_after.before}\n  After: ${offerAudiencePsychology.emotional_before_after.after}` : ''}

IMPORTANT: Address the specific hesitations in your copy. Paint the before→after transformation. Use the "moment they realize" insight for powerful hooks.
` : 'Not available - use general audience psychology.'}

## EMOJI & FORMATTING GUIDELINES
${useEmojis ? `
- USE emojis strategically (max 2-3 per primary copy)
- Brand's preferred emojis: ${brandEmojis.join(' ')}
- Use "${bulletEmoji}" for bullet points
- Place emojis at the START of bullets, never mid-sentence
` : `
- DO NOT use any emojis in the copy
- Use plain dashes (-) or bullet points (•) for lists
`}

## META BEST PRACTICES FOR PRIMARY COPY FORMATTING
1. Start with a HOOK (first line must stop the scroll)
2. Add a line break after the hook
3. Use short paragraphs (2-3 sentences max)
4. For bullet lists, use consistent formatting:
   ${useEmojis ? `${bulletEmoji} Benefit one\n   ${bulletEmoji} Benefit two\n   ${bulletEmoji} Benefit three` : `• Benefit one\n   • Benefit two\n   • Benefit three`}
5. End with a clear CTA on its own line
6. Total structure: Hook → Problem → Solution → Benefits → CTA

## OUTPUT FORMAT
Return valid JSON with this structure:
{
  "angle_copy": {
    "[angle_id]": {
      "headlines": [
        { "text": "...", "framework": "AIDA", "character_count": 25 },
        { "text": "...", "framework": "Curiosity", "character_count": 23 }
      ],
      "descriptions": [
        { "text": "Start your free trial", "framework": "Direct", "character_count": 21 },
        { "text": "See real results now", "framework": "Action", "character_count": 20 }
      ],
      "primary_copy": [
        { "text": "...", "framework": "Story Opening", "length": "short" },
        { "text": "...", "framework": "Direct Benefit", "length": "medium" },
        { "text": "...", "framework": "Social Proof", "length": "long" }
      ]
    }
  }
}

## COPY REQUIREMENTS
- Headlines: Max 40 characters, punchy, scroll-stopping
- Descriptions: Max 27 characters. Short action phrase that complements the headline (e.g., "Try it free", "See the results"). Don't repeat the headline.
- Primary Copy: 
  - Short: 50-100 words
  - Medium: 100-150 words
  - Long: 150-250 words
- Each variation MUST use a different framework
- Make copy angle-specific - reflect the unique positioning of each angle
- Never use hype words, guarantees, or income claims
- Sound human and conversational, not salesy`;

    const anglesDescription = angles.map((a: any) => 
      `- ID: ${a.id}\n  Name: ${a.name}\n  Description: ${a.description}`
    ).join('\n\n');

    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const userPrompt = `Today's date is ${currentDate}. Ensure all content is seasonally appropriate and relevant to this time period. Do NOT reference holidays, seasons, or events that are not upcoming or current.

Generate 3-5 copy variations for each of these creative angles:

${anglesDescription}

For each angle, create:
- 3-5 headline variations (different frameworks)
- 3-5 description variations (different frameworks)
- 3-5 primary copy variations (mix of short/medium/long, different frameworks)

Make sure each angle's copy reflects its UNIQUE positioning and psychological approach. Use the offer-audience psychology to address specific hesitations and highlight the emotional transformation.`;

    console.log(`Generating copy for ${angles.length} angles...`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits depleted. Please add credits in Settings.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    let angleCopy: any = {};
    try {
      // Extract JSON from markdown if wrapped
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1].trim();
      const parsed = JSON.parse(jsonStr);
      angleCopy = parsed.angle_copy || parsed;
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw content:', content);
      throw new Error('Failed to parse copy variations');
    }

    console.log(`Generated copy for ${Object.keys(angleCopy).length} angles`);

    return new Response(JSON.stringify({ angle_copy: angleCopy }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in generate-angle-copy:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
