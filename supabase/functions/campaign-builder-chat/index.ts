import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId, message, chatHistory, answers } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch workspace data
    const { data: workspace, error: workspaceError } = await supabase
      .from('campaign_workspaces')
      .select(`
        *,
        brands!inner(*)
      `)
      .eq('id', workspaceId)
      .single();

    if (workspaceError) throw workspaceError;

    // Determine what to ask next based on collected answers
    const currentAnswers = answers || {};
    let nextQuestion = '';
    let recommendations: any[] = [];
    let stage = 'chat';

    // Question flow logic
    if (!currentAnswers.budgetType) {
      nextQuestion = 'budget';
    } else if (!currentAnswers.budget) {
      nextQuestion = 'budgetAmount';
    } else if (!currentAnswers.startDate) {
      nextQuestion = 'startDate';
    } else if (!currentAnswers.endDate) {
      nextQuestion = 'endDate';
    } else if (!currentAnswers.metaAdvantage) {
      nextQuestion = 'metaAdvantage';
    } else if (!currentAnswers.campaignName) {
      nextQuestion = 'campaignName';
    } else if (!currentAnswers.finalUrl) {
      nextQuestion = 'finalUrl';
    } else if (!currentAnswers.placements) {
      nextQuestion = 'placements';
    } else if (!currentAnswers.optimizationEvent) {
      nextQuestion = 'optimizationEvent';
    } else if (!currentAnswers.warmRetargeting) {
      nextQuestion = 'warmRetargeting';
    } else {
      stage = 'complete';
    }

    // Build AI prompt based on next question
    let systemPrompt = `You are a friendly Meta Ads campaign assistant helping users launch campaigns. 
Ask questions one at a time in a warm, consultative way. Always provide 2-3 recommended options with brief explanations.
Keep responses under 100 words. Be encouraging and supportive.

Current offer: ${workspace.offer_name}
Offer price: ${workspace.offer_price || 'Not specified'}
Template: ${workspace.template_id || 'Standard'}`;

    let userPrompt = '';
    
    if (!message) {
      // Initial greeting
      userPrompt = `Greet the user warmly and ask about their budget preference: daily or lifetime budget? 
Recommend daily budget with 3 specific amounts based on the campaign type (${workspace.template_id || 'standard'}).
For most campaigns, suggest $15-20/day (starter), $20-30/day (recommended), or $30-50/day (growth).`;
      
      recommendations = [
        { label: '$20/day (Recommended)', value: { budgetType: 'daily', budget: 20 }, reason: 'Best for most campaigns' },
        { label: '$30/day', value: { budgetType: 'daily', budget: 30 }, reason: 'More visibility' },
        { label: '$50/day', value: { budgetType: 'daily', budget: 50 }, reason: 'Aggressive growth' }
      ];
    } else {
      // Process user's answer
      let parsedAnswer: any = {};

      switch (nextQuestion) {
        case 'budget':
          // Parse budget type from message
          if (message.toLowerCase().includes('daily') || message.includes('20') || message.includes('30')) {
            parsedAnswer.budgetType = 'daily';
            const amount = message.match(/\d+/);
            if (amount) {
              parsedAnswer.budget = parseInt(amount[0]);
            }
          }
          userPrompt = `User answered: "${message}". ${parsedAnswer.budget ? 'Great choice!' : 'Ask for the specific daily budget amount.'} Provide 3 options: $20, $30, or $50.`;
          if (!parsedAnswer.budget) {
            recommendations = [
              { label: '$20/day', value: 20, reason: 'Standard' },
              { label: '$30/day', value: 30, reason: 'Recommended' },
              { label: '$50/day', value: 50, reason: 'Growth' }
            ];
          }
          break;

        case 'budgetAmount':
          const budgetAmount = message.match(/\d+/);
          if (budgetAmount) {
            parsedAnswer.budget = parseInt(budgetAmount[0]);
            userPrompt = `User set budget to $${parsedAnswer.budget}. Confirm and ask about start date. Suggest today, tomorrow, or a specific date.`;
            recommendations = [
              { label: 'Start Today', value: new Date().toISOString().split('T')[0], reason: 'Immediate launch' },
              { label: 'Start Tomorrow', value: new Date(Date.now() + 86400000).toISOString().split('T')[0], reason: 'Launch tomorrow' },
              { label: 'Custom Date', value: 'custom', reason: 'Pick a date' }
            ];
          }
          break;

        case 'startDate':
          if (message.toLowerCase().includes('today')) {
            parsedAnswer.startDate = new Date().toISOString().split('T')[0];
          } else if (message.toLowerCase().includes('tomorrow')) {
            parsedAnswer.startDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
          } else {
            const dateMatch = message.match(/\d{4}-\d{2}-\d{2}/);
            if (dateMatch) {
              parsedAnswer.startDate = dateMatch[0];
            }
          }
          if (parsedAnswer.startDate) {
            userPrompt = `User selected start date. Ask about end date or running continuously. Recommend continuous for testing.`;
            recommendations = [
              { label: 'Run Continuously', value: null, reason: 'Best for testing' },
              { label: '7 Days', value: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], reason: 'Short test' },
              { label: '30 Days', value: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0], reason: 'Full month' }
            ];
          }
          break;

        case 'endDate':
          if (message.toLowerCase().includes('continuous') || message.toLowerCase().includes('no end')) {
            parsedAnswer.endDate = null;
          } else {
            const dateMatch = message.match(/\d{4}-\d{2}-\d{2}/);
            if (dateMatch) {
              parsedAnswer.endDate = dateMatch[0];
            } else if (message.includes('7')) {
              parsedAnswer.endDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
            } else if (message.includes('30')) {
              parsedAnswer.endDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
            }
          }
          userPrompt = `User set end date. Ask about Meta Advantage+ Creative. Explain it helps Meta optimize your creative. Recommend ON.`;
          recommendations = [
            { label: 'Turn ON (Recommended)', value: true, reason: 'Better optimization' },
            { label: 'Turn OFF', value: false, reason: 'Manual control' }
          ];
          break;

        case 'metaAdvantage':
          parsedAnswer.metaAdvantage = message.toLowerCase().includes('on') || message.toLowerCase().includes('yes') || message.toLowerCase().includes('turn on');
          userPrompt = `User chose Advantage+ ${parsedAnswer.metaAdvantage ? 'ON' : 'OFF'}. Suggest a campaign name: "${workspace.offer_name} | ${workspace.template_id || 'Campaign'} | ${new Date().toLocaleDateString()}"`;
          recommendations = [
            { label: 'Use Suggested Name', value: `${workspace.offer_name} | Campaign | ${new Date().toLocaleDateString()}`, reason: 'Clear & organized' },
            { label: 'Custom Name', value: 'custom', reason: 'Your own naming' }
          ];
          break;

        case 'campaignName':
          if (message.toLowerCase().includes('suggested') || message.toLowerCase().includes('use')) {
            parsedAnswer.campaignName = `${workspace.offer_name} | Campaign | ${new Date().toLocaleDateString()}`;
          } else {
            parsedAnswer.campaignName = message;
          }
          userPrompt = `User named campaign "${parsedAnswer.campaignName}". Confirm the final landing page URL: ${workspace.offer_url || 'Need URL'}. Warn if no https://.`;
          recommendations = [
            { label: 'Confirm URL', value: workspace.offer_url, reason: 'Use offer URL' }
          ];
          break;

        case 'finalUrl':
          parsedAnswer.finalUrl = message.trim();
          if (!parsedAnswer.finalUrl.startsWith('https://')) {
            parsedAnswer.finalUrl = 'https://' + parsedAnswer.finalUrl.replace(/^http:\/\//, '');
          }
          userPrompt = `URL confirmed: ${parsedAnswer.finalUrl}. Ask about placements. Recommend Advantage+ placements for best reach.`;
          recommendations = [
            { label: 'Advantage+ (Recommended)', value: 'Advantage+', reason: 'Best reach' },
            { label: 'Manual Placements', value: 'Manual', reason: 'Specific placements' }
          ];
          break;

        case 'placements':
          parsedAnswer.placements = message.toLowerCase().includes('advantage') ? 'Advantage+' : 'Manual';
          userPrompt = `Placements set to ${parsedAnswer.placements}. Ask about optimization goal. Recommend based on offer type: Lead Generation for lead magnets, Purchases for products.`;
          recommendations = [
            { label: 'Lead Generation', value: 'LEAD_GENERATION', reason: 'For lead magnets' },
            { label: 'Purchases', value: 'PURCHASE', reason: 'For products' },
            { label: 'Link Clicks', value: 'LINK_CLICKS', reason: 'For traffic' }
          ];
          break;

        case 'optimizationEvent':
          if (message.toLowerCase().includes('lead')) {
            parsedAnswer.optimizationEvent = 'LEAD_GENERATION';
          } else if (message.toLowerCase().includes('purchase')) {
            parsedAnswer.optimizationEvent = 'PURCHASE';
          } else if (message.toLowerCase().includes('click')) {
            parsedAnswer.optimizationEvent = 'LINK_CLICKS';
          }
          userPrompt = `Optimization set to ${parsedAnswer.optimizationEvent}. Final question: Include warm audience retargeting? Recommended for low-ticket offers or call campaigns.`;
          recommendations = [
            { label: 'Yes, Include Warm Audience', value: true, reason: 'Better conversion' },
            { label: 'No, Cold Only', value: false, reason: 'Test cold first' }
          ];
          break;

        case 'warmRetargeting':
          parsedAnswer.warmRetargeting = message.toLowerCase().includes('yes') || message.toLowerCase().includes('include');
          userPrompt = `Perfect! All set. Tell user we're ready to review and publish. Be enthusiastic!`;
          stage = 'complete';
          break;
      }

      // Merge parsed answers
      Object.assign(currentAnswers, parsedAnswer);
    }

    // Call Lovable AI for natural response
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

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices[0].message.content;

    return new Response(
      JSON.stringify({
        message: aiMessage,
        recommendations,
        answers: currentAnswers,
        stage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in campaign-builder-chat:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
