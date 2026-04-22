import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

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

// URL reachability check helper
async function checkUrlReachability(url: string): Promise<{ isReachable: boolean; statusCode?: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      method: 'HEAD', // Use HEAD to avoid downloading full page
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AdBot/1.0; +https://youradassistant.com)',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return { isReachable: true, statusCode: response.status };
    } else if (response.status >= 400 && response.status < 500) {
      return { isReachable: false, statusCode: response.status, error: `Page returned ${response.status} error` };
    } else if (response.status >= 500) {
      return { isReachable: false, statusCode: response.status, error: `Server error (${response.status})` };
    }
    
    return { isReachable: true, statusCode: response.status };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { isReachable: false, error: 'Request timed out - page took too long to respond' };
    }
    return { isReachable: false, error: 'Could not reach the page - please verify the URL is correct' };
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
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication to prevent unauthenticated AI credit abuse
    // and cross-workspace data enumeration
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { workspaceId, message, chatHistory, answers } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch workspace data with template
    const { data: workspace, error: workspaceError } = await supabase
      .from('campaign_workspaces')
      .select(`
        *,
        brands!inner(*),
        campaign_templates(*)
      `)
      .eq('id', workspaceId)
      .single();

    if (workspaceError) throw workspaceError;

    // Verify the authenticated user owns the brand for this workspace
    if (!workspace?.brands || (workspace.brands as any).user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get template defaults if available
    const template = workspace.campaign_templates;
    const strategyTemplate = template?.strategy_template as any || {};
    const prepopFields = template?.prepopulated_fields as any || {};
    
    // Pre-populate answers from template
    const currentAnswers = answers || {};
    
    // Apply template defaults on first load (when no answers exist)
    const isFirstLoad = Object.keys(currentAnswers).length === 0;
    
    if (isFirstLoad && template) {
      // Apply prepopulated_fields from admin config
      if (prepopFields.optimizationEvent?.value) {
        currentAnswers.optimizationEvent = prepopFields.optimizationEvent.value;
      } else if (template.optimization_event) {
        // Fallback to template optimization_event
        currentAnswers.optimizationEvent = template.optimization_event === 'Purchase' ? 'PURCHASE' : 
                                            template.optimization_event === 'Lead' ? 'LEAD_GENERATION' : 
                                            template.optimization_event;
      }
      
      // Placements
      if (prepopFields.placements?.value) {
        currentAnswers.placements = prepopFields.placements.value;
      } else if (strategyTemplate.placements?.includes('Advantage+')) {
        currentAnswers.placements = 'Advantage+';
      }
      
      // Warm retargeting
      if (prepopFields.warmRetargeting?.value !== undefined) {
        currentAnswers.warmRetargeting = prepopFields.warmRetargeting.value;
      } else if (template.audience_type) {
        currentAnswers.warmRetargeting = template.audience_type.toLowerCase().includes('warm');
      }
      
      // End date
      if (prepopFields.endDate?.value !== undefined) {
        currentAnswers.endDate = prepopFields.endDate.value;
      } else if (strategyTemplate.campaign_type === 'cold' || template.audience_type?.includes('Broad')) {
        currentAnswers.endDate = null; // Continuous
      }
      
      // Meta Advantage+
      if (prepopFields.metaAdvantage?.value !== undefined) {
        currentAnswers.metaAdvantage = prepopFields.metaAdvantage.value;
      } else {
        currentAnswers.metaAdvantage = true; // Default ON
      }
      
      // Budget (if set and skipped)
      if (prepopFields.budget?.value && prepopFields.budget?.skip) {
        currentAnswers.budget = prepopFields.budget.value;
        currentAnswers.budgetType = 'daily';
      }
      
      // Final URL (if skipped, use offer URL)
      if (prepopFields.finalUrl?.skip && workspace.offer_url) {
        currentAnswers.finalUrl = workspace.offer_url;
      }
      
      // Campaign name will be auto-generated after start date is provided
      // Store template info for later name generation
    }
    
    let responseMessage = '';
    let recommendations: any[] = [];
    let stage = 'chat';

    // Question flow logic - skip questions that have template defaults with skip=true
    const getNextQuestion = () => {
      // Budget - skip if prepopulated and skip=true
      if (!currentAnswers.budget && !prepopFields.budget?.skip) return 'budget';
      if (!currentAnswers.startDate) return 'startDate';
      // End date - skip if prepopulated and skip=true  
      if (currentAnswers.endDate === undefined && !prepopFields.endDate?.skip) return 'endDate';
      // Meta Advantage - skip if prepopulated and skip=true
      if (currentAnswers.metaAdvantage === undefined && !prepopFields.metaAdvantage?.skip) return 'metaAdvantage';
      // Campaign name - skip if auto-generated from template or prepopulated
      if (!currentAnswers.campaignName && !prepopFields.campaignName?.skip) return 'campaignName';
      // Final URL - skip if prepopulated and skip=true
      if (!currentAnswers.finalUrl && !prepopFields.finalUrl?.skip) return 'finalUrl';
      // Placements - skip if prepopulated and skip=true
      if (!currentAnswers.placements && !prepopFields.placements?.skip) return 'placements';
      // Optimization event - skip if prepopulated and skip=true
      if (!currentAnswers.optimizationEvent && !prepopFields.optimizationEvent?.skip) return 'optimizationEvent';
      // Warm retargeting - skip if prepopulated and skip=true
      if (currentAnswers.warmRetargeting === undefined && !prepopFields.warmRetargeting?.skip) return 'warmRetargeting';
      // Only ask about audience selection if warm retargeting is enabled
      if (currentAnswers.warmRetargeting === true && !currentAnswers.selectedAudiences) return 'audienceSelection';
      return 'complete';
    };

    const nextQuestion = getNextQuestion();

    // Initial greeting or handle user response
    if (!message) {
      // Build template summary if available
      let templateSummary = '';
      if (template) {
        const presets: string[] = [];
        if (currentAnswers.optimizationEvent) {
          const eventName = currentAnswers.optimizationEvent === 'PURCHASE' ? 'Purchases' : 
                           currentAnswers.optimizationEvent === 'LEAD_GENERATION' ? 'Leads' : 
                           currentAnswers.optimizationEvent;
          presets.push(`Optimizing for **${eventName}**`);
        }
        if (currentAnswers.placements) presets.push(`**${currentAnswers.placements}** placements`);
        if (currentAnswers.warmRetargeting !== undefined) {
          presets.push(currentAnswers.warmRetargeting ? '**Warm retargeting** included' : '**Cold traffic** only');
        }
        if (currentAnswers.endDate === null) presets.push('Running **continuously**');
        if (currentAnswers.metaAdvantage) presets.push('**Advantage+** creative ON');
        
        if (presets.length > 0) {
          templateSummary = `\n\n📋 Based on your **${template.name}** campaign type, I've pre-configured:\n• ${presets.join('\n• ')}\n\n`;
        }
      }
      
      // Get budget suggestion from template
      let budgetSuggestion = '$20-30/day';
      if (template?.budget_suggestion) {
        budgetSuggestion = template.budget_suggestion;
      }
      
      responseMessage = `Hi! 👋 I'm excited to help you launch your Meta Ads campaign for "${workspace.offer_name || 'your offer'}."${templateSummary}Let's start with your daily budget. For this campaign type, I recommend **${budgetSuggestion}**.`;
      
      // Parse budget suggestion for recommendations
      const budgetMatch = budgetSuggestion.match(/\$(\d+)-(\d+)/);
      if (budgetMatch) {
        const low = parseInt(budgetMatch[1]);
        const high = parseInt(budgetMatch[2]);
        const mid = Math.round((low + high) / 2);
        recommendations = [
          { label: `$${low}/day`, value: low, reason: "Starter budget" },
          { label: `$${mid}/day`, value: mid, reason: "Recommended" },
          { label: `$${high}/day`, value: high, reason: "For faster results" }
        ];
      } else {
        recommendations = [
          { label: "$15/day", value: 15, reason: "Starter budget" },
          { label: "$20/day", value: 20, reason: "Most popular" },
          { label: "$30/day", value: 30, reason: "For faster results" }
        ];
      }
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
          
          // Auto-generate campaign name with date if template exists
          if (template && !currentAnswers.campaignName) {
            const audienceLabel = template.audience_type?.toLowerCase().includes('warm') ? 'Warm' : 'Cold';
            const offerName = workspace.offer_name || 'Campaign';
            const shortDate = new Date(parsedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            currentAnswers.campaignName = `${template.objective} - ${audienceLabel} - ${offerName} (${shortDate})`;
          }
          
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
            // Check if URL is reachable
            const reachabilityResult = await checkUrlReachability(urlResult.sanitizedUrl);
            
            if (reachabilityResult.isReachable) {
              currentAnswers.finalUrl = urlResult.sanitizedUrl;
              let warningText = urlResult.warning ? `⚠️ ${urlResult.warning}\n\n` : '';
              responseMessage = `${warningText}✅ URL verified and reachable! Should I use Advantage+ placements for maximum reach? (Recommended)`;
              recommendations = [
                { label: "Enable Advantage+", value: 'Advantage+', reason: "Maximum reach" },
                { label: "Manual placements", value: 'Manual', reason: "Choose specific" }
              ];
            } else {
              // URL format is valid but not reachable
              responseMessage = `⚠️ I couldn't reach your landing page: ${reachabilityResult.error}\n\nURL: ${urlResult.sanitizedUrl}\n\nPlease verify the URL is correct and the page is live. You can try again or use it anyway.`;
              recommendations = [
                { label: "Use anyway", value: urlResult.sanitizedUrl, reason: "I'll verify manually" },
                { label: "Enter different URL", value: 'retry', reason: "Try another URL" }
              ];
              // Store it anyway if they want to proceed
              if (message === urlResult.sanitizedUrl || message.toLowerCase().includes('anyway')) {
                currentAnswers.finalUrl = urlResult.sanitizedUrl;
                responseMessage = `Got it, using ${urlResult.sanitizedUrl}. Should I use Advantage+ placements for maximum reach? (Recommended)`;
                recommendations = [
                  { label: "Enable Advantage+", value: 'Advantage+', reason: "Maximum reach" },
                  { label: "Manual placements", value: 'Manual', reason: "Choose specific" }
                ];
              }
            }
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
          const wantsWarm = message === 'true' || message.toLowerCase().includes('include') || message.toLowerCase().includes('yes');
          currentAnswers.warmRetargeting = wantsWarm;
          
          if (wantsWarm) {
            // Fetch custom audiences from Meta
            try {
              const audienceResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-custom-audiences`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({ brandId: workspace.brand_id }),
              });
              
              const audienceData = await audienceResponse.json();
              
              if (audienceData.success && audienceData.audiences.length > 0) {
                // Store available audiences in answers for reference
                currentAnswers.availableAudiences = audienceData.audiences;
                
                // Create recommendations from top audiences
                const topAudiences = audienceData.audiences.slice(0, 4);
                recommendations = topAudiences.map((aud: any) => ({
                  label: aud.name.substring(0, 30) + (aud.name.length > 30 ? '...' : ''),
                  value: aud.id,
                  reason: aud.approximate_count ? `~${(aud.approximate_count / 1000).toFixed(0)}K people` : aud.subtype || 'Custom'
                }));
                
                // Add option to use all warm audiences
                if (audienceData.audiences.length > 4) {
                  recommendations.push({
                    label: "Use all warm audiences",
                    value: 'all',
                    reason: `${audienceData.audiences.length} audiences total`
                  });
                }
                
                responseMessage = `Great! I found ${audienceData.audiences.length} custom audience(s) in your Meta account. Which would you like to use for retargeting?`;
              } else {
                // No audiences found - skip audience selection
                currentAnswers.selectedAudiences = [];
                responseMessage = `I couldn't find any custom audiences in your Meta account. I'll create a warm ad set targeting engaged users based on your Page and Instagram activity.\n\n🎉 Perfect! You're all set. Ready to review your campaign and publish to Meta?`;
                recommendations = [];
                stage = 'complete';
              }
            } catch (audienceError: any) {
              console.error('Error fetching audiences:', audienceError);
              currentAnswers.selectedAudiences = [];
              responseMessage = `Couldn't fetch custom audiences (${audienceError.message}). I'll use default warm targeting.\n\n🎉 You're all set. Ready to review your campaign and publish to Meta?`;
              recommendations = [];
              stage = 'complete';
            }
          } else {
            // Cold traffic only
            responseMessage = `🎉 Perfect! You're all set. Ready to review your campaign and publish to Meta?`;
            recommendations = [];
            stage = 'complete';
          }
          break;

        case 'audienceSelection':
          // Handle audience selection
          if (message === 'all') {
            // Use all available audiences
            currentAnswers.selectedAudiences = (currentAnswers.availableAudiences || []).map((a: any) => a.id);
            responseMessage = `Great! I'll use all ${currentAnswers.selectedAudiences.length} audiences for your warm retargeting.\n\n🎉 Perfect! You're all set. Ready to review your campaign and publish to Meta?`;
          } else {
            // Parse selected audience IDs (could be single or comma-separated)
            const selectedIds = message.split(',').map((id: string) => id.trim()).filter(Boolean);
            currentAnswers.selectedAudiences = selectedIds;
            
            // Find audience names for confirmation
            const selectedNames = (currentAnswers.availableAudiences || [])
              .filter((a: any) => selectedIds.includes(a.id))
              .map((a: any) => a.name);
            
            if (selectedNames.length > 0) {
              responseMessage = `Got it! Using "${selectedNames.join('", "')}" for warm retargeting.\n\n🎉 Perfect! You're all set. Ready to review your campaign and publish to Meta?`;
            } else {
              // Fallback if we couldn't match names
              responseMessage = `Got it! I'll use your selected audience for warm retargeting.\n\n🎉 Perfect! You're all set. Ready to review your campaign and publish to Meta?`;
            }
          }
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
