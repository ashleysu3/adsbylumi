import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { concept, stage, uploadedAssetUrl, brandInfo } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch ALL active knowledge documents - no truncation
    const { data: kbDocs, error: kbError } = await supabase
      .from('knowledge_documents')
      .select('category, title, content')
      .eq('active', true);

    if (kbError) {
      console.error('Error fetching knowledge:', kbError);
    }

    // Organize KB by category with FULL content
    const knowledgeByCategory: Record<string, any[]> = {};
    (kbDocs || []).forEach(doc => {
      if (!knowledgeByCategory[doc.category]) {
        knowledgeByCategory[doc.category] = [];
      }
      knowledgeByCategory[doc.category].push({
        title: doc.title,
        content: doc.content // FULL content, no truncation
      });
    });

    // Build comprehensive knowledge base context
    let kbContext = "=== YOUR KNOWLEDGE BASE ===\n\n";
    for (const [category, docs] of Object.entries(knowledgeByCategory)) {
      kbContext += `[${category.toUpperCase().replace('_', ' ')}]\n`;
      docs.forEach(doc => {
        kbContext += `\n${doc.title}:\n${doc.content}\n`;
      });
      kbContext += "\n";
    }

    // Extract offer-specific context from brandInfo
    const offer = brandInfo?.offer || {};
    const messagingGuidelines = offer?.messaging_guidelines || {};
    const productPsychology = offer?.product_psychology || {};

    const systemPrompt = `You are a Meta Ads copywriter specializing in high-converting ad copy that complies with Meta's policies.

## BRAND CONTEXT
- Brand Name: ${brandInfo?.name || 'Not specified'}
- Brand Voice: ${brandInfo?.voice || 'Not specified'}
- Target Audience: ${brandInfo?.audience || 'Not specified'}
- Value Proposition: ${brandInfo?.value_proposition || 'Not specified'}

## OFFER-SPECIFIC MESSAGING GUIDELINES
${messagingGuidelines.core_message ? `Core Message: ${messagingGuidelines.core_message}` : ''}
${messagingGuidelines.key_benefits?.length ? `Key Benefits to Highlight:\n${messagingGuidelines.key_benefits.map((b: string) => `- ${b}`).join('\n')}` : ''}
${messagingGuidelines.tone_notes ? `Tone Notes: ${messagingGuidelines.tone_notes}` : ''}
${messagingGuidelines.dont_say?.length ? `\n⚠️ DO NOT USE these words/phrases:\n${messagingGuidelines.dont_say.map((d: string) => `- "${d}"`).join('\n')}` : ''}
${messagingGuidelines.always_include?.length ? `\n✅ ALWAYS include these elements:\n${messagingGuidelines.always_include.map((a: string) => `- ${a}`).join('\n')}` : ''}
${messagingGuidelines.competitor_differentiation ? `\nKey Differentiation: ${messagingGuidelines.competitor_differentiation}` : ''}
${messagingGuidelines.approved_examples?.length ? `\n📝 Approved Copy Examples to Learn From:\n${messagingGuidelines.approved_examples.map((ex: any) => `- [${ex.type}] "${ex.text}"`).join('\n')}` : ''}

## PRODUCT PSYCHOLOGY
${productPsychology.positioning ? `Positioning: ${productPsychology.positioning}` : ''}
${productPsychology.pain_points?.length ? `Pain Points to Address:\n${productPsychology.pain_points.map((p: string) => `- ${p}`).join('\n')}` : ''}
${productPsychology.desires?.length ? `Desires to Tap Into:\n${productPsychology.desires.map((d: string) => `- ${d}`).join('\n')}` : ''}
${productPsychology.objections?.length ? `Objections to Overcome:\n${productPsychology.objections.map((o: string) => `- ${o}`).join('\n')}` : ''}
${productPsychology.buying_triggers?.length ? `Buying Triggers:\n${productPsychology.buying_triggers.map((t: string) => `- ${t}`).join('\n')}` : ''}

${kbContext}

=== META COMPLIANCE RULES ===
- No guarantees or income claims ("guaranteed results", "make $10k overnight")
- No personal attribute targeting ("Are you over 50?", "Struggling with weight?")
- No shocking/sensational language
- No misleading claims
- No "you" targeting that references personal characteristics

=== CTA PERFORMANCE HIERARCHY (Meta best practices) ===
- LEARN_MORE: Best for cold traffic (Grow stage), low commitment, highest CTR - DEFAULT CHOICE
- SIGN_UP: Good for Nurture stage when trust is established
- SHOP_NOW: Only for Convert stage with clear product showcase
- GET_QUOTE: Service-based businesses, Nurture/Convert
- BOOK_NOW: Appointment-based, Convert stage
- DOWNLOAD: Lead magnets, Nurture stage
- WATCH_MORE: Video content series, Grow/Nurture
- APPLY_NOW: High-commitment (jobs, programs), Convert stage

=== CONTINUITY PRINCIPLE ===
- Headline must connect to the first 3 seconds of video or top text of static
- Primary text continues the story from the creative, doesn't restart it
- Description reinforces the promise/outcome

=== CHARACTER LIMITS ===
- Headline: Max 40 characters
- Description: Max 30 characters
- Primary Text: 125 characters recommended (can go longer)

Your job: Generate Meta-compliant ad copy fields. Return JSON with:
- headline (max 40 chars)
- primary_text (125+ chars)
- description (max 30 chars)
- call_to_action (one of the Meta CTAs above, default to LEARN_MORE for Grow stage)
- cta_reasoning (explain your CTA choice and reference KB frameworks)
- why_this_works (explain copy strategy and which KB frameworks you applied)
- knowledge_applied (array of KB titles you referenced)
- compliance_check (object with passed: boolean, notes: string)

Stage context: ${stage.toUpperCase()}
`;

    const userPrompt = `Generate final Meta ad copy for this concept:

Title: ${concept.title}
Hook: ${concept.hook || 'Not provided'}
Script/Copy: ${concept.script || concept.primary_copy || 'Not provided'}
Psychology Trigger: ${concept.psychology_trigger || 'Not provided'}
Format: ${concept.format}
Stage: ${stage.toUpperCase()}
${uploadedAssetUrl ? `Creative Type: ${uploadedAssetUrl.includes('video') ? 'Video' : 'Image'}` : ''}

Generate headline, primary_text, description, and call_to_action that:
1. Maintains continuity with the hook/script
2. References relevant frameworks from the Knowledge Base
3. Defaults to LEARN_MORE for Grow stage unless there's strong reason otherwise
4. Passes Meta compliance checks
5. Applies proven copy formulas from the KB
6. STRICTLY FOLLOWS the messaging guidelines (especially "don't say" and "always include")`;

    console.log('Calling Lovable AI for copy generation...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI generation failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices[0].message.content;
    const parsedContent = JSON.parse(generatedContent);

    console.log('Successfully generated copy:', parsedContent);

    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in finalize-ad-copy:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to generate ad copy'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
