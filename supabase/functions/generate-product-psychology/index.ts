import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requirePaidUser } from '../_shared/check-subscription.ts';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

// Authenticate user and return user ID
async function authenticateUser(req: Request, supabase: any): Promise<{ userId: string | null; error: string | null }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { userId: null, error: 'Authorization header required' };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return { userId: null, error: 'Invalid or expired token' };
  }
  
  return { userId: user.id, error: null };
}

// Build content assets context for AI prompt
function buildContentAssetsContext(contentAssets: any[] | null, offerId?: string): string {
  if (!contentAssets?.length) return "";
  
  // Filter assets relevant to this offer
  const relevantAssets = contentAssets.filter((asset: any) => {
    if (!asset.offer_ids?.length) return true; // Brand-wide assets
    return asset.offer_ids.includes(offerId); // Offer-specific assets
  });
  
  if (!relevantAssets.length) return "";
  
  let context = "\n\nREAL USER-PROVIDED CONTENT:\n";
  
  const typeLabels: Record<string, string> = {
    testimonials: "CLIENT TESTIMONIALS",
    survey_answers: "SURVEY RESPONSES",
    client_objections: "CLIENT OBJECTIONS & QUESTIONS",
    webinar_scripts: "WEBINAR/CHALLENGE SCRIPTS",
    other: "OTHER CONTENT"
  };
  
  relevantAssets.forEach((asset: any) => {
    context += `## ${typeLabels[asset.asset_type] || asset.asset_type.toUpperCase()}\n${asset.content}\n\n`;
  });
  
  context += "IMPORTANT: Use specific language, quotes, and pain points from the above content to make the psychology profile authentic.\n";
  
  return context;
}

