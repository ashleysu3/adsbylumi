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

    const { brand_id } = await req.json();
    if (!brand_id) throw new Error('brand_id required');

    // Get latest review log
    const { data: review } = await supabase
      .from('review_logs')
      .select('*')
      .eq('brand_id', brand_id)
      .order('review_date', { ascending: false })
      .limit(1)
      .single();

    // Get brand info
    const { data: brand } = await supabase
      .from('brands')
      .select('name, meta_account_id')
      .eq('id', brand_id)
      .single();

    // Get campaign goals
    const { data: goals } = await supabase
      .from('campaign_goals')
      .select('*')
      .eq('brand_id', brand_id);

    const reviewData = review ? JSON.stringify(review.campaign_metrics) : 'No review data';
    const adData = review ? JSON.stringify(review.ad_level_data) : 'No ad data';
    const goalsStr = (goals || []).map((g: any) => `${g.primary_kpi_label}: ${g.primary_kpi_goal_type} ${g.primary_kpi_threshold}`).join(', ');

    const prompt = `Generate a weekly client report for ${brand?.name || 'this client'}.

LATEST REVIEW DATA:
${reviewData}

AD PERFORMANCE:
${adData}

KPI GOALS: ${goalsStr || 'Not set'}

REVIEW NOTES: ${review?.notes || 'None'}

ACTION PLAN: ${review?.action_plan || 'None'}

Generate a professional weekly report including:
1. Performance summary with emoji status indicators (✅ on track, ⚠️ watching, 🔴 needs attention)
2. Campaign-by-campaign breakdown
3. Key wins and areas for improvement
4. Actions taken this week
5. Recommendations for next week
6. Budget summary
7. A "💡 Try This" section with 3-4 specific, actionable creative ideas inspired by what's performing best this week. Look at the top-performing ads, angles, hooks, or formats and suggest new variations the user could create. Be specific — e.g. "Your testimonial-style ad is crushing it — film 2 more with different clients" or "Your carousel is getting great CTR — try a video version of the same concept." Make these feel like a creative director giving fresh ideas.

Format in clean markdown. Keep it professional but warm.`;

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are LUMI, generating professional weekly ad performance reports for agency clients.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    const result = await response.json();
    const reportText = result?.choices?.[0]?.message?.content || 'Unable to generate report.';

    return new Response(JSON.stringify({ report_text: reportText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
