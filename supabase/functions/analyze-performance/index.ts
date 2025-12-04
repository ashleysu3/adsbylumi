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
    const { workspaceId, metricsData } = await req.json();

    if (!workspaceId || !metricsData) {
      throw new Error('Workspace ID and metrics data are required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch workspace with all context
    const { data: workspace, error: workspaceError } = await supabase
      .from('campaign_workspaces')
      .select('*, template_id')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      throw new Error('Workspace not found');
    }

    // Fetch the campaign template if available
    let template = null;
    if (workspace.template_id) {
      const { data: templateData, error: templateError } = await supabase
        .from('campaign_templates')
        .select('name, objective, purpose, kpi_priorities, journey_stages, kpi_benchmarks')
        .eq('id', workspace.template_id)
        .single();
      
      if (!templateError && templateData) {
        template = templateData;
      }
    }

    console.log('Template data:', template);

    // Fetch all knowledge documents
    const { data: knowledgeDocs, error: kbError } = await supabase
      .from('knowledge_documents')
      .select('*')
      .eq('active', true);

    if (kbError) {
      console.error('Error fetching knowledge base:', kbError);
    }

    // Organize knowledge by category
    const kbByCategory = (knowledgeDocs || []).reduce((acc: any, doc: any) => {
      if (!acc[doc.category]) acc[doc.category] = [];
      acc[doc.category].push(doc.content);
      return acc;
    }, {});

    // Build journey stages context
    const journeyStages = template?.journey_stages || ['grow', 'nurture', 'convert'];
    const journeyStagesContext = `
RELEVANT CUSTOMER JOURNEY STAGES FOR THIS CAMPAIGN:
${journeyStages.includes('grow') ? '- GROW (Awareness): Evaluate reach, impressions, CTR, CPC' : '- GROW: Not relevant for this campaign - skip evaluation'}
${journeyStages.includes('nurture') ? '- NURTURE (Engagement): Evaluate video views, engagement, warm audience building' : '- NURTURE: Not relevant for this campaign - skip evaluation'}
${journeyStages.includes('convert') ? '- CONVERT (Sales/Leads): Evaluate CPL, CPP, ROAS, conversions' : '- CONVERT: Not relevant for this campaign - skip evaluation'}

IMPORTANT: Only include journey stages marked as relevant in your journey_diagnosis output.
For stages not relevant, set the value to "Not applicable for this campaign type."
`;

    // Build KPI benchmarks context
    const kpiBenchmarks = template?.kpi_benchmarks || {};
    const benchmarksContext = Object.keys(kpiBenchmarks).length > 0 ? `
CUSTOM BENCHMARKS FOR THIS CAMPAIGN TYPE:
${Object.entries(kpiBenchmarks).map(([kpi, bench]: [string, any]) => 
  `- ${kpi.toUpperCase()}: ${bench.unit}${bench.min} - ${bench.unit}${bench.max} (healthy range)`
).join('\n')}

Use these custom benchmarks instead of default values when evaluating the KPIs above.
` : '';

    // Build campaign context section with template purpose
    const campaignTypeContext = template ? `
CAMPAIGN TYPE & PURPOSE:
- Campaign Type: ${template.name || 'Unknown'}
- Objective: ${template.objective || 'Unknown'}
${template.purpose ? `
CAMPAIGN PURPOSE (USE THIS TO GUIDE YOUR ANALYSIS):
${template.purpose}
` : ''}
${journeyStagesContext}
${benchmarksContext}
${template.kpi_priorities && template.kpi_priorities.length > 0 ? `
PRIORITY KPIs (evaluate these FIRST and weight most heavily):
${template.kpi_priorities.map((kpi: string, idx: number) => `  ${idx + 1}. ${kpi.toUpperCase()}`).join('\n')}

CRITICAL EVALUATION RULES:
- Your analysis MUST be aligned with this campaign's purpose
- Do NOT mark KPIs as "critical" or "needs_attention" if they are NOT in the priority list above
- KPIs not in the priority list MUST use status "tracking_only" or "not_applicable"
- For Traffic/Awareness campaigns (objective: OUTCOME_TRAFFIC):
  - Leads = 0 is EXPECTED and NORMAL - do NOT mention this as a problem
  - Purchases = 0 is EXPECTED and NORMAL - do NOT mention this as a problem
  - ROAS of 0/null is EXPECTED - mark as "not_applicable"
  - CPL/CPP not relevant - mark as "not_applicable"
  - DO NOT say "no leads or purchases" as a problem for these campaigns
- For Lead Gen campaigns:
  - Purchases = 0 is often expected - focus on leads instead
- NEVER mention missing leads/purchases as "critical" for non-conversion campaigns
- Focus your analysis and recommendations ONLY on the priority KPIs
` : ''}` : '';

    // Build comprehensive system prompt
    const systemPrompt = `You are the Performance Fixer, an expert Meta Ads analyst with deep knowledge of advertising psychology, funnel optimization, and creative strategy.

CONTEXT YOU HAVE ACCESS TO:
- Real campaign performance data from Meta API
- The campaign's strategy, creative mix, and offer details
- 10 comprehensive knowledge bases covering Meta ads best practices
- THE CAMPAIGN'S SPECIFIC PURPOSE AND PRIORITY KPIs

${campaignTypeContext}

YOUR KNOWLEDGE BASES:
${Object.entries(kbByCategory).map(([category, docs]: [string, any]) => 
  `\n=== ${category.toUpperCase()} ===\n${(docs as string[]).join('\n\n')}`
).join('\n')}

CAMPAIGN CONTEXT:
- Offer: ${workspace.offer_name || 'Unknown'}
- Description: ${workspace.offer_description || 'N/A'}
- Price: ${workspace.offer_price || 'N/A'}
- Strategy: ${JSON.stringify(workspace.strategy_json || {}, null, 2)}
- Creative Mix: ${JSON.stringify(workspace.creative_json || {}, null, 2)}

YOUR ROLE:
Analyze the performance data and deliver a comprehensive, beginner-friendly report that includes:

1. **KPI Evaluation**: For each metric, compare to benchmarks from your knowledge base and assign a status.
   - IMPORTANT: Only mark KPIs as "critical" or "needs attention" if they are in the campaign's priority KPI list
   - For KPIs NOT in the priority list, use status "tracking_only" or "not_applicable"
   - Explain WHY the metric matters (or doesn't matter) for THIS specific campaign type

2. **Customer Journey Diagnosis**: Identify issues at each stage:
   - GROW (Attract new people): CTR, reach, creative variety
   - NURTURE (Build trust): Click-to-conversion, landing page performance
   - CONVERT (Guide to action): Warm audience conversion, offer clarity
   - Focus on the journey stages that are RELEVANT to this campaign type

3. **Creative Troubleshooting**: Diagnose creative issues based on the data. Link low CTR to hook problems, high CPC to clarity issues, high frequency to fatigue, etc. Provide specific creative recommendations.

4. **Warm Audience Health**: Evaluate retargeting audience size and stability. Is it large enough (3k+ ideal)? Growing or stagnant?

5. **Seasonality Context**: Consider the current quarter and seasonal patterns. Explain if CPM increases or performance shifts are normal for this time of year.

6. **Offer Diagnosis**: Based on the offer type (lead magnet, webinar, low ticket, high ticket), identify mismatches between the offer and creative/landing page.

7. **Top 3 Next Steps**: Provide exactly 3 actionable, specific steps the user should take this week. Make them simple and encouraging. ONLY recommend actions related to the campaign's actual purpose and priority KPIs.

8. **Creative Refresh Suggestions**: Suggest 2-3 specific creative types to add or refresh, including hook patterns, script starters, and psychology triggers to use.

TONE & STYLE:
- Warm, encouraging, and supportive
- Use "you" language (e.g., "Your CTR is healthy!")
- No jargon - explain technical terms in plain English
- Always explain WHY behind recommendations
- Celebrate wins, gently guide improvements
- Keep it actionable and specific
- DO NOT alarm the user about metrics that are not relevant to their campaign goal
- For awareness/traffic campaigns, NEVER mention lack of leads or purchases as a problem - these campaigns are designed to build awareness, not generate conversions

OUTPUT FORMAT:
Return ONLY a valid JSON object with this exact structure:
{
  "kpi_evaluation": {
    "ctr": { "value": number, "status": string, "benchmark": string, "reason": string },
    "cpc": { "value": number, "status": string, "benchmark": string, "reason": string },
    "cpm": { "value": number, "status": string, "benchmark": string, "reason": string },
    "frequency": { "value": number, "status": string, "benchmark": string, "reason": string },
    "cpl_cpp": { "value": number, "status": string, "benchmark": string, "reason": string },
    "roas": { "value": number|null, "status": string, "benchmark": string, "reason": string }
  },
  "journey_diagnosis": {
    "grow": string,
    "nurture": string,
    "convert": string
  },
  "creative_diagnosis": {
    "problem": string,
    "cause": string,
    "recommended_creatives_to_add": [string],
    "recommended_creatives_to_refresh": [string],
    "why_it_works": string
  },
  "warm_audience_health": {
    "size": string,
    "stability": string,
    "notes": string,
    "recommendation": string
  },
  "seasonality_context": {
    "quarter": string,
    "expected_behavior": string,
    "notes": string,
    "recommendation": string
  },
  "offer_diagnosis": {
    "type": string,
    "issue": string,
    "fix": string
  },
  "next_steps": [string, string, string],
  "creative_refresh_suggestions": [
    {
      "type": string,
      "hook_pattern": string,
      "script_starter": string,
      "b_roll": string,
      "why_it_works": string
    }
  ]
}

For the "status" field, use one of: "excellent", "healthy", "needs_attention", "critical", "tracking_only", "not_applicable"
Use "tracking_only" for metrics being monitored but not the campaign's focus
Use "not_applicable" for metrics that don't apply to this campaign type (e.g., ROAS for traffic campaigns)`;

    const userPrompt = `Analyze this Meta Ads campaign performance data:

METRICS:
- Spend: $${metricsData.spend?.toFixed(2) || 0}
- Impressions: ${metricsData.impressions?.toLocaleString() || 0}
- Reach: ${metricsData.reach?.toLocaleString() || 0}
- CTR: ${metricsData.ctr?.toFixed(2) || 0}%
- CPC: $${metricsData.cpc?.toFixed(2) || 0}
- CPM: $${metricsData.cpm?.toFixed(2) || 0}
- Frequency: ${metricsData.frequency?.toFixed(2) || 0}
- Leads: ${metricsData.leads || 0}
- Purchases: ${metricsData.purchases || 0}
- Add to Cart: ${metricsData.addToCart || 0}
- Cost per Lead: $${metricsData.cpl?.toFixed(2) || 0}
- Cost per Purchase: $${metricsData.cpp?.toFixed(2) || 0}
- ROAS: ${metricsData.roas?.toFixed(2) || 'N/A'}
- Link Clicks: ${metricsData.linkClicks || 0}
- Video Views: ${metricsData.videoViews || 0}
- Video ThruPlays: ${metricsData.videoThruPlays || 0}

${template ? `REMEMBER: This is a "${template.name}" campaign with objective "${template.objective}". Focus your analysis on the campaign's purpose and priority KPIs. Do not flag irrelevant metrics as problems.` : ''}

Provide a comprehensive analysis following the JSON structure specified.`;

    console.log('Calling Lovable AI for performance analysis...');

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
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI analysis failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.choices?.[0]?.message?.content || '';

    console.log('AI analysis received:', analysisText.substring(0, 200));

    // Parse JSON from response
    let analysis;
    try {
      // Try to extract JSON if wrapped in markdown
      const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/) || 
                       analysisText.match(/```\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : analysisText;
      analysis = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Try direct parse
      try {
        analysis = JSON.parse(analysisText);
      } catch (e) {
        throw new Error('AI returned invalid JSON format');
      }
    }

    // Add timestamp and template info
    analysis.analyzed_at = new Date().toISOString();
    analysis.campaign_type = template?.name || null;
    analysis.campaign_objective = template?.objective || null;
    analysis.priority_kpis = template?.kpi_priorities || [];
    analysis.journey_stages = template?.journey_stages || ['grow', 'nurture', 'convert'];
    analysis.kpi_benchmarks = template?.kpi_benchmarks || {};

    // Save to database
    const currentReports = workspace.performance_reports || [];
    const updatedReports = [...currentReports, analysis];

    await supabase
      .from('campaign_workspaces')
      .update({
        performance_report_latest: analysis,
        performance_reports: updatedReports,
      })
      .eq('id', workspaceId);

    console.log('Analysis saved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error analyzing performance:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