// Generate hash of content asset IDs for tracking
function generateContentHash(contentAssets: any[] | null, offerId?: string): string | null {
  if (!contentAssets?.length) return null;
  const relevantAssets = contentAssets.filter((asset: any) => {
    if (!asset.offer_ids?.length) return true;
    return asset.offer_ids.includes(offerId);
  });
  if (!relevantAssets.length) return null;
  return relevantAssets.map(a => a.id).sort().join(',');
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Required environment variables are not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authenticate user + paywall
    const gate = await requirePaidUser(req, corsHeaders);
    if (gate.blocked) return gate.blocked;
    const userId = gate.userId!;


    const body = await req.json();
    const { offerId, brandId } = body;

    // Input validation
    if (!offerId) {
      return new Response(
        JSON.stringify({ error: 'offerId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidUUID(offerId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid offerId format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (brandId && !isValidUUID(brandId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid brandId format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch offer and verify ownership through brand
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('*, brands!inner(user_id)')
      .eq('id', offerId)
      .single();

    if (offerError || !offer) {
      return new Response(
        JSON.stringify({ error: 'Offer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ownership check - ensure the authenticated user owns this offer's brand
    if (offer.brands.user_id !== userId) {
      console.log('Ownership check failed:', { brandUserId: offer.brands.user_id, requestUserId: userId });
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating product psychology for offer:', offerId, 'by user:', userId);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Use brandId from offer if not provided
    const actualBrandId = brandId || offer.brand_id;

    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', actualBrandId)
      .single();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch content assets for this brand
    const { data: contentAssets } = await supabase
      .from('brand_content_assets')
      .select('id, asset_type, content, offer_ids')
      .eq('brand_id', actualBrandId);

    const contentAssetsContext = buildContentAssetsContext(contentAssets, offerId);
    const contentHash = generateContentHash(contentAssets, offerId);

    const systemPrompt = `You are an expert in product positioning and buyer psychology.
Your task is to create TWO related psychological profiles:

1. **PRODUCT PSYCHOLOGY** - How this product is positioned and what it specifically solves
2. **OFFER-AUDIENCE PSYCHOLOGY** - How YOUR specific audience relates to THIS specific offer

Analyze the offer details and the brand's audience psychology to generate:

### PRODUCT PSYCHOLOGY (how this product is positioned):
- positioning: How this specific product fits the audience's needs
- product_pain_points: Problems this exact product solves (array of 4-6 items)
- product_desires: Outcomes this exact product delivers (array of 4-6 items)
- product_objections: Specific hesitations about THIS product (array of 4-6 items)
- buying_triggers: What would make them buy THIS product specifically

### OFFER-AUDIENCE PSYCHOLOGY (how the ideal client relates to THIS specific offer):
- why_they_need_this: Why someone with their psychology needs THIS specific offer (not just any solution)
- moment_they_realize: The specific moment/scenario when they realize they need this (paint a vivid picture)
- specific_hesitations: Array of 3-5 objections specific to THIS offer/price point
- what_finally_convinces: What makes them say yes to THIS specific offer
- alternative_they_tried: What they've tried before that didn't work (and why this is different)
- emotional_before_after: Object with "before" and "after" states specific to this offer
${contentAssetsContext}

Return ONLY a valid JSON object with this structure:
{
  "product_psychology": {
    "positioning": "string",
    "product_pain_points": ["string"],
    "product_desires": ["string"],
    "product_objections": ["string"],
    "buying_triggers": "string"
  },
  "offer_audience_psychology": {
    "why_they_need_this": "string",
    "moment_they_realize": "string",
    "specific_hesitations": ["string"],
    "what_finally_convinces": "string",
    "alternative_they_tried": "string",
    "emotional_before_after": {
      "before": "string",
      "after": "string"
    }
  }
}

Be specific to this exact product and price point. Consider how it fits the broader audience psychology.`;

    const audiencePsych = brand.audience_psychology || {};
    
    const userPrompt = `Create a product-specific psychological profile:

OFFER DETAILS:
- Name: ${offer.name}
- Description: ${offer.description || 'Not specified'}
- Price: ${offer.price_point || 'Not specified'}
- Target Outcome: ${offer.target_outcome || 'Not specified'}

AUDIENCE PSYCHOLOGY:
- General Pain Points: ${JSON.stringify(audiencePsych.pain_points || [])}
- General Desires: ${JSON.stringify(audiencePsych.desires || [])}
- General Objections: ${JSON.stringify(audiencePsych.objections || [])}
- Demographics: ${audiencePsych.demographics || 'Not specified'}
- Psychographics: ${audiencePsych.psychographics || 'Not specified'}
- Motivations: ${audiencePsych.motivations || 'Not specified'}

Generate both product psychology AND offer-audience psychology profiles.`;

    console.log('Calling Lovable AI for product psychology...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API Error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
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

    const parsedResponse = extractJson(rawContent);
    
    // Handle both old format (flat) and new format (nested)
    const productPsychology = parsedResponse.product_psychology || parsedResponse;
    const offerAudiencePsychology = parsedResponse.offer_audience_psychology || null;

    // Update offer with both product psychology and offer-audience psychology
    const { error: updateError } = await supabase
      .from('offers')
      .update({ 
        product_psychology: productPsychology,
        offer_audience_psychology: offerAudiencePsychology,
        psychology_content_hash: contentHash
      })
      .eq('id', offerId);

    if (updateError) throw updateError;

    console.log('Product and offer-audience psychology generated and saved successfully');

    // Trigger campaign template recommendation (internal call with service role)
    console.log('Triggering campaign template recommendation...');
    try {
      const recommendResponse = await fetch(`${SUPABASE_URL}/functions/v1/recommend-campaign-template`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'x-internal-call': 'true', // Mark as internal call
        },
        body: JSON.stringify({ offerId, _internalUserId: userId }),
      });

      if (!recommendResponse.ok) {
        console.error('Failed to get campaign recommendation:', await recommendResponse.text());
      } else {
        const recommendData = await recommendResponse.json();
        console.log('Campaign recommendation received:', recommendData);
      }
    } catch (recError) {
      console.error('Error calling recommend-campaign-template:', recError);
      // Don't fail the main request if recommendation fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      productPsychology,
      offerAudiencePsychology 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in generate-product-psychology:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate product psychology' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
