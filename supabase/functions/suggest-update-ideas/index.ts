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

You MUST ground every idea in the REAL FEATURES CATALOG, RECENT CHANGELOG, or recent activity — re-highlight an existing feature, surface a recent fix as an improvement, or build on a real marketing angle. Do NOT invent features that don't exist in the catalog.

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
