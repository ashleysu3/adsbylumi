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
    const { brandName, strategyData, productPsychology, audiencePsychology, offerData, templateData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Verbal CTA mapping by campaign template type
    const VERBAL_CTA_BY_CAMPAIGN: Record<string, { phrases: string[]; scriptEnding: string; primaryAction: string }> = {
      'discovery-call': {
        phrases: ['Book your free call', 'Schedule your session', 'Apply to work with me', 'Book a call today', 'Click below to book your call', 'Let\'s hop on a quick call'],
        scriptEnding: 'Every talking head script MUST end with a verbal CTA encouraging the viewer to book a call. Examples: "Click the link below to book your free call", "Hit that button and let\'s chat", "Schedule your session today"',
        primaryAction: 'booking a discovery call or application'
      },
      'lead-magnet': {
        phrases: ['Download your free guide', 'Grab your copy', 'Get instant access', 'Download it now', 'Click to get your free [resource]', 'Get your hands on this'],
        scriptEnding: 'Every talking head script MUST end with a verbal CTA encouraging the viewer to download the free resource. Examples: "Click the link to download your free guide", "Grab your copy below", "Get instant access now"',
        primaryAction: 'downloading a free resource'
      },
      'webinar-signups': {
        phrases: ['Save your seat', 'Register now', 'Claim your spot', 'Sign up for the free training', 'Reserve your spot', 'Join us live'],
        scriptEnding: 'Every talking head script MUST end with a verbal CTA encouraging the viewer to register for the webinar. Examples: "Click below to save your seat", "Register now before spots fill up", "Reserve your spot today"',
        primaryAction: 'registering for a webinar or training'
      },
      'social-traffic': {
        phrases: ['Follow for more', 'Check out my profile', 'See more on my page', 'Follow along', 'Hit follow for more tips'],
        scriptEnding: 'Every talking head script should end with a soft CTA encouraging engagement. Examples: "Follow for more tips like this", "Check out my profile for more"',
        primaryAction: 'following or engaging with social content'
      },
      'video-views': {
        phrases: ['Watch the full video', 'See more', 'Learn more', 'Stay tuned', 'Keep watching'],
        scriptEnding: 'Scripts should encourage continued engagement. Examples: "Stay tuned for more", "Watch to the end for the best part"',
        primaryAction: 'watching more video content'
      },
      'low-ticket-sales': {
        phrases: ['Get it now', 'Buy today', 'Grab yours', 'Start now', 'Get started for just $X', 'Click to get yours'],
        scriptEnding: 'Every talking head script MUST end with a verbal CTA encouraging immediate purchase. Examples: "Click the link to get started for just $X", "Grab yours before it\'s gone", "Get instant access today"',
        primaryAction: 'making a purchase'
      },
      'high-ticket-sales': {
        phrases: ['Apply now', 'Book your call', 'Join us', 'Get started today', 'Take the next step'],
        scriptEnding: 'Every talking head script MUST end with a verbal CTA encouraging the viewer to take the next step. Examples: "Apply now to see if this is right for you", "Book your call to learn more", "Take the first step today"',
        primaryAction: 'applying or booking a sales call'
      }
    };

    // Get the verbal CTA context for this campaign type
    const templateSlug = templateData?.slug || '';
    const verbalCtaContext = VERBAL_CTA_BY_CAMPAIGN[templateSlug] || {
      phrases: ['Learn more', 'Click the link', 'Check it out', 'Take action today'],
      scriptEnding: 'Every talking head script should end with a clear verbal call-to-action that matches the campaign goal.',
      primaryAction: 'taking the desired action'
    };

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Validate required data
    if (!strategyData) {
      console.error('Missing strategyData in request');
      return new Response(
        JSON.stringify({ error: 'Strategy data is required. Please complete your campaign strategy first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!strategyData.campaign_type) {
      console.error('Missing campaign_type in strategyData:', strategyData);
      return new Response(
        JSON.stringify({ error: 'Campaign type is missing from strategy. Please select a campaign template.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      "text": "Headline text (<40 chars)",
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
      "text": "Description text (<30 chars)",
      "angle": "curiosity" etc
    }
  ],
  "ad_copy_library": {
    "headlines": [
      { "id": "h1", "text": "Headline 1 (<40 chars)", "angle": "curiosity", "stage": "tofu" },
      { "id": "h2", "text": "Headline 2", "angle": "pain", "stage": "tofu" },
      { "id": "h3", "text": "Headline 3", "angle": "proof", "stage": "mofu" },
      { "id": "h4", "text": "Headline 4", "angle": "desire", "stage": "bofu" },
      { "id": "h5", "text": "Headline 5", "angle": "urgency", "stage": "bofu" }
    ],
    "primary_copy": {
      "short": [
        { "id": "pc_s1", "stage": "tofu", "text": "Short copy variation 1 (~125 chars)", "angle": "curiosity", "length": "short" },
        { "id": "pc_s2", "stage": "mofu", "text": "Short copy variation 2", "angle": "proof", "length": "short" }
      ],
      "medium": [
        { "id": "pc_m1", "stage": "tofu", "text": "Medium copy variation 1 (~300 chars)", "angle": "pain", "length": "medium" },
        { "id": "pc_m2", "stage": "mofu", "text": "Medium copy variation 2", "angle": "clarity", "length": "medium" }
      ],
      "long": [
        { "id": "pc_l1", "stage": "bofu", "text": "Long copy variation 1 (500+ chars)", "angle": "desire", "length": "long" }
      ]
    },
    "descriptions": [
      { "id": "d1", "text": "Description 1 (<30 chars)", "stage": "tofu", "angle": "curiosity" },
      { "id": "d2", "text": "Description 2", "stage": "mofu", "angle": "proof" },
      { "id": "d3", "text": "Description 3", "stage": "bofu", "angle": "desire" },
      { "id": "d4", "text": "Description 4", "stage": "tofu", "angle": "pain" },
      { "id": "d5", "text": "Description 5", "stage": "bofu", "angle": "urgency" }
    ],
    "story_reel_copy": {
      "super_short_headlines": [
        { "id": "ssh1", "text": "Very short (<20 chars)", "for_placement": "9:16" },
        { "id": "ssh2", "text": "Super brief", "for_placement": "9:16" },
        { "id": "ssh3", "text": "Punchy short", "for_placement": "9:16" }
      ],
      "overlay_text": [
        { "id": "ot1", "lines": ["Line 1", "Line 2"], "style": "bold" },
        { "id": "ot2", "lines": ["Attention grabber", "Quick benefit"], "style": "minimal" }
      ],
      "cta_stickers": [
        { "id": "cta1", "text": "Tap to learn more" },
        { "id": "cta2", "text": "Link in bio" },
        { "id": "cta3", "text": "Swipe up" }
      ]
    }
  },
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

=== VERBAL CTA REQUIREMENTS (CRITICAL) ===

Campaign Type: ${templateData?.name || strategyData.campaign_type}
Template: ${templateSlug || 'general'}

Required Verbal CTA Phrases (use variations of these):
${verbalCtaContext.phrases.map((p: string) => `- "${p}"`).join('\n')}

${verbalCtaContext.scriptEnding}

Primary Action for This Campaign: ${verbalCtaContext.primaryAction}

RULES FOR ALL CREATIVE:
1. Every talking head script MUST end with a verbal call-to-action that matches the campaign goal
2. The final 5-10 seconds of every script should be the CTA delivery
3. Ad copy should naturally weave in the appropriate action phrase
4. CTAs should feel natural to the brand voice, not forced or generic
5. Vary the CTA wording across concepts but keep the same intent (${verbalCtaContext.primaryAction})
6. The CTA in the "cta" field of scripts MUST match these verbal CTA patterns

Generate a complete, production-ready creative system that covers the full funnel.`;

    // Extract rich offer data
    const offer = offerData || {};
    const offerPsychology = offer.product_psychology || productPsychology || {};
    const messagingGuidelines = offer.messaging_guidelines || {};

    let userPrompt = `Brand: ${brandName}
Campaign Type: ${strategyData.campaign_type}
Campaign Goal: ${strategyData.name}

=== OFFER DETAILS (CRITICAL - ALL CREATIVE MUST SELL THIS OFFER) ===
Offer Name: ${offer.name || strategyData.offer_name || 'Not specified'}
Offer URL: ${offer.url || strategyData.offer_url || 'Not specified'}
Price Point: ${offer.price_point || strategyData.offer_price || 'Not specified'}

OFFER DESCRIPTION (use this to understand what we're selling):
${offer.description || strategyData.offer_description || 'Not specified'}

TARGET OUTCOME/TRANSFORMATION (the result the customer wants):
${offer.target_outcome || 'Not specified'}

=== OFFER-SPECIFIC MESSAGING GUIDELINES ===
${messagingGuidelines.core_message ? `Core Message: ${messagingGuidelines.core_message}` : ''}
${Array.isArray(messagingGuidelines.key_benefits) && messagingGuidelines.key_benefits.length ? `Key Benefits to Highlight:\n${messagingGuidelines.key_benefits.map((b: string) => `- ${b}`).join('\n')}` : ''}
${messagingGuidelines.tone_notes ? `Tone Notes: ${messagingGuidelines.tone_notes}` : ''}
${Array.isArray(messagingGuidelines.dont_say) && messagingGuidelines.dont_say.length ? `\n⚠️ NEVER SAY (compliance/brand rules):\n${messagingGuidelines.dont_say.map((d: string) => `- "${d}"`).join('\n')}` : ''}
${Array.isArray(messagingGuidelines.always_include) && messagingGuidelines.always_include.length ? `\n✅ ALWAYS INCLUDE in messaging:\n${messagingGuidelines.always_include.map((a: string) => `- ${a}`).join('\n')}` : ''}
${messagingGuidelines.competitor_differentiation ? `\nKey Differentiation from Competitors: ${messagingGuidelines.competitor_differentiation}` : ''}
${Array.isArray(messagingGuidelines.approved_examples) && messagingGuidelines.approved_examples.length ? `\n📝 Approved Copy Examples:\n${messagingGuidelines.approved_examples.map((ex: any) => `- [${ex.type}] "${ex.text}"`).join('\n')}` : ''}

=== PRODUCT PSYCHOLOGY (use these triggers in creative) ===
${offerPsychology.positioning ? `Positioning Statement: ${offerPsychology.positioning}` : ''}
${Array.isArray(offerPsychology.pain_points) && offerPsychology.pain_points.length ? `\nPain Points to Address:\n${offerPsychology.pain_points.map((p: string) => `- ${p}`).join('\n')}` : ''}
${Array.isArray(offerPsychology.product_pain_points) && offerPsychology.product_pain_points.length ? `\nProduct-Specific Pain Points:\n${offerPsychology.product_pain_points.map((p: string) => `- ${p}`).join('\n')}` : ''}
${Array.isArray(offerPsychology.desires) && offerPsychology.desires.length ? `\nDesires to Tap Into:\n${offerPsychology.desires.map((d: string) => `- ${d}`).join('\n')}` : ''}
${Array.isArray(offerPsychology.product_desires) && offerPsychology.product_desires.length ? `\nProduct-Specific Desires:\n${offerPsychology.product_desires.map((d: string) => `- ${d}`).join('\n')}` : ''}
${Array.isArray(offerPsychology.objections) && offerPsychology.objections.length ? `\nObjections to Overcome:\n${offerPsychology.objections.map((o: string) => `- ${o}`).join('\n')}` : ''}
${Array.isArray(offerPsychology.product_objections) && offerPsychology.product_objections.length ? `\nProduct-Specific Objections:\n${offerPsychology.product_objections.map((o: string) => `- ${o}`).join('\n')}` : ''}
${Array.isArray(offerPsychology.buying_triggers) && offerPsychology.buying_triggers.length ? `\nBuying Triggers:\n${offerPsychology.buying_triggers.map((t: string) => `- ${t}`).join('\n')}` : ''}

Strategy Messaging Framework:
${JSON.stringify(strategyData.messaging_framework, null, 2)}

Strategy Audience Psychology:
${JSON.stringify(strategyData.audience_psychology, null, 2)}`;

    // Add brand-level audience psychology if available
    if (audiencePsychology) {
      userPrompt += `\n\n=== BRAND AUDIENCE PROFILE ===
Demographics: ${audiencePsychology.demographics || 'Not specified'}
Psychographics: ${audiencePsychology.psychographics || 'Not specified'}
Audience Pain Points: ${JSON.stringify(audiencePsychology.pain_points || [])}
Audience Desires: ${JSON.stringify(audiencePsychology.desires || [])}
Audience Objections: ${JSON.stringify(audiencePsychology.objections || [])}`;
    }

userPrompt += `\n\n=== YOUR TASK ===

Generate a COMPLETE full-funnel creative system for this campaign that SELLS THE OFFER.

CRITICAL REQUIREMENTS:
1. Every concept MUST directly connect to the offer's value proposition
2. Every script/copy MUST address the target outcome the customer wants
3. Use the product psychology triggers to craft compelling angles
4. STRICTLY FOLLOW the messaging guidelines (especially "don't say" and "always include")
5. Reference the hooks KB and copy_formulas KB for proven frameworks

⚠️ AD COPY LIBRARY REQUIREMENT:
Generate EXACTLY 5 variations for each copy type in the ad_copy_library:
- 5 headlines (mix of TOFU, MOFU, BOFU stages, max 40 chars each)
- 5 short primary copy (~125 chars each)
- 5 medium primary copy (~300 chars each)  
- 5 long primary copy (500+ chars each)
- 5 descriptions (max 30 chars each)
- 3 super short headlines for 9:16 Stories/Reels (max 20 chars)
- 2-3 overlay text options with 2 lines each
- 3 CTA sticker text options

⚠️ CRITICAL CTA REQUIREMENT:
This is a "${templateData?.name || strategyData.campaign_type}" campaign.
- Every talking head script MUST END with a verbal CTA like: ${verbalCtaContext.phrases.slice(0, 3).join(', ')}
- All copy should guide the viewer toward: ${verbalCtaContext.primaryAction}
- Make the CTA feel natural to the brand voice
- The "cta" field in scripts must contain the actual verbal CTA phrase the person will say

CREATE:
1. 3-5 TOFU concepts (awareness/interest) - focus on pain points and curiosity
2. 2-4 MOFU concepts (consideration/trust) - focus on proof and transformation
3. 2-3 BOFU concepts (conversion/action) - focus on the offer and urgency

Each creative concept must:
- Directly relate to selling the specific offer
- Reference specific psychology triggers from the offer's product_psychology
- Include complete production instructions
- END WITH A VERBAL CTA that matches the campaign type (${verbalCtaContext.primaryAction})
- Explain why it works for this audience and offer
- Be ready to film/produce immediately

Return ONLY the JSON object with the complete creative system.`;

    console.log('Generating creative with offer data:', offer.name || strategyData.offer_name);

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