import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandName, strategyData, productPsychology, audiencePsychology } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Initialize Supabase client to fetch knowledge base
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch ALL relevant knowledge documents
    const { data: knowledgeDocs } = await supabase
      .from('knowledge_documents')
      .select('category, title, content')
      .eq('active', true)
      .in('category', [
        'ad_planner',
        'hooks',
        'copy_formulas',
        'creative_department',
        'psychology',
        'visual_guidelines',
        'meta_best_practices'
      ]);

    // Organize knowledge by category
    const knowledgeByCategory: Record<string, string> = {};
    if (knowledgeDocs) {
      for (const doc of knowledgeDocs) {
        if (!knowledgeByCategory[doc.category]) {
          knowledgeByCategory[doc.category] = '';
        }
        knowledgeByCategory[doc.category] += `\n### ${doc.title}\n${doc.content}\n`;
      }
    }

    const systemPrompt = `You are the Creative Department for Your Ad Assistant — an elite Meta Ads creative agency specialized in psychology-driven, full-funnel ad creative.

=== CRITICAL OUTPUT REQUIREMENTS ===

You MUST return a valid JSON object with this EXACT structure:

{
  "creative_mix": {
    "tofu": [
      {
        "id": "tofu_1",
        "title": "Creative concept title",
        "stage": "tofu",
        "format": "talking_head" | "b_roll" | "carousel" | "static" | "script" | "overlay",
        "angle": "curiosity" | "pain" | "proof" | "authority" | "clarity" | "desire" | "identity" | "urgency",
        "psychology_trigger": "specific trigger used",
        "script": "Full 30s script if applicable",
        "overlay_text": ["Line 1", "Line 2"] if applicable,
        "broll_instructions": ["Shot 1", "Shot 2"] if applicable,
        "carousel_structure": {
          "slides": [
            {"text": "Slide 1 text", "visual": "visual description"}
          ]
        } if applicable,
        "static_layout": "Layout description for static graphics" if applicable,
        "why_it_works": "Psychology explanation",
        "production_notes": "Filming/production guidance"
      }
    ],
    "mofu": [ /* same structure */ ],
    "bofu": [ /* same structure */ ]
  },
  "scripts": [
    {
      "id": "script_1",
      "stage": "tofu" | "mofu" | "bofu",
      "title": "Script title",
      "content": "Full script content",
      "cta": "Call to action",
      "timing": "30s",
      "angle": "curiosity" | "pain" etc
    }
  ],
  "broll_lists": [
    {
      "id": "broll_1",
      "stage": "tofu" | "mofu" | "bofu",
      "related_script_id": "script_1",
      "shots": [
        {
          "shot_number": 1,
          "description": "Shot description",
          "duration": "3-5s",
          "notes": "Filming notes"
        }
      ]
    }
  ],
  "carousels": [
    {
      "id": "carousel_1",
      "stage": "tofu" | "mofu" | "bofu",
      "title": "Carousel title",
      "type": "educational" | "myth-busting" | "teaching" | "case-study" | "benefits" | "transformation",
      "angle": "curiosity" etc,
      "slides": [
        {
          "slide_number": 1,
          "text": "Slide text",
          "visual_direction": "What to show",
          "layout": "Layout description"
        }
      ]
    }
  ],
  "static_graphics": [
    {
      "id": "static_1",
      "stage": "tofu" | "mofu" | "bofu",
      "title": "Graphic title",
      "type": "headline" | "offer-breakdown" | "case-study" | "stat-graphic",
      "elements": ["Element 1", "Element 2"],
      "layout": "Layout description",
      "specs": "9:16 ratio, bold text, etc"
    }
  ],
  "headlines": [
    {
      "id": "headline_1",
      "stage": "tofu" | "mofu" | "bofu",
      "text": "Headline text (<25 chars)",
      "angle": "curiosity" etc,
      "use_case": "When to use this"
    }
  ],
  "primary_copy": {
    "short": [
      {
        "stage": "tofu" | "mofu" | "bofu",
        "text": "Short copy (125 chars)",
        "angle": "curiosity" etc
      }
    ],
    "medium": [ /* same structure, 300 chars */ ],
    "long": [ /* same structure, 500+ chars */ ]
  },
  "descriptions": [
    {
      "stage": "tofu" | "mofu" | "bofu",
      "text": "Description text",
      "angle": "curiosity" etc
    }
  ],
  "ctas": [
    {
      "stage": "tofu" | "mofu" | "bofu",
      "text": "CTA text",
      "type": "button_text" | "link_text",
      "urgency_level": "low" | "medium" | "high"
    }
  ],
  "production_notes": [
    {
      "stage": "tofu" | "mofu" | "bofu",
      "format": "talking_head" | "b_roll" etc,
      "notes": [
        "Note 1",
        "Note 2"
      ]
    }
  ]
}

=== FUNNEL STAGE REQUIREMENTS ===

TOFU (Top of Funnel) - 3-5 concepts:
- Formats: Hooks, talking-head scripts, b-roll sequences, educational carousels, myth-busting carousels, static headline graphics
- Angles: curiosity, authority, pain
- Goal: Interrupt scroll, create awareness, spark interest
- Psychology: Pattern interrupt, curiosity gap, social proof, authority

MOFU (Middle of Funnel) - 2-4 concepts:
- Formats: Story-based scripts, testimonials, teaching carousels, case study graphics
- Angles: proof, clarity, desire
- Goal: Build trust, provide value, address objections
- Psychology: Reciprocity, social proof, transformation stories

BOFU (Bottom of Funnel) - 2-3 concepts:
- Formats: Offer breakdown static, benefits carousel, CTA-focused creative, transformation story video outline
- Angles: desire, urgency, identity
- Goal: Drive action, overcome final objections, close the sale
- Psychology: Scarcity, urgency, identity shift, loss aversion

=== KNOWLEDGE BASE REFERENCE ===

${Object.keys(knowledgeByCategory).length > 0 ? `
${knowledgeByCategory.ad_planner || ''}
${knowledgeByCategory.hooks || ''}
${knowledgeByCategory.copy_formulas || ''}
${knowledgeByCategory.creative_department || ''}
${knowledgeByCategory.psychology || ''}
${knowledgeByCategory.visual_guidelines || ''}
${knowledgeByCategory.meta_best_practices || ''}

