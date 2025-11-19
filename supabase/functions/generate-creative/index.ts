import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandName, strategyData, creativeType, productPsychology, audiencePsychology } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are a Meta Ads creative director. Generate compelling ad creative that converts.

Your output must be a valid JSON object with this exact structure:
{
  "hooks": ["hook1", "hook2", "hook3"],
  "scripts": [
    {
      "title": "Script 1",
      "content": "Full 30-second script...",
      "cta": "Call to action"
    }
  ],
  "broll": ["Shot 1 description", "Shot 2 description"],
  "headlines": ["Headline 1", "Headline 2"],
  "primaryCopy": {
    "short": "Short copy version",
    "medium": "Medium copy version",
    "long": "Long copy version"
  },
  "staticGraphics": [
    {
      "title": "Graphic 1",
      "elements": ["Element 1", "Element 2"]
    }
  ]
}

Keep everything clear, direct, and focused on results.`;

    let userPrompt = `Brand: ${brandName}
Campaign Type: ${strategyData.campaign_type}
Goal: ${strategyData.name}

Messaging Framework:
${JSON.stringify(strategyData.messaging_framework, null, 2)}

Audience Psychology:
${JSON.stringify(strategyData.audience_psychology, null, 2)}`;

    // Add psychology-enhanced prompting if available
    if (audiencePsychology || productPsychology) {
      userPrompt += `\n\n=== DEEP PSYCHOLOGY INSIGHTS ===\n`;
      
      if (audiencePsychology) {
        userPrompt += `\nAUDIENCE PROFILE:
Demographics: ${audiencePsychology.demographics || 'Not specified'}
Psychographics: ${audiencePsychology.psychographics || 'Not specified'}
Core Pain Points: ${JSON.stringify(audiencePsychology.pain_points || [])}
Core Desires: ${JSON.stringify(audiencePsychology.desires || [])}
Common Objections: ${JSON.stringify(audiencePsychology.objections || [])}`;
      }
      
      if (productPsychology) {
        userPrompt += `\n\nPRODUCT POSITIONING:
${productPsychology.positioning || 'Not specified'}

BUYING TRIGGERS FOR THIS PRODUCT:
${productPsychology.buying_triggers || 'Not specified'}

PRODUCT-SPECIFIC DESIRES:
${JSON.stringify(productPsychology.product_desires || [])}

PRODUCT-SPECIFIC OBJECTIONS TO ADDRESS:
${JSON.stringify(productPsychology.product_objections || [])}

PRODUCT SOLVES THESE PAIN POINTS:
${JSON.stringify(productPsychology.product_pain_points || [])}`;
      }
      
      userPrompt += `\n\nCREATIVE DIRECTION:
1. HOOKS - Trigger the buying_triggers and speak to product_desires
2. SCRIPTS - Address product_objections and position the product correctly
3. HEADLINES - Speak directly to product pain points
4. PRIMARY COPY - Use the positioning language and audience psychographics
5. B-ROLL - Visually represent the transformation from pain points to desires

Make everything hyper-specific to this audience + product combination.`;
    } else {
      userPrompt += `\n\nGenerate ${creativeType} creative assets that speak directly to this audience. Be specific and actionable.`;
    }

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
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits in Settings.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const creativeData = JSON.parse(content);

    return new Response(JSON.stringify(creativeData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in generate-creative function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate creative' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
