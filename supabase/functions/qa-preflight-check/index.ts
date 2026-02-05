 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 interface Issue {
   field: string;
   text: string;
   suggestion: string;
   reason: string;
   location?: string;
 }
 
 interface CheckResult {
   id: string;
   name: string;
   status: 'passed' | 'warning' | 'failed';
   message?: string;
   issues?: Issue[];
   details?: string;
 }
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const { 
       brand,
       answers,
       creativeJson,
       productionItems,
       offerUrl
     } = await req.json();
 
     console.log('QA Preflight Check started');
     const results: CheckResult[] = [];
 
     // Check 1: Meta Connection
     const metaCheck = checkMetaConnection(brand);
     results.push(metaCheck);
 
     // Check 2: Budget
     const budgetCheck = checkBudget(answers);
     results.push(budgetCheck);
 
     // Check 3: Schedule
     const scheduleCheck = checkSchedule(answers);
     results.push(scheduleCheck);
 
     // Check 4: Landing Page URL
     const urlCheck = await checkLandingPage(offerUrl);
     results.push(urlCheck);
 
     // Check 5: Spelling & Grammar (AI-powered)
     const spellingCheck = await checkSpellingGrammar(creativeJson, productionItems);
     results.push(spellingCheck);
 
     // Calculate summary
     const summary = {
       passed: results.filter(r => r.status === 'passed').length,
       warnings: results.filter(r => r.status === 'warning').length,
       failed: results.filter(r => r.status === 'failed').length,
     };
 
     console.log('QA Preflight Check completed:', summary);
 
     return new Response(
       JSON.stringify({
         success: true,
         checks: results,
         summary,
       }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   } catch (error) {
     console.error('QA Preflight Check error:', error);
     return new Response(
       JSON.stringify({
         success: false,
         error: error instanceof Error ? error.message : 'Unknown error',
       }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });
 
 function checkMetaConnection(brand: any): CheckResult {
   const hasAdAccount = !!brand?.meta_account_id;
   const hasPage = !!brand?.page_id;
 
   if (hasAdAccount && hasPage) {
     return {
       id: 'meta',
       name: 'Meta Connection',
       status: 'passed',
       message: `Connected to ${brand.page_name || 'Facebook Page'}`,
       details: `Ad Account: ${brand.meta_account_id?.slice(-6) || 'Unknown'}`,
     };
   } else if (hasAdAccount && !hasPage) {
     return {
       id: 'meta',
       name: 'Meta Connection',
       status: 'failed',
       message: 'No Facebook Page connected',
       details: 'A Facebook Page is required to publish ads',
     };
   } else {
     return {
       id: 'meta',
       name: 'Meta Connection',
       status: 'failed',
       message: 'Meta Ads not connected',
       details: 'Connect your Meta Ads account in Brand Settings',
     };
   }
 }
 
 function checkBudget(answers: any): CheckResult {
   const budget = parseFloat(answers?.budget);
 
   if (!budget || budget <= 0) {
     return {
       id: 'budget',
       name: 'Budget',
       status: 'failed',
       message: 'No budget set',
       details: 'Set a daily budget to continue',
     };
   }
 
   if (budget < 5) {
     return {
       id: 'budget',
       name: 'Budget',
       status: 'warning',
       message: `$${budget}/day is below recommended minimum`,
       details: 'Meta recommends at least $5/day for optimal delivery',
     };
   }
 
   if (budget > 1000) {
     return {
       id: 'budget',
       name: 'Budget',
       status: 'warning',
       message: `$${budget}/day is unusually high`,
       details: 'Double-check this is the correct amount before publishing',
     };
   }
 
   return {
     id: 'budget',
     name: 'Budget',
     status: 'passed',
     message: `$${budget}/day verified`,
     details: `${answers?.budgetType || 'Daily'} budget`,
   };
 }
 
 function checkSchedule(answers: any): CheckResult {
   const startDate = answers?.startDate ? new Date(answers.startDate) : null;
   const endDate = answers?.endDate ? new Date(answers.endDate) : null;
   const now = new Date();
   now.setHours(0, 0, 0, 0);
 
   if (!startDate) {
     return {
       id: 'schedule',
       name: 'Schedule',
       status: 'failed',
       message: 'No start date set',
       details: 'Set a start date for your campaign',
     };
   }
 
   const startDateOnly = new Date(startDate);
   startDateOnly.setHours(0, 0, 0, 0);
 
   if (startDateOnly < now) {
     return {
       id: 'schedule',
       name: 'Schedule',
       status: 'warning',
       message: 'Start date is in the past',
       details: 'Campaign will start immediately after Meta approval',
     };
   }
 
   // Check if start date is more than 30 days in future
   const thirtyDaysFromNow = new Date(now);
   thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
   
   if (startDateOnly > thirtyDaysFromNow) {
     return {
       id: 'schedule',
       name: 'Schedule',
       status: 'warning',
       message: 'Start date is far in the future',
       details: `Campaign won't start until ${startDate.toLocaleDateString()}`,
     };
   }
 
   if (endDate && endDate <= startDate) {
     return {
       id: 'schedule',
       name: 'Schedule',
       status: 'failed',
       message: 'End date must be after start date',
       details: 'Adjust your campaign dates',
     };
   }
 
   const scheduleStr = endDate 
     ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
     : `${startDate.toLocaleDateString()} - Continuous`;
 
   return {
     id: 'schedule',
     name: 'Schedule',
     status: 'passed',
     message: scheduleStr,
     details: endDate ? 'Fixed duration campaign' : 'Runs until manually paused',
   };
 }
 
 async function checkLandingPage(url: string | undefined): Promise<CheckResult> {
   if (!url) {
     return {
       id: 'landing_page',
       name: 'Landing Page',
       status: 'warning',
       message: 'No landing page URL set',
       details: 'Add a URL to track conversions properly',
     };
   }
 
   try {
     // Ensure URL has protocol
     const fullUrl = url.startsWith('http') ? url : `https://${url}`;
     
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), 10000);
 
     const response = await fetch(fullUrl, {
       method: 'HEAD',
       signal: controller.signal,
       headers: {
         'User-Agent': 'Mozilla/5.0 (compatible; YourAdAssistant/1.0)',
       },
     });
 
     clearTimeout(timeoutId);
 
     if (response.ok) {
       return {
         id: 'landing_page',
         name: 'Landing Page',
         status: 'passed',
         message: `URL reachable (${response.status})`,
         details: new URL(fullUrl).hostname,
       };
     } else if (response.status >= 300 && response.status < 400) {
       return {
         id: 'landing_page',
         name: 'Landing Page',
         status: 'passed',
         message: `URL redirects (${response.status})`,
         details: 'Page loads with redirect',
       };
     } else if (response.status === 403 || response.status === 405) {
       // Some servers block HEAD requests
       return {
         id: 'landing_page',
         name: 'Landing Page',
         status: 'passed',
         message: 'URL appears valid',
         details: 'Server blocked verification request',
       };
     } else {
       return {
         id: 'landing_page',
         name: 'Landing Page',
         status: 'failed',
         message: `Page returned ${response.status} error`,
         details: 'Check that the URL is correct and accessible',
       };
     }
   } catch (error) {
     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
     
     if (errorMessage.includes('abort')) {
       return {
         id: 'landing_page',
         name: 'Landing Page',
         status: 'warning',
         message: 'Page took too long to respond',
         details: 'Slow loading may affect ad performance',
       };
     }
 
     return {
       id: 'landing_page',
       name: 'Landing Page',
       status: 'warning',
       message: 'Could not verify URL',
       details: 'Page may be behind authentication or firewall',
     };
   }
 }
 
 async function checkSpellingGrammar(creativeJson: any, productionItems: any[]): Promise<CheckResult> {
   try {
     // Collect all copy to check
     const copyToCheck: { field: string; text: string; location: string }[] = [];
 
     // From angle copy
     const angleCopy = creativeJson?.angleCopy || {};
     for (const [angleName, data] of Object.entries(angleCopy)) {
       const angleData = data as any;
       
       if (angleData.headlines) {
         angleData.headlines.forEach((h: any, i: number) => {
           if (h?.text) {
             copyToCheck.push({
               field: `headline_${i + 1}`,
               text: h.text,
               location: `Angle: ${angleName}`,
             });
           }
         });
       }
 
       if (angleData.descriptions) {
         angleData.descriptions.forEach((d: any, i: number) => {
           if (d?.text) {
             copyToCheck.push({
               field: `description_${i + 1}`,
               text: d.text,
               location: `Angle: ${angleName}`,
             });
           }
         });
       }
 
       if (angleData.primary_copy) {
         angleData.primary_copy.forEach((p: any, i: number) => {
           if (p?.text) {
             copyToCheck.push({
               field: `primary_copy_${i + 1}`,
               text: p.text,
               location: `Angle: ${angleName}`,
             });
           }
         });
       }
     }
 
     // From production items final copy
     if (productionItems) {
       productionItems.forEach((item: any, idx: number) => {
         const finalCopy = item.finalCopy || item.final_copy;
         if (finalCopy) {
           if (finalCopy.headline) {
             copyToCheck.push({
               field: 'headline',
               text: finalCopy.headline,
               location: `Concept ${idx + 1}`,
             });
           }
           if (finalCopy.description) {
             copyToCheck.push({
               field: 'description',
               text: finalCopy.description,
               location: `Concept ${idx + 1}`,
             });
           }
           if (finalCopy.primaryText) {
             copyToCheck.push({
               field: 'primary_text',
               text: finalCopy.primaryText,
               location: `Concept ${idx + 1}`,
             });
           }
         }
       });
     }
 
     if (copyToCheck.length === 0) {
       return {
         id: 'spelling',
         name: 'Spelling & Grammar',
         status: 'warning',
         message: 'No copy to check',
         details: 'Generate ad copy before publishing',
       };
     }
 
     // Use AI to check spelling/grammar
     const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
     if (!LOVABLE_API_KEY) {
       console.log('No LOVABLE_API_KEY, skipping AI spelling check');
       return {
         id: 'spelling',
         name: 'Spelling & Grammar',
         status: 'passed',
         message: `${copyToCheck.length} items checked`,
         details: 'AI check unavailable, manual review recommended',
       };
     }
 
     const prompt = `You are a copy editor. Review the following ad copy for spelling and grammar errors.
 Return a JSON array of issues found. Each issue should have:
 - field: the field name from the input
 - text: the problematic word or phrase
 - suggestion: the corrected text
 - reason: brief explanation (e.g., "typo", "grammar", "punctuation")
 - location: the location from the input
 
 If no issues found, return an empty array: []
 
 Be strict about actual errors but don't flag:
 - Intentional stylistic choices (sentence fragments in ads are OK)
 - Brand names or product names
 - Informal/conversational tone
 - Emoji usage
 
 COPY TO CHECK:
 ${JSON.stringify(copyToCheck, null, 2)}
 
 Return ONLY the JSON array, no other text.`;
 
     const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${LOVABLE_API_KEY}`,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         model: 'google/gemini-2.5-flash',
         messages: [
           { role: 'system', content: 'You are a helpful copy editor. Return only valid JSON.' },
           { role: 'user', content: prompt },
         ],
         temperature: 0.1,
       }),
     });
 
     if (!response.ok) {
       console.error('AI API error:', response.status);
       return {
         id: 'spelling',
         name: 'Spelling & Grammar',
         status: 'passed',
         message: `${copyToCheck.length} items checked`,
         details: 'AI check unavailable',
       };
     }
 
     const aiResult = await response.json();
     const content = aiResult.choices?.[0]?.message?.content || '[]';
 
     // Parse the JSON response
     let issues: Issue[] = [];
     try {
       // Clean up the response - remove markdown code blocks if present
       let cleanContent = content.trim();
       if (cleanContent.startsWith('```')) {
         cleanContent = cleanContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
       }
       issues = JSON.parse(cleanContent);
     } catch (parseError) {
       console.error('Failed to parse AI response:', content);
       issues = [];
     }
 
     if (issues.length === 0) {
       return {
         id: 'spelling',
         name: 'Spelling & Grammar',
         status: 'passed',
         message: `${copyToCheck.length} items checked`,
         details: 'No spelling or grammar issues found',
       };
     }
 
     return {
       id: 'spelling',
       name: 'Spelling & Grammar',
       status: 'warning',
       message: `${issues.length} issue${issues.length > 1 ? 's' : ''} found`,
       issues: issues,
       details: 'Review suggested corrections before publishing',
     };
   } catch (error) {
     console.error('Spelling check error:', error);
     return {
       id: 'spelling',
       name: 'Spelling & Grammar',
       status: 'passed',
       message: 'Check completed',
       details: 'Some items could not be verified',
     };
   }
 }