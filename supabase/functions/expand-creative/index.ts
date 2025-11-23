import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { concept, action, stage, brandName, audiencePsychology, existingConcepts, strategyData, creativeFeedback } = await req.json();
    
    console.log(`Expanding creative: ${action} for stage "${stage}"`);
    
    // Fetch all knowledge bases
    const { data: kbDocs } = await supabase
      .from('knowledge_documents')
      .select('category, title, content')
      .eq('active', true);
    
    const kbByCategory = (kbDocs || []).reduce((acc: any, doc: any) => {
      if (!acc[doc.category]) acc[doc.category] = [];
      acc[doc.category].push({ title: doc.title, content: doc.content });
      return acc;
    }, {});
    
    // Build feedback insights
    let feedbackContext = '';
    if (creativeFeedback?.hated_concepts?.length > 0) {
      const relevantFeedback = creativeFeedback.hated_concepts
        .filter((f: any) => f.stage === stage)
        .slice(-5); // Last 5 feedback items for this stage
      
      if (relevantFeedback.length > 0) {
        feedbackContext = `\n\nUSER PREFERENCE LEARNING:
The user has provided feedback on concepts they disliked. Learn from these patterns:
${relevantFeedback.map((f: any, i: number) => 
  `${i + 1}. Disliked: "${f.concept.title}"
     Reason: ${f.feedback}
     Format: ${f.concept.format}
`).join('\n')}

IMPORTANT: While respecting these preferences, gently push back when user feedback conflicts with Meta's proven best practices. For example:
- If they dislike "curiosity gaps" but that's working in Meta - include them but explain why
- If they want overly formal language but conversational works better - find middle ground
- Balance their preferences with current Meta performance data

Your goal: Educate while respecting their voice.`;
      }
    }
    
    // Build context-specific prompt based on action
    let actionPrompt = '';
    let systemPrompt = `You are the Creative Department AI for ${brandName}. You generate high-converting Meta ad creative using proven psychology and frameworks.`;
    
    if (action === 'regenerate_stage') {
      const stageInfoMap: Record<string, { label: string; count: string; goal: string }> = {
        tofu: { label: 'TOFU (Top of Funnel)', count: '3-5', goal: 'Interrupt scroll, create awareness, spark interest' },
        mofu: { label: 'MOFU (Middle of Funnel)', count: '2-4', goal: 'Build trust, provide value, address objections' },
        bofu: { label: 'BOFU (Bottom of Funnel)', count: '2-3', goal: 'Drive action, overcome final objections, close the sale' }
      };
      const stageInfo = stageInfoMap[stage] || { label: stage.toUpperCase(), count: '2-4', goal: 'Create engaging creative' };
      
      actionPrompt = `Generate ${stageInfo.count} COMPLETELY NEW ${stageInfo.label} creative concepts.

Goal: ${stageInfo.goal}

${feedbackContext}

${existingConcepts ? `Previous concepts (for reference only - generate DIFFERENT ideas):\n${JSON.stringify(existingConcepts, null, 2)}` : ''}

${strategyData ? `Strategy Context:\n${JSON.stringify(strategyData, null, 2)}` : ''}

Requirements:
- Generate fresh angles and approaches
- Use diverse formats (talking_head, b_roll, carousel, static)
- Apply appropriate psychology triggers for ${stage.toUpperCase()}
- Include complete production instructions
- Make each concept unique and production-ready
- Learn from what the user dislikes, but prioritize Meta best practices`;
    } else if (action === 'regenerate') {
      actionPrompt = `Regenerate this ${stage.toUpperCase()} creative concept with a completely different angle and approach. Keep the same format (${concept.format}) but change the core message, hook, and psychology trigger.\n\nOriginal concept:\n${JSON.stringify(concept, null, 2)}`;
    } else if (action === 'more_options') {
      actionPrompt = `Generate 2-3 alternative variations of this ${stage.toUpperCase()} creative concept. Keep the same core angle but vary the execution, wording, and specific psychology triggers.

${feedbackContext}

Original concept:
${JSON.stringify(concept, null, 2)}`;
    } else if (action === 'expand_idea') {
      actionPrompt = `Expand this ${stage.toUpperCase()} creative concept into a more detailed, production-ready version with:\n- More detailed script or copy\n- Specific filming/design instructions\n- Additional overlay text or b-roll suggestions\n- Enhanced psychology explanation\n\nOriginal concept:\n${JSON.stringify(concept, null, 2)}`;
    }
    
    const fullPrompt = `${actionPrompt}

${audiencePsychology ? `\nAudience Psychology:\n${JSON.stringify(audiencePsychology, null, 2)}` : ''}

Knowledge Base References:
${kbByCategory['Creative Department'] ? `\nCreative Framework:\n${kbByCategory['Creative Department'][0]?.content?.substring(0, 2000)}` : ''}
${kbByCategory['Hooks'] ? `\nHook Patterns:\n${kbByCategory['Hooks'][0]?.content?.substring(0, 1500)}` : ''}
${kbByCategory['Copy Formulas'] ? `\nCopy Formulas:\n${kbByCategory['Copy Formulas'][0]?.content?.substring(0, 1500)}` : ''}

IMPORTANT RULES:
- Return valid JSON only
- For "regenerate_stage": return 3-5 (TOFU) or 2-4 (MOFU) or 2-3 (BOFU) completely new concepts
- For "regenerate": return 1 completely new concept
- For "more_options": return array of 2-3 variations
- For "expand_idea": return 1 enhanced version with more detail
- Each concept must have: title, format, stage, angle, psychology_trigger, why_it_works
- Include format-specific fields: script, broll_instructions, carousel_structure, static_layout, overlay_text (as applicable)
- Keep ${stage.toUpperCase()} stage appropriate

Return JSON structure:
{
  "concepts": [
    {
      "title": "...",
      "format": "talking_head | b_roll | carousel | static",
      "stage": "${stage}",
      "angle": "...",
      "psychology_trigger": "...",
      "why_it_works": "...",
      "production_notes": "...",
      "script": "..." (if talking_head),
      "broll_instructions": "..." (if applicable),
      "carousel_structure": "..." (if carousel),
      "static_layout": "..." (if static),
      "overlay_text": "..." (if applicable)
    }
  ]
}`;
    
    console.log('Calling Lovable AI...');
    
    // Retry logic for transient errors
    let response;
    let lastError;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second base delay
    
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
            max_tokens: 4000, // Limit response size
          }),
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (response.ok) {
          break; // Success, exit retry loop
        }

        // Handle specific error codes
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

        // 500 errors - retry with exponential backoff
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
          // Other errors - don't retry
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

    // If all retries failed
    if (!response || !response.ok) {
      throw new Error(`Failed after ${maxRetries} attempts: ${lastError || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('AI response received, parsing...');
    
    // Extract JSON from response
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
      console.log('Raw content:', content);
      throw new Error('Failed to parse AI response');
    }
    
    console.log(`Generated ${expandedConcepts.length} expanded concept(s)`);
    
    return new Response(
      JSON.stringify({ 
        concepts: expandedConcepts,
        action: action 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Error in expand-creative:', error);
    
    // Provide user-friendly error messages
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