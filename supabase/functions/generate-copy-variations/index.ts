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

    // Fetch active knowledge documents
    const { data: kbDocs, error: kbError } = await supabase
      .from('knowledge_documents')
      .select('category, title, content')
      .eq('active', true)
      .in('category', ['copy_formulas', 'meta_best_practices', 'psychology', 'hooks']);

    if (kbError) {
      console.error('Error fetching knowledge:', kbError);
    }

    // Organize KB by category
    const knowledgeByCategory: Record<string, any[]> = {};
    (kbDocs || []).forEach(doc => {
      if (!knowledgeByCategory[doc.category]) {
        knowledgeByCategory[doc.category] = [];
      }
      knowledgeByCategory[doc.category].push({
        title: doc.title,
        content: doc.content
      });
    });

    // Build knowledge base context
    let kbContext = "=== YOUR KNOWLEDGE BASE ===\n\n";
    for (const [category, docs] of Object.entries(knowledgeByCategory)) {
      kbContext += `[${category.toUpperCase().replace('_', ' ')}]\n`;
      docs.forEach(doc => {
        kbContext += `\n${doc.title}:\n${doc.content.substring(0, 400)}...\n`;
      });
      kbContext += "\n";
    }

    const systemPrompt = `You are a Meta Ads copywriter specializing in creating multiple high-converting variations.

${kbContext}

=== META COMPLIANCE ===
- No guarantees or income claims
- No personal attribute targeting
- No shocking/sensational language

=== CHARACTER LIMITS ===
- Headline: Max 40 characters
- Primary Text: 125-200 characters recommended
- Description: Max 30 characters

=== CTA HIERARCHY ===
LEARN_MORE is best for TOFU (default), SIGN_UP for MOFU, SHOP_NOW for BOFU

Your job: Generate 3-5 distinct copy variations, each using a DIFFERENT framework from the Knowledge Base.

Each variation must:
1. Use a specific framework (PAS, AIDA, Hook-Story-Offer, Fear-Agitation-Solution, etc.)
2. Have a unique angle while staying true to the concept
3. Maintain Meta compliance
4. Be optimized for the stage (${stage.toUpperCase()})

Return JSON array with this structure:
[
  {
    "variation_name": "PAS Framework",
    "headline": "...",
    "primary_text": "...",
    "description": "...",
    "call_to_action": "LEARN_MORE",
    "framework_used": "Problem-Agitate-Solution",
    "why_this_angle": "This variation leads with the core problem, agitates the pain, then presents your offer as the solution. Works well for pain-aware audiences.",
    "best_for": "Audiences who already know they have a problem"
  },
  // ... 2-4 more variations
]

Make each variation distinctly different in approach, tone, and messaging angle.`;

    const userPrompt = `Generate 3-5 copy variations for this concept:

Title: ${concept.title}
Hook: ${concept.hook || 'Not provided'}
Script/Copy: ${concept.script || concept.primary_copy || 'Not provided'}
Psychology Trigger: ${concept.psychology_trigger || 'Not provided'}
Format: ${concept.format}
Stage: ${stage.toUpperCase()}
Brand: ${brandInfo.name}

Create variations using DIFFERENT frameworks from the KB. Make each one unique in angle and approach.`;

    console.log('Calling Lovable AI for copy variations...');

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

    // The AI might return an object with a variations array, or just an array
    const variations = Array.isArray(parsedContent) ? parsedContent : parsedContent.variations;

    console.log(`Successfully generated ${variations.length} copy variations`);

    return new Response(JSON.stringify({ variations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-copy-variations:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to generate copy variations'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
