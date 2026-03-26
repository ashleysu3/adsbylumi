import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

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

    console.log(`Fetched ${kbDocs?.length || 0} KB documents for copy variations`);

    // Organize KB content by category for structured access
    // Actual categories: ad_planner, copy_formulas, creative_department, hooks, meta_best_practices, psychology, visual_guidelines
    const kbByCategory: Record<string, Array<{title: string, content: string}>> = {};
    (kbDocs || []).forEach((doc: any) => {
      if (!kbByCategory[doc.category]) kbByCategory[doc.category] = [];
      kbByCategory[doc.category].push({ title: doc.title, content: doc.content });
    });

    // Log which categories we have
    console.log('KB categories found:', Object.keys(kbByCategory));

    // Build comprehensive KB sections using actual category names
    const copyFormulasKB = kbByCategory['copy_formulas']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const psychologyKB = kbByCategory['psychology']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const hooksKB = kbByCategory['hooks']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const creativeDeptKB = kbByCategory['creative_department']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const visualKB = kbByCategory['visual_guidelines']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const adPlannerKB = kbByCategory['ad_planner']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';
    const metaBestPracticesKB = kbByCategory['meta_best_practices']?.map(d => `${d.title}:\n${d.content}`).join('\n\n') || '';

    // Build full KB context
    let kbContext = "=== LUMI'S COMPLETE KNOWLEDGE BASE ===\n\n";
    for (const [category, docs] of Object.entries(kbByCategory)) {
      kbContext += `[${(category as string).toUpperCase().replace(/_/g, ' ')}]\n`;
      docs.forEach(doc => {
        kbContext += `\n${doc.title}:\n${doc.content}\n`;
      });
      kbContext += "\n---\n";
    }

    // Extract offer-specific context from brandInfo
    const offer = brandInfo?.offer || {};
    const messagingGuidelines = offer?.messaging_guidelines || {};
    const productPsychology = offer?.product_psychology || {};

    // Helper function to safely handle array-like fields (could be string, array, or undefined)
    const toArray = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') return [val];
      return [];
    };

    const painPoints = toArray(productPsychology.pain_points);
    const desires = toArray(productPsychology.desires);
    const objections = toArray(productPsychology.objections);
    const buyingTriggers = toArray(productPsychology.buying_triggers);
    const keyBenefits = toArray(messagingGuidelines.key_benefits);
    const dontSay = toArray(messagingGuidelines.dont_say);
    const alwaysInclude = toArray(messagingGuidelines.always_include);
    const approvedExamples = toArray(messagingGuidelines.approved_examples);

    const systemPrompt = `You are a Meta Ads copywriter specializing in creating multiple high-converting variations for ${brandInfo?.name || 'this brand'}.

## LUMI'S COPY PHILOSOPHY
Every copy variation you generate MUST be informed by ALL of Lumi's Knowledge Bases. You are not a generic copywriter - you are Lumi's Copy Department, with deep expertise in Meta advertising psychology and proven copy frameworks.

## MANDATORY KB INTEGRATION FOR COPY
Every variation MUST demonstrate application of:
1. Copy Formulas KB - Use DIFFERENT frameworks (PAS, AIDA, Hook-Story-Offer, Fear-Agitation-Solution, etc.)
2. Psychology KB - Specific psychological triggers appropriate for the stage
3. Hooks KB - Proven hook patterns for first lines
4. Creative Department KB - Format-specific guidance
5. Ad Planner KB - Strategy context
6. Meta Best Practices KB - Platform compliance and performance rules

## BRAND CONTEXT
- Brand Voice: ${brandInfo?.voice || 'Not specified'}
- Target Audience: ${brandInfo?.audience || 'Not specified'}

## OFFER-SPECIFIC MESSAGING GUIDELINES
${messagingGuidelines.core_message ? `Core Message: ${messagingGuidelines.core_message}` : ''}
${keyBenefits.length ? `Key Benefits:\n${keyBenefits.map((b: string) => `- ${b}`).join('\n')}` : ''}
${messagingGuidelines.tone_notes ? `Tone Notes: ${messagingGuidelines.tone_notes}` : ''}
${dontSay.length ? `\n⚠️ NEVER USE (from offer messaging):\n${dontSay.map((d: string) => `- "${d}"`).join('\n')}` : ''}
${Array.isArray(brandInfo?.never_use_words) && brandInfo.never_use_words.length > 0 ? `\n🚫 BANNED WORDS (from brand settings — strictly forbidden):\n${brandInfo.never_use_words.map((w: string) => `- "${w}"`).join('\n')}\nDo NOT include any of these words in any generated copy. Find alternative phrasing.` : ''}
${alwaysInclude.length ? `\n✅ ALWAYS INCLUDE:\n${alwaysInclude.map((a: string) => `- ${a}`).join('\n')}` : ''}
${approvedExamples.length ? `\n📝 Approved Examples:\n${approvedExamples.map((ex: any) => typeof ex === 'object' ? `- [${ex.type}] "${ex.text}"` : `- ${ex}`).join('\n')}` : ''}

## PRODUCT PSYCHOLOGY
${productPsychology.positioning ? `Positioning: ${productPsychology.positioning}` : ''}
${painPoints.length ? `Pain Points:\n${painPoints.map((p: string) => `- ${p}`).join('\n')}` : ''}
${desires.length ? `Desires:\n${desires.map((d: string) => `- ${d}`).join('\n')}` : ''}
${objections.length ? `Objections:\n${objections.map((o: string) => `- ${o}`).join('\n')}` : ''}
${buyingTriggers.length ? `Triggers:\n${buyingTriggers.map((t: string) => `- ${t}`).join('\n')}` : ''}

${kbContext}

## MULTI-KB VALIDATION FOR COPY
Before including ANY variation, validate it passes ALL checks:

✔ FRAMEWORK DIVERSITY - Each variation uses a DIFFERENT copy framework
✔ PSYCHOLOGY ACCURACY - Trigger matches stage and audience state
✔ STAGE ALIGNMENT - Copy tone matches Grow/Nurture/Convert intent
✔ HOOK EFFECTIVENESS - Opening uses proven Hook Library patterns
✔ OFFER RELEVANCE - Copy properly represents this specific offer
✔ COMPLIANCE CHECK - No banned phrases or problematic claims
✔ CHARACTER LIMITS - Headlines ≤26 chars, Descriptions <30

If ANY check fails → regenerate before including.

## META COMPLIANCE
- No guarantees or income claims
- No personal attribute targeting
- No shocking/sensational language

## CHARACTER LIMITS
- Headline: Max 40 characters
- Primary Text: 125-200 characters recommended
- Description: Max 30 characters

## CTA HIERARCHY
LEARN_MORE is best for Grow stage (default), SIGN_UP for Nurture, SHOP_NOW for Convert

## AD COPY FORMATTING CONVENTIONS (STRICT)
- ALWAYS use digits for numbers: "7 days" not "seven days", "$997" not "$nine hundred ninety-seven", "3 clients" not "three clients"
- Keep sentences punchy and scannable — no filler words
- Double-check spelling of every word before output
- Short paragraphs only — one thought per line

Your job: Generate 3-5 distinct copy variations, each using a DIFFERENT framework from the Knowledge Base.

Each variation must:
1. Use a specific framework (PAS, AIDA, Hook-Story-Offer, Fear-Agitation-Solution, Before-After-Bridge, etc.)
2. Have a unique angle while staying true to the concept
3. Apply a DIFFERENT psychology trigger from Psychology KB
4. Use hooks from Hooks KB
5. Maintain Meta compliance
6. Be optimized for the stage (${stage.toUpperCase()})
7. STRICTLY FOLLOW the messaging guidelines (especially "don't say" and "always include")
8. Include kb_references showing which KBs informed this variation

Return JSON array with this structure:
[
  {
    "variation_name": "PAS Framework",
    "headline": "...",
    "primary_text": "...",
    "description": "...",
    "call_to_action": "LEARN_MORE",
    "framework_used": "Problem-Agitate-Solution",
    "psychology_trigger": "Specific trigger from Psychology KB",
    "hook_pattern": "Hook pattern used from Hooks KB",
    "why_this_angle": "KB-informed explanation of why this works",
    "best_for": "Audiences who already know they have a problem",
    "kb_references": ["copy_formulas", "psychology", "hooks"],
    "validation_passed": true
  },
  // ... 2-4 more variations using DIFFERENT frameworks
]

Make each variation distinctly different in approach, tone, framework, and messaging angle.`;

    const userPrompt = `Generate 3-5 copy variations for this concept:

Title: ${concept.title}
Hook: ${concept.hook || 'Not provided'}
Script/Copy: ${concept.script || concept.primary_copy || 'Not provided'}
Psychology Trigger: ${concept.psychology_trigger || 'Not provided'}
Format: ${concept.format}
Stage: ${stage.toUpperCase()}
Content Type: ${concept.content_type || 'Not specified'}

Offer Details:
- Name: ${offer.name || 'Not specified'}
- Description: ${offer.description || 'Not specified'}
- Price: ${offer.price_point || 'Not specified'}
- Target Outcome: ${offer.target_outcome || 'Not specified'}

Audience Psychology:
- Pain Points: ${painPoints.join(', ') || 'Not specified'}
- Desires: ${desires.join(', ') || 'Not specified'}
- Objections: ${objections.join(', ') || 'Not specified'}

Create variations using DIFFERENT frameworks from the Copy Formulas KB. Each must:
- Use a unique copy formula (no repeating frameworks)
- Apply different psychology triggers
- Use different hook patterns from Hooks KB
- Be uniquely angled while on-brand

Include kb_references array for each variation showing KB compliance.`;

    console.log('Calling Lovable AI for KB-informed copy variations...');

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
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment and try again.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please check your account.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI generation failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const rawContent =
      aiData?.choices?.[0]?.message?.content ??
      aiData?.choices?.[0]?.text ??
      aiData?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ??
      "";

    if (!rawContent) {
      console.error('Unexpected AI response shape:', aiData);
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

    const parsedContent = extractJson(rawContent);

    // The AI might return an object with a variations array, or just an array
    const variations = Array.isArray(parsedContent) ? parsedContent : parsedContent.variations;

    console.log(`Successfully generated ${variations.length} KB-informed copy variations`);

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