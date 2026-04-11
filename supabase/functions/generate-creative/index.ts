import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getCorsHeaders } from '../_shared/cors.ts';

// All Knowledge Base categories that must be used for creative generation
const ALL_KB_CATEGORIES = [
  // Core creative knowledge
  'ad_planner',
  'creative_department',
  'creative_best_practices',
  'creative_troubleshooting',
  
  // Psychology & audience
  'psychology',
  'buyer_psychology',
  'customer_journey',
  'audience_psychology',
  
  // Copy & hooks
  'hooks',
  'hook_library',
  'copy_formulas',
  'copywriting',
  
  // Visual & format
  'visual_guidelines',
  'format_rules',
  
  // Strategy & mapping
  'offer_mapping',
  'ad_strategy',
  'ad_strategy_best_practices',
  
  // Context & trends
  'niche',
  'niche_knowledge',
  'trends',
  'trend_knowledge',
  
  // Platform specific
  'meta_best_practices',
  'meta_guidelines'
];

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

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
    const missingFields: string[] = [];
    if (!strategyData) missingFields.push('strategyData');
    if (!productPsychology || (typeof productPsychology === 'object' && Object.keys(productPsychology).length === 0)) missingFields.push('productPsychology');
    if (!audiencePsychology || (typeof audiencePsychology === 'object' && Object.keys(audiencePsychology).length === 0)) missingFields.push('audiencePsychology');
    if (!brandName) missingFields.push('brandName');

    if (missingFields.length > 0) {
      console.error('[GENERATE-CREATIVE] Missing required fields:', missingFields);
      return new Response(
        JSON.stringify({
          error: 'Brand setup incomplete. Please finish your brand profile before generating creatives.',
          missingFields,
        }),
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

    console.log('[GENERATE-CREATIVE] Fetching ALL Knowledge Base documents...');

    // Fetch ALL relevant knowledge documents from ALL categories
    const { data: knowledgeDocs, error: kbError } = await supabase
      .from('knowledge_documents')
      .select('category, title, content')
      .eq('active', true)
      .in('category', ALL_KB_CATEGORIES);

    if (kbError) {
      console.error('[GENERATE-CREATIVE] KB fetch error:', kbError);
    }

    console.log(`[GENERATE-CREATIVE] Fetched ${knowledgeDocs?.length || 0} KB documents`);

    // Organize knowledge by category with improved structure
    const knowledgeByCategory: Record<string, string> = {};
    const kbCategoriesFound: string[] = [];
    
    if (knowledgeDocs) {
      for (const doc of knowledgeDocs) {
        if (!knowledgeByCategory[doc.category]) {
          knowledgeByCategory[doc.category] = '';
          kbCategoriesFound.push(doc.category);
        }
        knowledgeByCategory[doc.category] += `\n### ${doc.title}\n${doc.content}\n`;
      }
    }

    console.log(`[GENERATE-CREATIVE] KB Categories loaded: ${kbCategoriesFound.join(', ')}`);

    // Build comprehensive KB context sections
    const buildKBSection = (title: string, categories: string[]) => {
      const content = categories
        .map(cat => knowledgeByCategory[cat])
        .filter(Boolean)
        .join('\n');
      return content ? `\n=== ${title} ===\n${content}` : '';
    };

    const customerJourneyKB = buildKBSection('CUSTOMER JOURNEY KNOWLEDGE', ['customer_journey', 'ad_planner']);
    const psychologyKB = buildKBSection('BUYER PSYCHOLOGY KNOWLEDGE', ['psychology', 'buyer_psychology', 'audience_psychology']);
    const creativeBestPracticesKB = buildKBSection('CREATIVE BEST PRACTICES', ['creative_department', 'creative_best_practices', 'creative_troubleshooting']);
    const copyFormulasKB = buildKBSection('COPY FORMULAS & HOOKS', ['copy_formulas', 'copywriting', 'hooks', 'hook_library']);
    const visualGuidelinesKB = buildKBSection('VISUAL GUIDELINES', ['visual_guidelines', 'format_rules']);
    const offerMappingKB = buildKBSection('OFFER MAPPING', ['offer_mapping', 'ad_strategy', 'ad_strategy_best_practices']);
    const nicheKB = buildKBSection('NICHE-SPECIFIC KNOWLEDGE', ['niche', 'niche_knowledge']);
    const trendsKB = buildKBSection('TREND KNOWLEDGE', ['trends', 'trend_knowledge']);
    const metaBestPracticesKB = buildKBSection('META ADS BEST PRACTICES', ['meta_best_practices', 'meta_guidelines']);

    const systemPrompt = `You are the Creative Department for Lumi — an elite Meta Ads creative agency specialized in psychology-driven creative that guides customers through their journey.

=== LUMI'S CREATIVE PHILOSOPHY ===
Every creative concept MUST be:
1. Fully informed by ALL relevant Knowledge Bases (psychology, best practices, copy formulas, etc.)
2. Aligned with the customer journey stage (Grow/Nurture/Convert)
3. Psychologically accurate (using proven triggers for the target audience)
4. Platform-optimized for Meta Ads
5. Compliant with brand guidelines and Meta policies

=== MULTI-KB VALIDATION RULES ===
Before including ANY creative concept, validate it passes ALL these checks:
✔ Journey Stage Accuracy - Does it match the intent of Grow/Nurture/Convert?
✔ Psychological Trigger Accuracy - Does it use proven psychology for this audience?
✔ Format Suitability - Is the format appropriate for the message and platform?
✔ Offer Alignment - Does it connect directly to selling the specific offer?
✔ Niche Relevance - Does it resonate with the industry/niche patterns?
✔ Best Practices Compliance - Does it follow proven creative principles?
✔ Copy Formula Integration - Does it use structured copy frameworks?
✔ Trend Relevance (if applicable) - Is it culturally current without being gimmicky?
✔ Visual Guidelines - Does it follow platform and brand visual standards?

If ANY concept fails a check, regenerate it before including.

=== CRITICAL OUTPUT REQUIREMENTS ===

You MUST return a valid JSON object with this EXACT structure:

{
  "creative_mix": {
    "grow": [
      {
        "id": "grow_1",
        "title": "Creative concept title",
        "stage": "grow",
        "format": "talking_head" | "b_roll" | "pov_reel" | "testimonial" | "before_after" | "carousel" | "static" | "lofi" | "screen_recording",
        "content_type": "story" | "transformation" | "identity" | "emotional" | "authority" | "educational" | "objection",
        "angle": "curiosity" | "pain" | "proof" | "authority" | "clarity" | "desire" | "identity" | "urgency",
        "psychology_trigger": "specific trigger used from KB",
        "kb_references": ["psychology", "hooks", "copy_formulas"],
        "script": "Full 30s script if applicable",
        "hook": "The opening hook (first 3 seconds)",
        "overlay_text": ["Line 1", "Line 2"] if applicable,
        "broll_instructions": ["Shot 1", "Shot 2"] if applicable,
        "carousel_structure": {
          "slides": [
            {"text": "Slide 1 text", "visual": "visual description"}
          ]
        } if applicable,
        "static_layout": "Layout description for static graphics" if applicable,
        "why_it_works": "Psychology explanation referencing KB",
        "production_notes": "Filming/production guidance",
        "validation_passed": ["journey_accuracy", "psychology_accuracy", "format_suitability", "offer_alignment", "best_practices"]
      }
    ],
    "nurture": [ /* same structure */ ],
    "convert": [ /* same structure */ ]
  },
  "scripts": [
    {
      "id": "script_1",
      "stage": "grow" | "nurture" | "convert",
      "title": "Script title",
      "content": [
        { "speaker": "Host", "timing": "0-3s", "dialogue": "Hook line" },
        { "speaker": "Host", "timing": "3-20s", "dialogue": "Body content" },
        { "speaker": "Host", "timing": "20-30s", "dialogue": "CTA delivery" }
      ],
      "cta": "Call to action",
      "timing": "30s",
      "angle": "curiosity" | "pain" etc,
      "psychology_triggers": ["trigger 1", "trigger 2"]
    }
  ],
  "broll_lists": [
    {
      "id": "broll_1",
      "stage": "grow" | "nurture" | "convert",
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
      "stage": "grow" | "nurture" | "convert",
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
      "stage": "grow" | "nurture" | "convert",
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
      "stage": "grow" | "nurture" | "convert",
      "text": "Headline text (<40 chars)",
      "angle": "curiosity" etc,
      "use_case": "When to use this",
      "copy_formula": "Which formula from KB was used"
    }
  ],
  "primary_copy": {
    "short": [
      {
        "stage": "grow" | "nurture" | "convert",
        "text": "Short copy (125 chars)",
        "angle": "curiosity" etc,
        "copy_formula": "Formula used"
      }
    ],
    "medium": [ /* same structure, 300 chars */ ],
    "long": [ /* same structure, 500+ chars */ ]
  },
  "descriptions": [
    {
      "stage": "grow" | "nurture" | "convert",
      "text": "Description text (<30 chars)",
      "angle": "curiosity" etc
    }
  ],
  "ad_copy_library": {
    "headlines": [
      { "id": "h1", "text": "Headline 1 (<40 chars)", "angle": "curiosity", "stage": "grow", "copy_formula": "PAS" },
      { "id": "h2", "text": "Headline 2", "angle": "pain", "stage": "grow", "copy_formula": "4Ps" },
      { "id": "h3", "text": "Headline 3", "angle": "proof", "stage": "nurture", "copy_formula": "AIDA" },
      { "id": "h4", "text": "Headline 4", "angle": "desire", "stage": "convert", "copy_formula": "BAB" },
      { "id": "h5", "text": "Headline 5", "angle": "urgency", "stage": "convert", "copy_formula": "FAB" }
    ],
    "primary_copy": {
      "short": [
        { "id": "pc_s1", "stage": "grow", "text": "Short copy variation 1 (~125 chars)", "angle": "curiosity", "length": "short" },
        { "id": "pc_s2", "stage": "nurture", "text": "Short copy variation 2", "angle": "proof", "length": "short" }
      ],
      "medium": [
        { "id": "pc_m1", "stage": "grow", "text": "Medium copy variation 1 (~300 chars)", "angle": "pain", "length": "medium" },
        { "id": "pc_m2", "stage": "nurture", "text": "Medium copy variation 2", "angle": "clarity", "length": "medium" }
      ],
      "long": [
        { "id": "pc_l1", "stage": "convert", "text": "Long copy variation 1 (500+ chars)", "angle": "desire", "length": "long" }
      ]
    },
    "descriptions": [
      { "id": "d1", "text": "Description 1 (<30 chars)", "stage": "grow", "angle": "curiosity" },
      { "id": "d2", "text": "Description 2", "stage": "nurture", "angle": "proof" },
      { "id": "d3", "text": "Description 3", "stage": "convert", "angle": "desire" },
      { "id": "d4", "text": "Description 4", "stage": "grow", "angle": "pain" },
      { "id": "d5", "text": "Description 5", "stage": "convert", "angle": "urgency" }
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
      "stage": "grow" | "nurture" | "convert",
      "text": "CTA text",
      "type": "button_text" | "link_text",
      "urgency_level": "low" | "medium" | "high"
    }
  ],
  "production_notes": [
    {
      "stage": "grow" | "nurture" | "convert",
      "format": "talking_head" | "b_roll" etc,
      "notes": [
        "Note 1",
        "Note 2"
      ]
    }
  ],
  "kb_compliance_report": {
    "categories_applied": ["psychology", "hooks", "copy_formulas", "visual_guidelines", "meta_best_practices"],
    "validation_summary": "All concepts passed multi-KB validation"
  }
}

=== CUSTOMER JOURNEY STAGE REQUIREMENTS (from Customer Journey KB) ===

GROW (Attract new people and spark interest) - 3-5 concepts:
- Formats: Hooks, talking-head scripts, b-roll sequences, educational carousels, myth-busting carousels, static headline graphics, POV reels, lo-fi content
- Content Types: Educational, Story, Authority
- Angles: curiosity, authority, pain
- Goal: Interrupt scroll, create awareness, spark interest
- Psychology: Pattern interrupt, curiosity gap, social proof, authority

NURTURE (Build trust and deepen understanding) - 2-4 concepts:
- Formats: Story-based scripts, testimonials, teaching carousels, case study graphics, before/after content
- Content Types: Transformation, Emotional, Objection handling
- Angles: proof, clarity, desire
- Goal: Build trust, provide value, address objections
- Psychology: Reciprocity, social proof, transformation stories

CONVERT (Guide ready people to take action) - 2-3 concepts:
- Formats: Offer breakdown static, benefits carousel, CTA-focused creative, transformation story video
- Content Types: Identity, Urgency-focused
- Angles: desire, urgency, identity
- Goal: Drive action, overcome final objections, close the sale
- Psychology: Scarcity, urgency, identity shift, loss aversion

=== KNOWLEDGE BASE INTEGRATION (MANDATORY) ===
${customerJourneyKB}
${psychologyKB}
${creativeBestPracticesKB}
${copyFormulasKB}
${visualGuidelinesKB}
${offerMappingKB}
${nicheKB}
${trendsKB}
${metaBestPracticesKB}

=== KB APPLICATION RULES ===
For EVERY creative concept you generate:
1. Customer Journey KB → Determines stage placement and progression logic
2. Buyer Psychology KB → Provides specific triggers, desires, objections to address
3. Creative Best Practices KB → Ensures platform-proven performance principles
4. Copy Formula KB → Structures all written content (PAS, AIDA, 4Ps, BAB, etc.)
5. Visual Guidelines KB → Guides static/carousel/overlay design
6. Creative Troubleshooting KB → Prevents common performance issues
7. Format Rules KB → Ensures each format follows Lumi's internal standards
8. Offer Mapping KB → Adjusts creative based on offer type
9. Niche KB → Applies industry-specific patterns and language
10. Trend KB → Incorporates current trends (without overriding core strategy)
11. Meta Best Practices KB → Ensures compliance and optimization

=== PRODUCTION STANDARDS ===

Every creative must include:
1. Clear filming/production instructions
2. Specific shot requirements (framing, lighting, props)
3. Text overlay specifications
4. Ratio guidance (9:16 for Reels, 4:5 for Feed, 1:1 for Stories)
5. Editing notes (cuts, pacing, transitions)
6. CTA placement and delivery
7. Why it works (psychology explanation referencing KB)
8. Which KBs informed this concept

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

Generate a complete, production-ready creative system that covers the full funnel, informed by ALL Knowledge Bases.`;

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

=== PRODUCT PSYCHOLOGY (use these triggers in creative - from Buyer Psychology KB) ===
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
      userPrompt += `\n\n=== BRAND AUDIENCE PROFILE (from Audience Psychology KB) ===
Demographics: ${audiencePsychology.demographics || 'Not specified'}
Psychographics: ${audiencePsychology.psychographics || 'Not specified'}
Audience Pain Points: ${JSON.stringify(audiencePsychology.pain_points || [])}
Audience Desires: ${JSON.stringify(audiencePsychology.desires || [])}
Audience Objections: ${JSON.stringify(audiencePsychology.objections || [])}`;
    }

userPrompt += `\n\n=== YOUR TASK: FULL KB-DRIVEN CREATIVE GENERATION ===

Generate a COMPLETE full-funnel creative system for this campaign that SELLS THE OFFER.
EVERY concept must be informed by ALL relevant Knowledge Bases.

=== MANDATORY KB APPLICATION ===
For each creative concept, you MUST:
1. Reference Customer Journey KB to ensure correct stage placement
2. Use Buyer Psychology KB triggers specific to this audience
3. Follow Creative Best Practices KB for proven performance
4. Apply Copy Formula KB frameworks (PAS, AIDA, 4Ps, BAB, FAB, etc.)
5. Follow Visual Guidelines KB for all design direction
6. Check Creative Troubleshooting KB to avoid common issues
7. Apply Format Rules KB for each creative type
8. Use Offer Mapping KB to match creative to offer type
9. Include Niche KB patterns if applicable
10. Consider Trend KB for current hooks (without overriding strategy)
11. Ensure Meta Best Practices KB compliance

=== SCROLL-STOPPING HOOKS (FIRST 3 SECONDS - from Hooks KB) ===
The first 3 seconds determine if someone watches. Use these PROVEN patterns:

GROW HOOKS (must stop the scroll with pattern interrupt):
- "The Controversial Statement": Make a bold claim that challenges beliefs → "Nobody talks about this but..."
- "The Before/After Tease": Show transformation quickly → "I went from [pain] to [desire] in X weeks"
- "The Curiosity Gap": Create an incomplete loop → "There's one thing keeping you from [desire]..."
- "The Direct Call-Out": Name the audience directly → "If you're a [specific person] struggling with [pain]..."
- "The Contrarian Hook": Go against common advice → "Stop doing [common thing] if you want [result]"

MATCH HOOKS TO PSYCHOLOGY:
${Array.isArray(offerPsychology.pain_points) && offerPsychology.pain_points.length ? `
- Use these EXACT pain points in hooks: ${offerPsychology.pain_points.slice(0, 3).join(', ')}
- Example: "If ${offerPsychology.pain_points[0]?.toLowerCase()}, this is for you..."` : ''}
${Array.isArray(offerPsychology.desires) && offerPsychology.desires.length ? `
- Tap into these desires in the hook reveal: ${offerPsychology.desires.slice(0, 3).join(', ')}` : ''}

=== CRITICAL REQUIREMENTS ===
1. Every concept MUST directly connect to the offer's value proposition
2. Every script/copy MUST address the target outcome the customer wants
3. Use the product psychology triggers to craft compelling angles
4. STRICTLY FOLLOW the messaging guidelines (especially "don't say" and "always include")
5. Reference ALL relevant KBs for proven frameworks
6. GROW concepts need the STRONGEST hooks - they're for cold audiences
7. Include "content_type" for each concept (story, transformation, identity, emotional, authority, educational, objection)
8. Include "kb_references" listing which KBs informed each concept

⚠️ AD COPY LIBRARY REQUIREMENT:
Generate EXACTLY 5 variations for each copy type in the ad_copy_library:
- 5 headlines (mix of grow, nurture, convert stages, max 40 chars each)
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

=== CREATE (KB-VALIDATED) ===
1. 3-5 GROW concepts (awareness/interest) - STRONGEST hooks using pain points + curiosity gaps
2. 2-4 NURTURE concepts (consideration/trust) - proof, transformation stories, value-first
3. 2-3 CONVERT concepts (conversion/action) - offer breakdown, urgency, identity shift

Each creative concept must:
- Have a POWERFUL opening hook that stops the scroll in the first 3 seconds
- Directly relate to selling the specific offer
- Reference specific psychology triggers from the offer's product_psychology
- Include complete production instructions
- END WITH A VERBAL CTA that matches the campaign type (${verbalCtaContext.primaryAction})
- Explain why it works for this audience and offer (with KB references)
- Be ready to film/produce immediately
- Pass all multi-KB validation checks

Return ONLY the JSON object with the complete creative system. Use "grow", "nurture", "convert" as stage names.
Include a kb_compliance_report showing which KBs were applied.`;

    console.log('[GENERATE-CREATIVE] Generating with offer:', offer.name || strategyData.offer_name);
    console.log('[GENERATE-CREATIVE] KBs loaded:', kbCategoriesFound.length);

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
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('[GENERATE-CREATIVE] Rate limit exceeded');
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        console.error('[GENERATE-CREATIVE] AI credits depleted');
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits in Settings.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('[GENERATE-CREATIVE] AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const rawContent =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ??
      "";

    if (!rawContent) {
      console.error('[GENERATE-CREATIVE] Unexpected AI response shape:', data);
      throw new Error('AI response was empty');
    }

    // Robust JSON extraction
    const extractJson = (text: string) => {
      const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const raw = (codeBlock?.[1] ?? text).trim();
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      return JSON.parse(first !== -1 && last !== -1 ? raw.slice(first, last + 1) : raw);
    };

    const creativeData = extractJson(rawContent);

    console.log('[GENERATE-CREATIVE] Full-funnel creative generated successfully');
    console.log('[GENERATE-CREATIVE] Grow concepts:', creativeData.creative_mix?.grow?.length || 0);
    console.log('[GENERATE-CREATIVE] Nurture concepts:', creativeData.creative_mix?.nurture?.length || 0);
    console.log('[GENERATE-CREATIVE] Convert concepts:', creativeData.creative_mix?.convert?.length || 0);
    console.log('[GENERATE-CREATIVE] KB compliance:', creativeData.kb_compliance_report?.categories_applied?.join(', ') || 'Not reported');

    return new Response(JSON.stringify(creativeData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[GENERATE-CREATIVE] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate creative' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
