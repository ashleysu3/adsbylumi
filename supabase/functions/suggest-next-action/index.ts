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
    // Create admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from JWT (already verified by Supabase since verify_jwt = true)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    console.log('Auth check:', { 
      hasUser: !!user, 
      hasError: !!userError,
      errorMessage: userError?.message,
      userId: user?.id
    });
    
    if (userError || !user) {
      console.error('Authentication failed:', userError);
      throw new Error('User not authenticated');
    }

    // Fetch brand data
    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (brandError) throw brandError;
    
    if (!brand) {
      return new Response(
        JSON.stringify({ 
          suggestion: "Let's get started! First, complete your brand profile by adding your website URL, industry, and target audience. This will help me create better campaigns for you.",
          context: { profileCompletion: 0 }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch offers (exclude archived)
    const { data: offers, error: offersError } = await supabaseAdmin
      .from('offers')
      .select('*')
      .eq('brand_id', brand.id)
      .eq('archived', false);

    if (offersError) throw offersError;

    // Fetch campaigns (exclude archived)
    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .from('campaign_workspaces')
      .select('*')
      .eq('brand_id', brand.id)
      .eq('archived', false)
      .order('updated_at', { ascending: false });

    if (campaignsError) throw campaignsError;

    // Calculate profile completion
    const profileFields = [
      brand.name,
      brand.website_url,
      brand.industry,
      brand.value_proposition,
      brand.target_audience,
      brand.meta_account_id,
    ];
    const completedFields = profileFields.filter(f => f).length;
    const profileCompletion = Math.round((completedFields / profileFields.length) * 100);
    const hasPsychology = brand.psychology_status === 'completed';
    const hasOffers = offers && offers.length > 0;

    // Build context for AI
    const context = {
      profileCompletion,
      hasPsychology,
      hasOffers,
      offerCount: offers?.length || 0,
      campaignCount: campaigns?.length || 0,
      hasMetaAccount: !!brand.meta_account_id,
      brandName: brand.name,
      latestCampaign: campaigns?.[0] ? {
        name: campaigns[0].name,
        status: campaigns[0].progress_status,
        hasCreative: !!campaigns[0].creative_json,
      } : null,
    };

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `You are an expert Meta Ads campaign advisor. Analyze the user's current progress and suggest the single most important next action they should take. Be specific, actionable, and encouraging. Keep your response to 2-3 sentences max.`;

    const userPrompt = `Current Status:
- Brand Profile: ${profileCompletion}% complete
- Audience Psychology: ${hasPsychology ? 'Generated ✓' : 'Not generated'}
- Offers/Products: ${context.offerCount} ${context.offerCount === 1 ? 'offer' : 'offers'}
- Campaigns: ${context.campaignCount} ${context.campaignCount === 1 ? 'campaign' : 'campaigns'}
- Meta Account: ${context.hasMetaAccount ? 'Connected ✓' : 'Not connected'}
${context.latestCampaign ? `
Latest Campaign:
- Name: ${context.latestCampaign.name}
- Status: ${context.latestCampaign.status}
- Has Creative: ${context.latestCampaign.hasCreative ? 'Yes' : 'No'}
` : ''}

Based on this, what should I do next?`;

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
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error('Failed to get AI suggestion');
    }

    const aiData = await aiResponse.json();
    const suggestion = aiData.choices[0].message.content;

    // Determine next action based on context
    let nextAction = null;
    
    if (profileCompletion < 100) {
      nextAction = {
        type: 'complete_profile',
        route: '/dashboard',
        buttonText: 'Complete Profile',
        targetSelector: '[data-section="brand-details"]'
      };
    } else if (!hasPsychology) {
      nextAction = {
        type: 'generate_psychology',
        route: '/dashboard',
        buttonText: 'Generate Psychology',
        targetSelector: '[data-section="audience-psychology"]'
      };
    } else if (!hasOffers) {
      nextAction = {
        type: 'add_offer',
        route: '/dashboard',
        buttonText: 'Add Offer',
        targetSelector: '[data-section="offers"]'
      };
    } else if (!context.hasMetaAccount) {
      nextAction = {
        type: 'connect_meta',
        route: '/dashboard',
        buttonText: 'Connect Meta Account',
        targetSelector: '[data-section="meta-account"]'
      };
    } else if (context.campaignCount === 0) {
      nextAction = {
        type: 'create_campaign',
        route: '/planning',
        buttonText: 'Start Planning Campaign'
      };
    } else if (context.latestCampaign && (context.latestCampaign.status === 'draft' || context.latestCampaign.status === 'creative_in_progress')) {
      nextAction = {
        type: 'continue_campaign',
        route: '/creative',
        buttonText: 'Continue Campaign'
      };
    } else if (context.latestCampaign && context.latestCampaign.status === 'waiting_for_assets') {
      nextAction = {
        type: 'production',
        route: '/production',
        buttonText: 'Go to Production'
      };
    } else if (context.latestCampaign && (context.latestCampaign.status === 'ready_to_publish' || context.latestCampaign.status === 'publishing_to_meta')) {
      nextAction = {
        type: 'build_campaign',
        route: '/campaign-builder',
        buttonText: 'Build Campaign'
      };
    } else {
      nextAction = {
        type: 'view_performance',
        route: '/data',
        buttonText: 'View Performance'
      };
    }

    return new Response(
      JSON.stringify({ 
        suggestion,
        context,
        nextAction
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in suggest-next-action:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});