APPLY THESE GUIDELINES:
- Follow all hook patterns from the Hooks Library
- Use copy formulas for all written content
- Follow visual guidelines for all creative direction
- Apply psychology triggers strategically per funnel stage
- Reference niche knowledge for industry-specific angles
- Use seasonality patterns if relevant
- Follow creative troubleshooting best practices
` : 'Generate creative based on best practices for Meta Ads.'}

=== PRODUCTION STANDARDS ===

Every creative must include:
1. Clear filming/production instructions
2. Specific shot requirements (framing, lighting, props)
3. Text overlay specifications
4. Ratio guidance (9:16 for Reels, 4:5 for Feed, 1:1 for Stories)
5. Editing notes (cuts, pacing, transitions)
6. CTA placement and delivery
7. Why it works (psychology explanation)

Generate a complete, production-ready creative system that covers the full funnel.`;

    let userPrompt = `Brand: ${brandName}
Campaign Type: ${strategyData.campaign_type}
Goal: ${strategyData.name}

Offer Details:
${strategyData.offer_name ? `Name: ${strategyData.offer_name}` : ''}
${strategyData.offer_url ? `URL: ${strategyData.offer_url}` : ''}
${strategyData.offer_price ? `Price: ${strategyData.offer_price}` : ''}
${strategyData.offer_description ? `Description: ${strategyData.offer_description}` : ''}

Messaging Framework:
${JSON.stringify(strategyData.messaging_framework, null, 2)}

Strategy Audience Psychology:
${JSON.stringify(strategyData.audience_psychology, null, 2)}`;

    // Add deep psychology insights if available
    if (audiencePsychology || productPsychology) {
      userPrompt += `\n\n=== DEEP PSYCHOLOGY INSIGHTS ===\n`;
      
      if (audiencePsychology) {
        userPrompt += `\nAUDIENCE PROFILE:
Demographics: ${audiencePsychology.demographics || 'Not specified'}
Psychographics: ${audiencePsychology.psychographics || 'Not specified'}
Pain Points: ${JSON.stringify(audiencePsychology.pain_points || [])}
Desires: ${JSON.stringify(audiencePsychology.desires || [])}
Objections: ${JSON.stringify(audiencePsychology.objections || [])}`;
      }
      
      if (productPsychology) {
        userPrompt += `\n\nPRODUCT POSITIONING:
${productPsychology.positioning || 'Not specified'}

Buying Triggers: ${productPsychology.buying_triggers || 'Not specified'}
Product Desires: ${JSON.stringify(productPsychology.product_desires || [])}
Product Objections: ${JSON.stringify(productPsychology.product_objections || [])}
Product Pain Points: ${JSON.stringify(productPsychology.product_pain_points || [])}`;
      }
    }

    userPrompt += `\n\n=== YOUR TASK ===

Generate a COMPLETE full-funnel creative system for this campaign:
1. Create 3-5 TOFU concepts (awareness/interest)
2. Create 2-4 MOFU concepts (consideration/trust)
3. Create 2-3 BOFU concepts (conversion/action)

Each creative concept must:
- Reference specific psychology triggers
- Include complete production instructions
- Explain why it works for this audience
- Be ready to film/produce immediately

Use the knowledge base guidelines, adapt to the niche, and create creative that will perform on Meta.

Return ONLY the JSON object with the complete creative system.`;

    console.log('Generating full-funnel creative with all knowledge bases...');

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

    console.log('Full-funnel creative generated successfully');
    console.log('TOFU concepts:', creativeData.creative_mix?.tofu?.length || 0);
    console.log('MOFU concepts:', creativeData.creative_mix?.mofu?.length || 0);
    console.log('BOFU concepts:', creativeData.creative_mix?.bofu?.length || 0);

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