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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Fetch brand data
    const { data: brand, error: brandError } = await supabaseClient
      .from('brands')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (brandError) throw brandError;

    // Fetch offers
    const { data: offers, error: offersError } = await supabaseClient
      .from('offers')
      .select('*')
      .eq('brand_id', brand.id);

    if (offersError) throw offersError;

    // Fetch campaigns
    const { data: campaigns, error: campaignsError } = await supabaseClient
      .from('campaign_workspaces')
      .select('*')
      .eq('brand_id', brand.id)
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
    const hasPsychology = brand.psychology_status === 'complete';
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

    return new Response(
      JSON.stringify({ 
        suggestion,
        context 
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