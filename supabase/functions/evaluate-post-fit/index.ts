import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * Advisory strategy-fit check for an existing organic post being promoted
 * into a live campaign. Returns ONE verdict + ONE reason + ONE fix.
 *
 * Verdicts:
 *   - good_fit:        promote as-is
 *   - worth_a_tweak:   promotable but improvable (we suggest one tweak)
 *   - off_strategy:    we recommend picking a different post
 *
 * Checks:
 *   (a) goal match — does the post drive the campaign objective
 *   (b) audience/message fit — who the post attracts vs the brand's ideal buyer
 *   (c) funnel-stage fit
 *
 * Never blocks — the user can still proceed. Advisory only.
 */

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { workspaceId, post } = await req.json();
    if (!workspaceId || !post) {
      return new Response(
        JSON.stringify({ success: false, error: 'workspaceId and post are required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load workspace + brand + offer context
    const { data: workspace } = await supabase
      .from('campaign_workspaces')
      .select('id, name, objective, offer_name, brand_id, brands!inner(id, user_id, name, audience_psychology, target_audience, value_proposition, business_model)')
      .eq('id', workspaceId)
      .maybeSingle();

    if (!workspace) {
      return new Response(
        JSON.stringify({ success: false, error: 'Workspace not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const brand = workspace.brands as any;
    if (brand.user_id !== user.id) {
      const { data: roleRow } = await supabase
        .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      if (!roleRow) {
        return new Response(
          JSON.stringify({ success: false, error: 'Access denied' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Load offer details if available
    let offer: any = null;
    if (workspace.offer_name) {
      const { data: offerRow } = await supabase
        .from('offers')
        .select('name, description, price_point, target_outcome')
        .eq('brand_id', workspace.brand_id)
        .eq('name', workspace.offer_name)
        .maybeSingle();
      offer = offerRow;
    }

    const objective = (workspace.objective || '').toLowerCase();
    const isConversionGoal = /conversion|sale|lead|purchase|signup/i.test(objective);

    const sys = `You are an ad fit reviewer using the "casting call" method: every phrase in a post attracts a specific buyer. Your job is ONE advisory verdict on whether to promote the given organic post inside the given live campaign.

You MUST return strict JSON with this shape:
{
  "verdict": "good_fit" | "worth_a_tweak" | "off_strategy",
  "headline": string,   // <= 70 chars, plain language
  "reason": string,     // ONE sentence, <= 180 chars, why this verdict
  "fix": string,        // ONE concrete tweak the user can make (or "" if good_fit)
  "checks": {
    "goal_match": "pass" | "weak" | "fail",
    "audience_fit": "pass" | "weak" | "fail",
    "funnel_stage": "pass" | "weak" | "fail"
  }
}

Rules:
- Calibrate to the offer's price/level. Beginner/cheap language is only WRONG for premium offers; for a real low-ticket/beginner offer, beginner phrasing is right.
- For conversion/lead/sales campaigns, a post with NO clear CTA or destination is "worth_a_tweak" (suggest adding a CTA + link). For awareness/traffic/engagement campaigns, that's fine.
- Judge against who the brand WANTS — don't blindly avoid all "free" or "beginner" language.
- Be specific and warm. No hype. No emojis in fields.
- Output JSON only, no prose.`;

    const audiencePsych = brand.audience_psychology ? JSON.stringify(brand.audience_psychology).slice(0, 2000) : 'not provided';
    const targetAudience = brand.target_audience || 'not provided';
    const valueProp = brand.value_proposition || 'not provided';

    const userMsg = `BRAND: ${brand.name}
BUSINESS MODEL: ${brand.business_model || 'unknown'}
TARGET AUDIENCE: ${targetAudience}
VALUE PROPOSITION: ${valueProp}
AUDIENCE PSYCHOLOGY: ${audiencePsych}

OFFER BEING PROMOTED: ${offer ? `${offer.name}${offer.price_point ? ` (${offer.price_point})` : ''}${offer.target_outcome ? ` — goal: ${offer.target_outcome}` : ''}` : workspace.offer_name || 'unspecified'}

LIVE CAMPAIGN:
- Name: ${workspace.name}
- Objective: ${workspace.objective || 'unspecified'}
- Conversion-focused: ${isConversionGoal ? 'yes' : 'no'}

POST BEING CONSIDERED:
- Platform: ${post.platform || 'instagram'}
- Media type: ${post.media_type || 'unknown'}
- Caption: ${(post.caption || '(no caption)').slice(0, 1500)}
- Engagement: ${post.like_count ?? '?'} likes, ${post.comments_count ?? '?'} comments
- Has link/CTA in caption? ${/(http|link in bio|sign up|join|register|book|buy|shop|get|download|claim|dm me|comment below)/i.test(post.caption || '') ? 'likely yes' : 'no obvious CTA'}

Return JSON only.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userMsg },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error('AI gateway error', aiRes.status, txt);
      // Graceful default — never block the user
      return new Response(
        JSON.stringify({
          success: true,
          verdict: 'worth_a_tweak',
          headline: 'We could not run the full fit check.',
          reason: 'Heads up — the fit-check service is temporarily unavailable. You can still promote this post.',
          fix: 'Double-check the caption has a clear next step (link or CTA) before going live.',
          checks: { goal_match: 'weak', audience_fit: 'weak', funnel_stage: 'weak' },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const verdict = ['good_fit', 'worth_a_tweak', 'off_strategy'].includes(parsed.verdict)
      ? parsed.verdict
      : 'worth_a_tweak';

    return new Response(
      JSON.stringify({
        success: true,
        verdict,
        headline: parsed.headline || 'Fit check ready',
        reason: parsed.reason || '',
        fix: parsed.fix || '',
        checks: parsed.checks || { goal_match: 'weak', audience_fit: 'weak', funnel_stage: 'weak' },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('evaluate-post-fit error', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 200, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    );
  }
});
