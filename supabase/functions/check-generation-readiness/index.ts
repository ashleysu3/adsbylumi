import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, brandId, offerId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const questions: Array<{
      id: string;
      question: string;
      context: string;
      field: string;
      table: string;
      recordId: string;
      inputType: 'text' | 'textarea' | 'select';
      options?: string[];
      priority: 'critical' | 'important' | 'helpful';
    }> = [];

    // Fetch workspace data
    let workspace = null;
    if (workspaceId) {
      const { data } = await supabase
        .from('campaign_workspaces')
        .select('*, brands(*)')
        .eq('id', workspaceId)
        .single();
      workspace = data;
    }

    // Fetch brand data
    let brand = null;
    const effectiveBrandId = brandId || workspace?.brand_id;
    if (effectiveBrandId) {
      const { data } = await supabase
        .from('brands')
        .select('*')
        .eq('id', effectiveBrandId)
        .single();
      brand = data;
    }

    // Fetch offer data if available
    let offer = null;
    if (offerId) {
      const { data } = await supabase
        .from('offers')
        .select('*')
        .eq('id', offerId)
        .single();
      offer = data;
    } else if (workspace?.offer_name) {
      // Try to find offer by name for this brand
      const { data } = await supabase
        .from('offers')
        .select('*')
        .eq('brand_id', effectiveBrandId)
        .eq('name', workspace.offer_name)
        .single();
      offer = data;
    }

    // Check brand completeness
    if (brand) {
      if (!brand.brand_voice || brand.brand_voice.trim().length < 20) {
        questions.push({
          id: 'brand_voice',
          question: "How would you describe your brand's voice and tone?",
          context: "This helps me write copy that sounds authentically like you. Are you conversational? Professional? Playful? Direct?",
          field: 'brand_voice',
          table: 'brands',
          recordId: brand.id,
          inputType: 'textarea',
          priority: 'critical'
        });
      }

      if (!brand.value_proposition || brand.value_proposition.trim().length < 20) {
        questions.push({
          id: 'value_proposition',
          question: "What's your unique value proposition?",
          context: "What makes you different from others in your space? Why should someone choose you?",
          field: 'value_proposition',
          table: 'brands',
          recordId: brand.id,
          inputType: 'textarea',
          priority: 'critical'
        });
      }

      if (!brand.audience_psychology || Object.keys(brand.audience_psychology).length === 0) {
        questions.push({
          id: 'audience_psychology',
          question: "Tell me about your ideal client's biggest struggles and desires",
          context: "Understanding their psychology helps me create messaging that resonates deeply. What keeps them up at night? What do they dream about achieving?",
          field: 'audience_psychology_input',
          table: 'brands',
          recordId: brand.id,
          inputType: 'textarea',
          priority: 'important'
        });
      }
    }

    // Check offer completeness
    if (offer) {
      if (!offer.description || offer.description.trim().length < 30) {
        questions.push({
          id: 'offer_description',
          question: `What exactly is "${offer.name}" and what does someone get?`,
          context: "Help me understand the full picture - what's included, how it's delivered, and what transformation it provides.",
          field: 'description',
          table: 'offers',
          recordId: offer.id,
          inputType: 'textarea',
          priority: 'critical'
        });
      }

      if (!offer.target_outcome || offer.target_outcome.trim().length < 20) {
        questions.push({
          id: 'offer_outcome',
          question: `What specific result will someone achieve with "${offer.name}"?`,
          context: "The more specific the outcome, the more compelling the ads. Think: timeframe, measurable results, transformation.",
          field: 'target_outcome',
          table: 'offers',
          recordId: offer.id,
          inputType: 'textarea',
          priority: 'important'
        });
      }

      if (!offer.product_psychology || Object.keys(offer.product_psychology).length === 0) {
        questions.push({
          id: 'product_psychology',
          question: `What objections do people have before buying "${offer.name}"?`,
          context: "Common objections, hesitations, or 'yeah buts' that come up. This helps me address them in the ads.",
          field: 'product_psychology_objections',
          table: 'offers',
          recordId: offer.id,
          inputType: 'textarea',
          priority: 'important'
        });
      }

      // Check messaging guidelines
      const guidelines = offer.messaging_guidelines || {};
      if (!guidelines.core_message || guidelines.core_message.trim().length < 10) {
        questions.push({
          id: 'core_message',
          question: `If you could only say ONE thing about "${offer.name}", what would it be?`,
          context: "This is your core message - the single most important thing you want people to know.",
          field: 'messaging_guidelines.core_message',
          table: 'offers',
          recordId: offer.id,
          inputType: 'textarea',
          priority: 'helpful'
        });
      }

      if (!guidelines.dont_say || guidelines.dont_say.length === 0) {
        questions.push({
          id: 'dont_say',
          question: "Are there any words or phrases you want me to AVOID in your ads?",
          context: "Things that don't fit your brand, or claims you don't want to make. Separate each with a comma.",
          field: 'messaging_guidelines.dont_say',
          table: 'offers',
          recordId: offer.id,
          inputType: 'textarea',
          priority: 'helpful'
        });
      }
    } else if (workspace?.offer_name) {
      // No offer record found but workspace has offer name
      questions.push({
        id: 'offer_details',
        question: `Tell me more about "${workspace.offer_name}"`,
        context: "I don't have much information about this offer. What is it, who is it for, and what results does it deliver?",
        field: 'offer_description',
        table: 'campaign_workspaces',
        recordId: workspaceId,
        inputType: 'textarea',
        priority: 'critical'
      });
    }

    // Check workspace/strategy completeness
    if (workspace) {
      const strategy = workspace.strategy_json || {};
      
      if (!strategy.messaging_framework && !strategy.key_messages) {
        questions.push({
          id: 'key_messages',
          question: "What are the 2-3 key messages you want this campaign to communicate?",
          context: "These are the main points you want your audience to remember from seeing your ads.",
          field: 'strategy_json.key_messages',
          table: 'campaign_workspaces',
          recordId: workspaceId,
          inputType: 'textarea',
          priority: 'helpful'
        });
      }
    }

    // Sort by priority
    const priorityOrder = { critical: 0, important: 1, helpful: 2 };
    questions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Only return critical/important questions, limit to 3 max
    const criticalQuestions = questions.filter(q => q.priority !== 'helpful').slice(0, 3);
    
    const ready = criticalQuestions.length === 0;

    console.log('Generation readiness check:', {
      workspaceId,
      brandId: effectiveBrandId,
      offerId: offer?.id,
      ready,
      questionCount: criticalQuestions.length
    });

    return new Response(JSON.stringify({
      ready,
      questions: criticalQuestions,
      allQuestions: questions // Include all for optional display
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error checking generation readiness:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      ready: true, // Default to ready on error to not block
      questions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
