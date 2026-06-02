import { getCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Pull signals so suggestions feel grounded
    const [recentChangelog, recentStrategies, recentCampaigns, recentBugs, featuresRows] = await Promise.all([
      admin.from('changelog_entries').select('title,category,created_at').order('created_at', { ascending: false }).limit(15),
      admin.from('strategies').select('id,created_at').gt('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString()),
      admin.from('campaign_workspaces').select('id,created_at').gt('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString()),
      admin.from('bug_reports').select('title,status,created_at').order('created_at', { ascending: false }).limit(10),
      admin.from('lumi_features').select('name, area, short_description, why_helpful, ideal_audience, highlight, marketing_angles').eq('is_active', true).order('sort_order', { ascending: true }),
    ]);

    const signals = {
      already_logged: (recentChangelog.data || []).map((c: any) => c.title),
      strategies_30d: recentStrategies.data?.length || 0,
      campaigns_30d: recentCampaigns.data?.length || 0,
      recent_bug_titles: (recentBugs.data || []).map((b: any) => b.title),
    };

    const featuresText = (featuresRows.data || []).map((f: any) => {
      const lines = [`- ${f.name}${f.area ? ` (${f.area})` : ""}${f.highlight ? " ★ HIGHLIGHT" : ""} — ${f.short_description || ""}`];
      if (f.why_helpful) lines.push(`    why it helps: ${f.why_helpful}`);
      if (f.ideal_audience) lines.push(`    ideal for: ${f.ideal_audience}`);
      if (Array.isArray(f.marketing_angles) && f.marketing_angles.length) lines.push(`    angles: ${f.marketing_angles.join(" | ")}`);
      return lines.join("\n");
    }).join("\n") || "(no features catalog yet)";

    const apiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: `You're Ashley's product partner at Lumi (Meta ads app for non-expert coaches and creators). Brainstorm 6 fresh "What's new" / marketing update ideas she could log this month — these will seed newsletter, social, and changelog content. Mix categories (feature, improvement, fix, announcement). Each should be: warm, specific, written for non-expert creators, no hype words. Avoid duplicating items in "already_logged".

=== OUTCOME-FIRST WRITING (most important rule) ===
Every title and body MUST lead with what changes for the CREATOR — the problem solved, the time saved, the result they get, the stress removed. Do NOT lead with the feature, tool, or fix itself.
- Title pattern: a benefit, a relief, or a result. NOT "New X" / "We added Y" / "Introducing Z".
- Body pattern: 1 sentence on the outcome ("you'll know exactly what to spend to hit 50 conversions a week"), then 1 short sentence pointing to where it lives in Lumi.
- Tone: warm, plain English, no jargon, no guarantees, no "overnight" / "secret" / "game-changing".

Examples of right vs wrong:
  ✅ "Know your budget before you spend a dollar" — body: "Plug in your goal and Lumi tells you the budget needed to hit 50 conversions a week. Find it on the campaign builder."
  ❌ "New budget calculator added"
  ✅ "Stop wondering if your pixel is actually working"
  ❌ "Pixel preflight check shipped"


Lumi ONLY does the things listed below. If an idea references anything outside this list, it is WRONG and must be discarded:
- Campaign structure: Advantage+ Shopping / Sales / Leads / Traffic with "Broad+" audience ONLY. Generic ad set names ("Ad Set {index}").
- Audiences: Broad+ (Advantage+ targeting) is the default. Sometimes a simple warm/engagement audience or a geolocated audience. That's it.
- Creative: AI-generated 9:16 vertical video scripts, hooks, 27-char headlines, primary copy, b-roll shot lists. Image/video uploads capped at 250MB.
- Onboarding: 5-step brand wizard, pixel verification with fallback to "book a call with Ashley" or "run a Traffic campaign instead" if the pixel won't install.
- Reporting: weekly emailed optimization report (LIVE campaigns only), green/yellow/red diagnostics, budget hog + creative fatigue detection.
- Tooling: budget calculator (work back from goal conversions / revenue / set spend, anchored to 50 conv/week), Lumi onboarding concierge AI, partner/agency portals, features catalog, founder pricing ($97/mo), 7-day free trial.

DO NOT — under any circumstances — write ideas about:
- Interest targeting, detailed targeting, audience interests, custom audiences from interests, lookalike audiences
- Retargeting, pixel-based remarketing strategies, warm funnels beyond simple engagement audiences
- Landing page optimization, CRO, page-speed advice, form optimization
- A/B testing audiences (we test creative, not audiences)
- Manual bidding strategies, cost caps, bid caps, manual placements
- "Beta" language — use "Founder Pricing" instead
- Generic Meta ads advice not tied to a real Lumi feature in the catalog below
- Guarantees, "overnight," "secret," health/income/age claims

Every idea MUST map to a specific feature in the LUMI FEATURES CATALOG or a recent changelog entry. If you can't ground it in something real, drop it.

=== LUMI FEATURES CATALOG (source of truth) ===
${featuresText}

=== SIGNALS ===
${JSON.stringify(signals, null, 2)}

Return JSON exactly: { "ideas": [ { "title": "short headline (max 60 chars)", "body": "1-2 sentence what changed + why it matters to a non-expert coach/creator", "category": "feature|improvement|fix|announcement" } ] }`
        }],
        response_format: { type: 'json_object' },
      }),
    });
    if (!aiRes.ok) {
      return new Response(JSON.stringify({ error: `AI: ${aiRes.status}` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const data = await aiRes.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    return new Response(JSON.stringify({ success: true, ideas: parsed.ideas || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
