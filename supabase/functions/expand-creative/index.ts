import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from '../_shared/cors.ts';

// ALL Knowledge Base categories that must be fetched and applied
const ALL_KB_CATEGORIES = [
  'creative',
  'copy',
  'visual',
  'meta_best_practices',
  'ad_strategy',
  'customer_journey',
  'buyer_psychology',
  'creative_troubleshooting',
  'format_rules',
  'offer_mapping',
  'niche',
  'trends',
  'hook_library',
  'compliance'
];

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { concept, action, stage, brandName, brandData, audiencePsychology, existingConcepts, strategyData, creativeFeedback } = await req.json();
    
    console.log(`Expanding creative: ${action} for stage "${stage}"`);
    
    // Fetch ALL knowledge bases - FULL content for comprehensive creative generation
    const { data: kbDocs } = await supabase
      .from('knowledge_documents')
      .select('category, title, content')
      .eq('active', true);
    
    // Organize KB content by category for structured access
    const kbByCategory: Record<string, Array<{title: string, content: string}>> = {};
    (kbDocs || []).forEach((doc: any) => {
      if (!kbByCategory[doc.category]) kbByCategory[doc.category] = [];
      kbByCategory[doc.category].push({ title: doc.title, content: doc.content });
    });
    
    // Build comprehensive KB sections
    const customerJourneyKB = kbByCategory['customer_journey']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const psychologyKB = kbByCategory['buyer_psychology']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const creativeKB = kbByCategory['creative']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const copyKB = kbByCategory['copy']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const visualKB = kbByCategory['visual']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const troubleshootingKB = kbByCategory['creative_troubleshooting']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const formatRulesKB = kbByCategory['format_rules']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const offerMappingKB = kbByCategory['offer_mapping']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const nicheKB = kbByCategory['niche']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const trendsKB = kbByCategory['trends']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const hookLibraryKB = kbByCategory['hook_library']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const metaBestPracticesKB = kbByCategory['meta_best_practices']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const adStrategyKB = kbByCategory['ad_strategy']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const complianceKB = kbByCategory['compliance']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    
    // Build full KB context for prompt
    let kbContext = "=== LUMI'S COMPLETE KNOWLEDGE BASE ===\n\n";
    for (const [category, docs] of Object.entries(kbByCategory)) {
      kbContext += `[${(category as string).toUpperCase().replace(/_/g, ' ')}]\n`;
      docs.forEach(doc => {
        kbContext += `\n${doc.title}:\n${doc.content}\n`;
      });
      kbContext += "\n---\n";
    }
    
    // Extract offer-specific context
    const offer = brandData?.offer || {};
    const messagingGuidelines = offer?.messaging_guidelines || {};
    const productPsychology = offer?.product_psychology || {};
    
    // Build feedback insights
    let feedbackContext = '';
    if (creativeFeedback?.hated_concepts?.length > 0) {
      const relevantFeedback = creativeFeedback.hated_concepts
        .filter((f: any) => f.stage === stage)
        .slice(-5);
      
      if (relevantFeedback.length > 0) {
        feedbackContext = `\n\nUSER PREFERENCE LEARNING:
The user has provided feedback on concepts they disliked. Learn from these patterns:
${relevantFeedback.map((f: any, i: number) => 
  `${i + 1}. Disliked: "${f.concept.title}"
     Reason: ${f.feedback}
     Format: ${f.concept.format}
`).join('\n')}

IMPORTANT: While respecting these preferences, gently push back when user feedback conflicts with Meta's proven best practices.`;
      }
    }
    
    // Build comprehensive system prompt with ALL KB integration
    const systemPrompt = `You are the Creative Department AI for ${brandName || brandData?.name || 'this brand'}.

## LUMI'S CREATIVE PHILOSOPHY
Every creative concept you generate MUST be informed by ALL of Lumi's Knowledge Bases. You are not a generic AI - you are Lumi, with deep expertise in Meta advertising psychology and proven frameworks.

## MANDATORY KB INTEGRATION
Every concept MUST demonstrate application of:
1. Customer Journey KB - Correct stage targeting (Grow/Nurture/Convert)
2. Buyer Psychology KB - Specific psychological triggers
3. Creative Best Practices KB - Platform-proven performance principles
4. Copy Formula KB - Proven hook and CTA formulas
5. Visual Guidelines KB - Format-specific visual rules
6. Format Rules KB - Talking head, b-roll, carousel, static requirements
7. Offer Mapping KB - Adjustments based on offer type
8. Niche KB - Industry-specific patterns
9. Hook Library KB - Proven hook structures
10. Trends KB - Optional but available for trend content

## BRAND CONTEXT
- Brand Voice: ${brandData?.voice || 'Not specified'}
- Target Audience: ${brandData?.audience || 'Not specified'}
- Value Proposition: ${brandData?.value_proposition || 'Not specified'}

## OFFER-SPECIFIC MESSAGING GUIDELINES
${messagingGuidelines.core_message ? `Core Message: ${messagingGuidelines.core_message}` : ''}
${messagingGuidelines.key_benefits?.length ? `Key Benefits:\n${messagingGuidelines.key_benefits.map((b: string) => `- ${b}`).join('\n')}` : ''}
${messagingGuidelines.tone_notes ? `Tone Notes: ${messagingGuidelines.tone_notes}` : ''}
${messagingGuidelines.dont_say?.length ? `\n⚠️ NEVER USE:\n${messagingGuidelines.dont_say.map((d: string) => `- "${d}"`).join('\n')}` : ''}
${messagingGuidelines.always_include?.length ? `\n✅ ALWAYS INCLUDE:\n${messagingGuidelines.always_include.map((a: string) => `- ${a}`).join('\n')}` : ''}
${messagingGuidelines.competitor_differentiation ? `\nDifferentiation: ${messagingGuidelines.competitor_differentiation}` : ''}
${messagingGuidelines.approved_examples?.length ? `\n📝 Approved Examples:\n${messagingGuidelines.approved_examples.map((ex: any) => `- [${ex.type}] "${ex.text}"`).join('\n')}` : ''}

## PRODUCT PSYCHOLOGY
${productPsychology.positioning ? `Positioning: ${productPsychology.positioning}` : ''}
${productPsychology.pain_points?.length ? `Pain Points:\n${productPsychology.pain_points.map((p: string) => `- ${p}`).join('\n')}` : ''}
${productPsychology.desires?.length ? `Desires:\n${productPsychology.desires.map((d: string) => `- ${d}`).join('\n')}` : ''}
${productPsychology.objections?.length ? `Objections:\n${productPsychology.objections.map((o: string) => `- ${o}`).join('\n')}` : ''}
${productPsychology.buying_triggers?.length ? `Triggers:\n${productPsychology.buying_triggers.map((t: string) => `- ${t}`).join('\n')}` : ''}

${kbContext}

## MULTI-KB VALIDATION RULES
Before including ANY concept in your output, validate it passes ALL checks:

✔ JOURNEY STAGE ACCURACY - Does it match the psychological state of ${stage.toUpperCase()} stage?
✔ PSYCHOLOGICAL TRIGGER ACCURACY - Is the psychology trigger specific and correctly applied?
✔ FORMAT SUITABILITY - Does the format match the content type and stage?
✔ OFFER ALIGNMENT - Does it properly represent this specific offer?
✔ NICHE RELEVANCE - Does it incorporate industry-specific patterns?
✔ BEST PRACTICES COMPLIANCE - Does it follow Meta's proven performance principles?
✔ COPY FORMULA INTEGRATION - Are hooks, CTAs, and copy using proven formulas?
✔ VISUAL GUIDELINES - Do visual directions follow platform best practices?
✔ TREND RELEVANCE - If using trends, are they properly adapted to brand?

If ANY check fails → regenerate the concept before including it.

## KB APPLICATION RULES
- Customer Journey: Grow = attention/awareness, Nurture = trust/value, Convert = action/urgency
- Psychology: Each concept needs a SPECIFIC trigger (not generic like "emotional appeal")
- Formats: talking_head needs script, carousel needs slide structure, static needs layout
- Copy: Use frameworks like PAS, AIDA, Before-After-Bridge from Copy KB
- Hooks: First 3 seconds are critical - use Hook Library patterns
- Visuals: Follow platform-specific size and format rules`;
    
    // Build context-specific prompt based on action
    let actionPrompt = '';
    
    if (action === 'regenerate_stage') {
      const stageInfoMap: Record<string, { label: string; count: string; goal: string }> = {
        grow: { label: 'Grow (Attract New People)', count: '3-5', goal: 'Interrupt scroll, spark interest, attract new audiences' },
        nurture: { label: 'Nurture (Build Trust)', count: '2-4', goal: 'Build trust, provide value, deepen understanding' },
        convert: { label: 'Convert (Inspire Action)', count: '2-3', goal: 'Drive action, overcome final objections, guide to purchase' },
        tofu: { label: 'Grow (Attract New People)', count: '3-5', goal: 'Interrupt scroll, spark interest, attract new audiences' },
        mofu: { label: 'Nurture (Build Trust)', count: '2-4', goal: 'Build trust, provide value, deepen understanding' },
        bofu: { label: 'Convert (Inspire Action)', count: '2-3', goal: 'Drive action, overcome final objections, guide to purchase' }
      };
      const stageInfo = stageInfoMap[stage] || { label: stage.toUpperCase(), count: '2-4', goal: 'Create engaging creative' };
      
      actionPrompt = `Generate ${stageInfo.count} COMPLETELY NEW ${stageInfo.label} creative concepts.

Goal: ${stageInfo.goal}

${feedbackContext}

${existingConcepts ? `Previous concepts (for reference only - generate DIFFERENT ideas):\n${JSON.stringify(existingConcepts, null, 2)}` : ''}

${strategyData ? `Strategy Context:\n${JSON.stringify(strategyData, null, 2)}` : ''}

Requirements:
- Generate fresh angles using DIFFERENT frameworks from the KB
- Apply ALL relevant Knowledge Bases to each concept
- Use diverse formats (talking_head, b_roll, carousel, static)
- Apply stage-appropriate psychology triggers from Buyer Psychology KB
- Include complete production instructions following Format Rules KB
- Use hooks from Hook Library KB
- Make each concept unique and production-ready
- STRICTLY FOLLOW messaging guidelines`;
    } else if (action === 'regenerate') {
      actionPrompt = `Regenerate this ${stage.toUpperCase()} creative concept using a DIFFERENT framework from the KB.

Keep the same format (${concept.format}) but change:
- Core angle (use different psychology trigger)
- Hook approach (try different Hook Library pattern)
- Copy formula (use different framework from Copy KB)

Original concept:
${JSON.stringify(concept, null, 2)}

Apply ALL Knowledge Bases to create a truly different approach while maintaining format.`;
    } else if (action === 'more_options') {
      actionPrompt = `Generate 2-3 alternative variations using DIFFERENT KB frameworks.

${feedbackContext}

Original concept:
${JSON.stringify(concept, null, 2)}

For each variation:
- Use a different psychology trigger from Buyer Psychology KB
- Apply a different copy formula from Copy KB
- Try different hook patterns from Hook Library KB
- Maintain the core angle but vary the execution`;
    } else if (action === 'expand_idea') {
      actionPrompt = `Expand this ${stage.toUpperCase()} concept into a fully production-ready version.

Original concept:
${JSON.stringify(concept, null, 2)}

Enhance with:
- Complete script/copy using Copy Formula KB frameworks
- Detailed filming/design instructions from Format Rules KB
- For b-roll: suggest ONLY lofi everyday shots (pouring coffee, typing, walking, etc.) with text overlays that do the selling
- Psychology explanation referencing Buyer Psychology KB
- Hook optimization using Hook Library KB
- Any relevant trend adaptations from Trends KB`;
    }
    
    const fullPrompt = `${actionPrompt}

${audiencePsychology ? `\nAudience Psychology:\n${JSON.stringify(audiencePsychology, null, 2)}` : ''}

CRITICAL OUTPUT REQUIREMENTS:
- Return valid JSON only
- Each concept must include: title, format, stage, angle, psychology_trigger, why_it_works, content_type, kb_references
- content_type: story | transformation | identity | emotional | authority | educational | objection
- kb_references: array of KB names that informed this concept
- Include format-specific fields: script, broll_instructions (lofi everyday shots only — NOT cinematic), broll_shots (array of simple shot ideas), carousel_structure, static_layout, overlay_text
- Include hooks array with 2-3 hook variations
- Keep ${stage.toUpperCase()} stage appropriate

JSON Structure:
{
  "concepts": [
    {
      "title": "...",
      "format": "talking_head | b_roll | carousel | static",
      "stage": "${stage}",
      "angle": "...",
      "content_type": "story | transformation | identity | emotional | authority | educational | objection",
      "psychology_trigger": "Specific trigger from Buyer Psychology KB",
      "why_it_works": "KB-informed explanation",
      "kb_references": ["customer_journey", "buyer_psychology", "creative", "copy", ...],
      "hooks": ["Hook 1", "Hook 2"],
      "production_notes": "...",
      "script": "..." (if talking_head),
      "broll_instructions": "..." (if applicable),
      "carousel_structure": "..." (if carousel),
      "static_layout": "..." (if static),
      "overlay_text": "..." (if applicable),
      "validation_passed": true
    }
  ],
  "kb_compliance_report": {
    "kbs_applied": ["list of KBs used"],
    "validation_status": "passed"
  }
}`;
    
    console.log('Calling Lovable AI with full KB integration...');
    
    // Retry logic for transient errors
    let response;
    let lastError;
    const maxRetries = 3;
    const retryDelay = 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: fullPrompt }
            ],
            temperature: 0.9,
            max_tokens: 6000,
          }),
          signal: AbortSignal.timeout(45000),
        });

        if (response.ok) {
          break;
        }

        if (response.status === 429) {
          console.log(`Rate limit hit on attempt ${attempt}, waiting...`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            continue;
          }
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment and try again.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: 'AI credits depleted. Please check your account.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (response.status === 500 || response.status === 503) {
          const errorText = await response.text();
          console.error(`AI service error (attempt ${attempt}/${maxRetries}):`, response.status, errorText.substring(0, 200));
          lastError = `AI service temporarily unavailable (${response.status})`;
          
          if (attempt < maxRetries) {
            const backoffDelay = retryDelay * Math.pow(2, attempt - 1);
            console.log(`Retrying in ${backoffDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            continue;
          }
        } else {
          const errorText = await response.text();
          console.error('Lovable AI error:', response.status, errorText.substring(0, 500));
          throw new Error(`AI error: ${response.status}`);
        }
        
      } catch (fetchError: any) {
        console.error(`Fetch error on attempt ${attempt}:`, fetchError.message);
        lastError = fetchError.message;
        
        if (attempt < maxRetries) {
          const backoffDelay = retryDelay * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${backoffDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }
      }
    }

    if (!response || !response.ok) {
      throw new Error(`Failed after ${maxRetries} attempts: ${lastError || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('AI response received, parsing...');
    
    let expandedConcepts;
    try {
      const jsonMatch = content.match(/\{[\s\S]*"concepts"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        expandedConcepts = parsed.concepts || [];
      } else {
        throw new Error('No valid JSON found in response');
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.log('Raw content:', content.substring(0, 500));
      throw new Error('Failed to parse AI response');
    }
    
    console.log(`Generated ${expandedConcepts.length} KB-informed expanded concept(s)`);
    
    return new Response(
      JSON.stringify({ 
        concepts: expandedConcepts,
        action: action 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Error in expand-creative:', error);
    
    let errorMessage = 'Failed to expand creative';
    let statusCode = 500;
    
    if (error.message?.includes('timeout') || error.message?.includes('aborted')) {
      errorMessage = 'AI service timeout. The request took too long. Please try again with a simpler prompt.';
      statusCode = 504;
    } else if (error.message?.includes('Failed after')) {
      errorMessage = 'AI service temporarily unavailable. Please try again in a few moments.';
      statusCode = 503;
    } else if (error.message?.includes('parse')) {
      errorMessage = 'Failed to process AI response. Please try regenerating.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
