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
    
    const { concept, action, stage, brandName, audiencePsychology } = await req.json();
    
    console.log(`Expanding creative: ${action} for "${concept.title}"`);
    
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
    
    // Build context-specific prompt based on action
    let actionPrompt = '';
    let systemPrompt = `You are the Creative Department AI for ${brandName}. You generate high-converting Meta ad creative using proven psychology and frameworks.`;
    
    if (action === 'regenerate') {
      actionPrompt = `Regenerate this ${stage.toUpperCase()} creative concept with a completely different angle and approach. Keep the same format (${concept.format}) but change the core message, hook, and psychology trigger.\n\nOriginal concept:\n${JSON.stringify(concept, null, 2)}`;
    } else if (action === 'more_options') {
      actionPrompt = `Generate 2-3 alternative variations of this ${stage.toUpperCase()} creative concept. Keep the same core angle but vary the execution, wording, and specific psychology triggers.\n\nOriginal concept:\n${JSON.stringify(concept, null, 2)}`;
    } else if (action === 'expand_idea') {
      actionPrompt = `Expand this ${stage.toUpperCase()} creative concept into a more detailed, production-ready version with:\n- More detailed script or copy\n- Specific filming/design instructions\n- Additional overlay text or b-roll suggestions\n- Enhanced psychology explanation\n\nOriginal concept:\n${JSON.stringify(concept, null, 2)}`;
    }
    
    const fullPrompt = `${actionPrompt}

${audiencePsychology ? `\nAudience Psychology:\n${JSON.stringify(audiencePsychology, null, 2)}` : ''}

Knowledge Base References:
${kbByCategory['Creative Department'] ? `\nCreative Framework:\n${kbByCategory['Creative Department'][0]?.content?.substring(0, 3000)}` : ''}
${kbByCategory['Hooks'] ? `\nHook Patterns:\n${kbByCategory['Hooks'][0]?.content?.substring(0, 2000)}` : ''}
${kbByCategory['Copy Formulas'] ? `\nCopy Formulas:\n${kbByCategory['Copy Formulas'][0]?.content?.substring(0, 2000)}` : ''}

IMPORTANT RULES:
- Return valid JSON only
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
      "format": "${concept.format}",
      "stage": "${stage}",
      "angle": "...",
      "psychology_trigger": "...",
      "why_it_works": "...",
      "script": "..." (if talking_head),
      "broll_instructions": "..." (if applicable),
      "carousel_structure": "..." (if carousel),
      "static_layout": "..." (if static),
      "overlay_text": "..." (if applicable)
    }
  ]
}`;
    
    console.log('Calling Lovable AI...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment and try again.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits in Settings.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Lovable AI error: ${response.status}`);
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
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to expand creative' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});