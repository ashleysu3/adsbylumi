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
    let responseMessage = '';
    let recommendations: any[] = [];
    let stage = 'chat';

    // Question flow logic
    const getNextQuestion = () => {
      if (!currentAnswers.budget) return 'budget';
      if (!currentAnswers.startDate) return 'startDate';
      if (currentAnswers.endDate === undefined) return 'endDate';
      if (currentAnswers.metaAdvantage === undefined) return 'metaAdvantage';
      if (!currentAnswers.campaignName) return 'campaignName';
      if (!currentAnswers.finalUrl) return 'finalUrl';
      if (!currentAnswers.placements) return 'placements';
      if (!currentAnswers.optimizationEvent) return 'optimizationEvent';
      if (currentAnswers.warmRetargeting === undefined) return 'warmRetargeting';
      return 'complete';
    };

    const nextQuestion = getNextQuestion();

    // Initial greeting or handle user response
    if (!message) {
      // Initial greeting
      responseMessage = `Hi! 👋 I'm excited to help you launch your Meta Ads campaign for "${workspace.offer_name || 'your offer'}." Let's start with your daily budget. Most campaigns like yours work great with $20-30/day.`;
      
      recommendations = [
        { label: "$15/day", value: 15, reason: "Starter budget" },
        { label: "$20/day", value: 20, reason: "Most popular" },
        { label: "$30/day", value: 30, reason: "For faster results" }
      ];
    } else {
      // Parse user's message and update answers
      switch (nextQuestion) {
        case 'budget':
          // Parse budget from message
          const budgetMatch = message.match(/\d+/);
          if (budgetMatch) {
            currentAnswers.budget = parseInt(budgetMatch[0]);
            currentAnswers.budgetType = 'daily';
            responseMessage = `Perfect! I've set your daily budget at $${currentAnswers.budget}. When would you like your campaign to start?`;
            recommendations = [
              { label: "Today", value: new Date().toISOString().split('T')[0], reason: "Start immediately" },
              { label: "Tomorrow", value: new Date(Date.now() + 86400000).toISOString().split('T')[0], reason: "Give time to review" }
            ];
          } else {
            responseMessage = "I need a budget amount. How much would you like to spend per day?";
            recommendations = [
              { label: "$15/day", value: 15, reason: "Starter" },
              { label: "$20/day", value: 20, reason: "Recommended" },
              { label: "$30/day", value: 30, reason: "Growth" }
            ];
          }
          break;

        case 'startDate':
          // Parse date
          if (message.match(/\d{4}-\d{2}-\d{2}/)) {
            currentAnswers.startDate = message;
          } else {
            currentAnswers.startDate = message;
          }
          responseMessage = `Great! Starting ${currentAnswers.startDate}. Should your campaign run continuously or have an end date?`;
          recommendations = [
            { label: "Run continuously", value: 'continuous', reason: "Best for testing" },
            { label: "7 days", value: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], reason: "Short test" },
            { label: "30 days", value: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0], reason: "Full month" }
          ];
          break;

        case 'endDate':
          currentAnswers.endDate = message === 'continuous' ? null : message;
          responseMessage = `Got it! Now, should I enable Meta Advantage+ Creative enhancements? I recommend turning this ON for better optimization.`;
          recommendations = [
            { label: "Enable Advantage+", value: true, reason: "Better optimization" },
            { label: "Disable", value: false, reason: "Manual control" }
          ];
          break;

        case 'metaAdvantage':
          currentAnswers.metaAdvantage = message === 'true' || message.toLowerCase().includes('enable') || message.toLowerCase().includes('yes');
          const suggestedName = `${workspace.offer_name || 'Campaign'} | ${new Date().toISOString().split('T')[0]}`;
          responseMessage = `Perfect! I'll name your campaign "${suggestedName}". Sound good?`;
          recommendations = [
            { label: "Use this name", value: suggestedName, reason: "Follows best practices" },
            { label: "Customize", value: 'custom', reason: "Enter your own" }
          ];
          break;

        case 'campaignName':
          currentAnswers.campaignName = message === 'custom' ? workspace.offer_name : message;
          responseMessage = `Excellent! Please confirm your landing page URL: ${workspace.offer_url || 'Enter your URL'}`;
          recommendations = workspace.offer_url ? [
            { label: "Use this URL", value: workspace.offer_url, reason: "From your workspace" }
          ] : [];
          break;

        case 'finalUrl':
          currentAnswers.finalUrl = message.startsWith('http') ? message : `https://${message}`;
          if (!currentAnswers.finalUrl.startsWith('https://')) {
            responseMessage = `⚠️ Your URL should include "https://" - I've added it: ${currentAnswers.finalUrl}. Proceeding with placements...`;
          } else {
            responseMessage = `Great! Should I use Advantage+ placements for maximum reach? (Recommended)`;
          }
          recommendations = [
            { label: "Enable Advantage+", value: 'Advantage+', reason: "Maximum reach" },
            { label: "Manual placements", value: 'Manual', reason: "Choose specific" }
          ];
          break;

        case 'placements':
          currentAnswers.placements = message;
          responseMessage = `Perfect! What optimization goal should I use? For ${workspace.offer_name}, I recommend "Leads".`;
          recommendations = [
            { label: "Leads", value: 'LEAD_GENERATION', reason: "For lead generation" },
            { label: "Purchases", value: 'PURCHASE', reason: "For direct sales" },
            { label: "Link Clicks", value: 'LINK_CLICKS', reason: "For traffic" }
          ];
          break;

        case 'optimizationEvent':
          currentAnswers.optimizationEvent = message;
          responseMessage = `Excellent! One last question: should I include warm audience retargeting?`;
          recommendations = [
            { label: "Include warm audience", value: true, reason: "Target engaged users" },
            { label: "Cold traffic only", value: false, reason: "New audience" }
          ];
          break;

        case 'warmRetargeting':
          currentAnswers.warmRetargeting = message === 'true' || message.toLowerCase().includes('include') || message.toLowerCase().includes('yes');
          responseMessage = `🎉 Perfect! You're all set. Ready to review your campaign and publish to Meta?`;
          recommendations = [];
          stage = 'complete';
          break;

        case 'complete':
          responseMessage = `All questions answered! Click "Review Campaign" to see your settings and publish.`;
          recommendations = [];
          stage = 'complete';
          break;
      }
    }

    console.log('Response:', { nextQuestion, stage, answersCount: Object.keys(currentAnswers).length });

    return new Response(
      JSON.stringify({
        message: responseMessage,
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
