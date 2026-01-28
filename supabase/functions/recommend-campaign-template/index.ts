import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getCorsHeaders } from '../_shared/cors.ts';

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

    const body = await req.json();
    const { offerId, _internalUserId } = body;
    
    // Check if this is an internal call from generate-product-psychology
    const isInternalCall = req.headers.get('x-internal-call') === 'true' && _internalUserId;
    
    let userId: string;
    
    if (isInternalCall && _internalUserId && isValidUUID(_internalUserId)) {
      // Trust the internal user ID from generate-product-psychology
      userId = _internalUserId;
      console.log('Internal call from generate-product-psychology, user:', userId);
    } else {
      // External call - authenticate normally
      const { userId: authUserId, error: authError } = await authenticateUser(req, supabase);
      if (authError || !authUserId) {
        return new Response(
          JSON.stringify({ error: authError || 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = authUserId;
    }

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

    console.log('Recommending campaign template for offer:', offerId, 'by user:', userId);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch all active campaign templates
    const { data: templates, error: templatesError } = await supabase
      .from('campaign_templates')
      .select('*')
      .eq('active', true);

    if (templatesError) throw templatesError;

    // PAGE GOAL MAPPING - These take priority over AI recommendations
    const pageGoalToTemplate: Record<string, string> = {
      'purchase': 'sell-offer', // Direct purchase → Sales campaign
      'discovery_call': 'discovery-call', // Book a call → Discovery call campaign  
      'free_resource': 'lead-magnet', // Free download → Lead magnet campaign
      'traffic_to_instagram': 'social-traffic', // Grow IG following → Traffic campaign
      'video_views': 'video-views', // Build awareness → Video views campaign
      'grow_following': 'social-traffic', // Generic social growth → Traffic campaign
    };

    // If page_goal is set and maps to a known template, use it directly
    if (offer.page_goal && pageGoalToTemplate[offer.page_goal]) {
      const targetSlug = pageGoalToTemplate[offer.page_goal];
      const matchedTemplate = templates.find(t => t.slug === targetSlug);
      
      if (matchedTemplate) {
        console.log(`Using page_goal "${offer.page_goal}" to select template: ${targetSlug}`);
        
        const reasonMap: Record<string, string> = {
          'purchase': 'This offer directs visitors to make a purchase, so a sales-focused campaign will drive conversions most effectively.',
          'discovery_call': 'This offer is designed to book discovery or sales calls, making a call-focused campaign the ideal choice for qualified lead generation.',
          'free_resource': 'This offer provides a free resource to capture leads, so a lead magnet campaign will maximize opt-ins and build your list.',
          'traffic_to_instagram': 'This campaign is designed to drive traffic to your Instagram profile, helping you grow your following and build social proof.',
          'video_views': 'This campaign focuses on getting more eyes on your video content, building awareness and trust with your audience.',
          'grow_following': 'This campaign is optimized to grow your social media following by driving qualified traffic to your profile.',
        };
        
        // Update offer with recommendation
        const { error: updateError } = await supabase
          .from('offers')
          .update({
            recommended_template_id: matchedTemplate.id,
            recommendation_reason: reasonMap[offer.page_goal] || 'Based on your page goal selection.',
            recommendation_confidence: 'high'
          })
          .eq('id', offerId);

        if (updateError) throw updateError;

        console.log('Campaign template recommendation saved (from page_goal)');

        return new Response(JSON.stringify({ 
          success: true, 
          recommendation: {
            template_id: matchedTemplate.id,
            template_name: matchedTemplate.name,
            template_slug: matchedTemplate.slug,
            confidence: 'high',
            reason: reasonMap[offer.page_goal]
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fall back to AI recommendation for 'other' or when no page_goal is set
    const systemPrompt = `You are a Meta Ads strategist expert. Analyze an offer and recommend the BEST campaign template.

MATCHING RULES:
- Free/$0-20 offers → "Lead Magnet Downloads" or "Webinar Sign Ups"
- $20-$50 offers → "Low Ticket Product Sales"
- $100+ or 'call' in outcome → "Discovery Call / Application"
- If target_outcome contains 'webinar'/'training' → "Webinar Sign Ups"
- If outcome is 'visibility'/'followers' → "Traffic to Instagram/Facebook"
- If outcome is 'trust'/'awareness' → "Video Views Campaign"

Return ONLY a valid JSON object:
{
  "recommended_template_slug": "string",
  "confidence": "high|medium|low",
  "reason": "2-3 sentence explanation focused on why this template fits this specific offer"
}`;

    const templatesInfo = templates.map(t => `
Slug: ${t.slug}
Name: ${t.name}
Objective: ${t.objective}
Audience Type: ${t.audience_type}
Use Case: ${t.use_case}
Description: ${t.description}
`).join('\n---\n');

    const productPsych = offer.product_psychology || {};
    
    const userPrompt = `Recommend the best campaign template for this offer:

OFFER DETAILS:
- Name: ${offer.name}
- Description: ${offer.description || 'Not specified'}
- Price: ${offer.price_point || 'Not specified'}
- Target Outcome: ${offer.target_outcome || 'Not specified'}
- Page Goal: ${offer.page_goal || 'Not specified'}

PRODUCT PSYCHOLOGY:
- Positioning: ${productPsych.positioning || 'Not specified'}
- Buying Triggers: ${productPsych.buying_triggers || 'Not specified'}

AVAILABLE TEMPLATES:
${templatesInfo}

Choose the BEST template based on the matching rules and return your recommendation.`;

    console.log('Calling Lovable AI for template recommendation...');
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

    const recommendation = extractJson(rawContent);

    // Find the template by slug
    const recommendedTemplate = templates.find(t => t.slug === recommendation.recommended_template_slug);
    
    if (!recommendedTemplate) {
      throw new Error(`Template with slug ${recommendation.recommended_template_slug} not found`);
    }

    // Update offer with recommendation
    const { error: updateError } = await supabase
      .from('offers')
      .update({
        recommended_template_id: recommendedTemplate.id,
        recommendation_reason: recommendation.reason,
        recommendation_confidence: recommendation.confidence
      })
      .eq('id', offerId);

    if (updateError) throw updateError;

    console.log('Campaign template recommendation saved successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      recommendation: {
        template_id: recommendedTemplate.id,
        template_name: recommendedTemplate.name,
        template_slug: recommendedTemplate.slug,
        confidence: recommendation.confidence,
        reason: recommendation.reason
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in recommend-campaign-template:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to recommend campaign template' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
