import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// URL validation helper
function validateUrl(url: string): { isValid: boolean; sanitizedUrl: string; warning?: string } {
  // Remove leading/trailing whitespace
  let sanitizedUrl = url.trim();
  
  // Check for dangerous characters
  const dangerousPatterns = [
    /javascript:/i,
    /data:/i,
    /<script/i,
    /onclick/i,
    /onerror/i,
    /\s/g, // spaces in URL
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitizedUrl)) {
      return { isValid: false, sanitizedUrl: '', warning: 'URL contains invalid characters or patterns.' };
    }
  }
  
  // Add https:// if missing protocol
  if (!sanitizedUrl.match(/^https?:\/\//i)) {
    sanitizedUrl = `https://${sanitizedUrl}`;
  }
  
  // Check if it's HTTP (not HTTPS)
  const isHttp = sanitizedUrl.toLowerCase().startsWith('http://');
  
  // Validate URL format
  try {
    const urlObj = new URL(sanitizedUrl);
    
    // Must have a valid hostname
    if (!urlObj.hostname || urlObj.hostname.length < 3) {
      return { isValid: false, sanitizedUrl: '', warning: 'Please enter a valid website URL.' };
    }
    
    // Check for valid TLD (basic check)
    const hostname = urlObj.hostname;
    if (!hostname.includes('.') || hostname.endsWith('.')) {
      return { isValid: false, sanitizedUrl: '', warning: 'URL must include a valid domain (e.g., example.com).' };
    }
    
    // Force HTTPS for security
    if (isHttp) {
      sanitizedUrl = sanitizedUrl.replace(/^http:/i, 'https:');
      return { 
        isValid: true, 
        sanitizedUrl, 
        warning: 'I upgraded your URL to HTTPS for security. Meta requires secure URLs.' 
      };
    }
    
    return { isValid: true, sanitizedUrl };
  } catch (e) {
    return { isValid: false, sanitizedUrl: '', warning: 'Please enter a valid URL (e.g., https://example.com).' };
  }
}

// Budget parsing helper
function parseBudget(message: string): { amount: number | null; warning?: string } {
  // Remove currency symbols and common text
  let cleaned = message
    .replace(/[$€£¥]/g, '')
    .replace(/per\s*day/gi, '')
    .replace(/daily/gi, '')
    .replace(/budget/gi, '')
    .replace(/,/g, '') // Remove commas (1,000 -> 1000)
    .trim();
  
  // Extract number
  const match = cleaned.match(/(\d+(?:\.\d{1,2})?)/);
  
  if (!match) {
    return { amount: null };
  }
  
  const amount = parseFloat(match[1]);
  
  // Validate budget range
  if (amount < 5) {
    return { amount: null, warning: 'Minimum daily budget is $5. Please enter a higher amount.' };
  }
  
  if (amount > 10000) {
    return { amount: null, warning: 'Maximum daily budget is $10,000. Please enter a lower amount.' };
  }
  
  // Round to nearest dollar for simplicity
  return { amount: Math.round(amount) };
}

// Date parsing helper
function parseDate(message: string): string {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  
  // Check for ISO format first
  const isoMatch = message.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    return isoMatch[0];
  }
  
  // Check for relative dates
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('today') || lowerMessage === 'today') {
    return today.toISOString().split('T')[0];
  }
  if (lowerMessage.includes('tomorrow') || lowerMessage === 'tomorrow') {
    return tomorrow.toISOString().split('T')[0];
  }
  
  // Try to parse as date
  try {
    const parsed = new Date(message);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch (e) {
    // Fall through to default
  }
  
  // Default to today if unparseable
  return today.toISOString().split('T')[0];
}

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
          // Parse budget with improved validation
          const budgetResult = parseBudget(message);
          if (budgetResult.amount) {
            currentAnswers.budget = budgetResult.amount;
            currentAnswers.budgetType = 'daily';
            responseMessage = `Perfect! I've set your daily budget at $${currentAnswers.budget}. When would you like your campaign to start?`;
            recommendations = [
              { label: "Today", value: new Date().toISOString().split('T')[0], reason: "Start immediately" },
              { label: "Tomorrow", value: new Date(Date.now() + 86400000).toISOString().split('T')[0], reason: "Give time to review" }
            ];
          } else {
            responseMessage = budgetResult.warning || "I need a budget amount. How much would you like to spend per day? (Minimum $5)";
            recommendations = [
              { label: "$15/day", value: 15, reason: "Starter" },
              { label: "$20/day", value: 20, reason: "Recommended" },
              { label: "$30/day", value: 30, reason: "Growth" }
            ];
          }
          break;

        case 'startDate':
          // Parse date with improved handling
          const parsedDate = parseDate(message);
          currentAnswers.startDate = parsedDate;
          const displayDate = new Date(parsedDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'short', 
            day: 'numeric' 
          });
          responseMessage = `Great! Starting ${displayDate}. Should your campaign run continuously or have an end date?`;
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
          // Validate URL with improved validation
          const urlResult = validateUrl(message);
          if (urlResult.isValid) {
            currentAnswers.finalUrl = urlResult.sanitizedUrl;
            if (urlResult.warning) {
              responseMessage = `⚠️ ${urlResult.warning}\n\nUsing: ${urlResult.sanitizedUrl}\n\nShould I use Advantage+ placements for maximum reach? (Recommended)`;
            } else {
              responseMessage = `Great! Should I use Advantage+ placements for maximum reach? (Recommended)`;
            }
            recommendations = [
              { label: "Enable Advantage+", value: 'Advantage+', reason: "Maximum reach" },
              { label: "Manual placements", value: 'Manual', reason: "Choose specific" }
            ];
          } else {
            responseMessage = `⚠️ ${urlResult.warning}\n\nPlease enter a valid landing page URL starting with https://`;
            recommendations = workspace.offer_url ? [
              { label: "Use workspace URL", value: workspace.offer_url, reason: "From your workspace" }
            ] : [];
          }
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
