import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { brand_id, campaign_metrics, ad_level_data, notes } = await req.json();
    if (!brand_id) throw new Error('brand_id required');

    // Build prompt
    const metricsStr = (campaign_metrics || []).map((m: any) =>
      `Campaign: ${m.campaign_name}\n  Spend 3d: ${m.spend_3d || 'N/A'} | 7d: ${m.spend_7d || 'N/A'}\n  CPL 3d: ${m.cpl_3d || 'N/A'} | 7d: ${m.cpl_7d || 'N/A'}\n  ROAS 3d: ${m.roas_3d || 'N/A'} | 7d: ${m.roas_7d || 'N/A'}\n  CTR 3d: ${m.ctr_3d || 'N/A'} | 7d: ${m.ctr_7d || 'N/A'}\n  Notes: ${m.notes || 'None'}`
    ).join('\n\n');

    const adsStr = (ad_level_data || []).map((a: any) =>
      `Ad: ${a.ad_name} | Spend: ${a.spend || 'N/A'} | CPL: ${a.cpl || 'N/A'} | ROAS: ${a.roas || 'N/A'} | CPP: ${a.cpp || 'N/A'} | Flag: ${a.flag}`
    ).join('\n');

    const prompt = `You are LUMI, an expert Meta ads optimization assistant. Based on the following campaign and ad metrics, generate a concise action plan summary.

CAMPAIGN METRICS:
${metricsStr || 'No campaign metrics provided.'}

AD-LEVEL DATA:
${adsStr || 'No ad data provided.'}

REVIEWER NOTES:
${notes || 'None'}

Generate:
1. Executive summary (2-3 sentences)
2. Specific actions per campaign (pause/scale/watch with reason)
3. Ad-level actions (which ads to pause, scale, or watch)
4. Budget recommendations
5. Creative refresh needs

Keep it brief, actionable, and data-driven. Use bullet points.`;

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are LUMI, an expert Meta ads strategist for agencies. Be concise and actionable.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    const result = await response.json();
    const actionPlan = result?.choices?.[0]?.message?.content || 'Unable to generate action plan.';

    return new Response(JSON.stringify({ action_plan: actionPlan }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
