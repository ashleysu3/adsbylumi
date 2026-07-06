import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const SYSTEM_PROMPT = `You are a senior full-stack engineer triaging a user-reported bug for the Lumi Meta Ads app (React + Vite + Supabase + Meta Graph API).

Given the bug report, respond with STRICT JSON in this exact shape:
{
  "severity": "low" | "normal" | "high" | "critical",
  "category": "ui" | "data" | "auth" | "meta_integration" | "billing" | "ai_generation" | "performance" | "other",
  "diagnosis": "2-4 sentences plain English: what's most likely happening and why",
  "likely_files": ["src/pages/X.tsx", "supabase/functions/Y/index.ts"],
  "suggested_fix": "3-6 sentence concrete fix approach",
  "user_facing_summary": "One friendly sentence describing what was wrong, in plain user language (no code, no filenames)",
  "lovable_prompt": "A ready-to-paste prompt for the Lovable AI code agent that reproduces the bug, states the root cause hypothesis, and asks it to implement the fix. Include the reported page and any error text."
}

Be honest — if the report is too vague to diagnose, say so in diagnosis and ask for the specific info you'd need in lovable_prompt.
Do NOT include markdown fences. Return raw JSON only.`;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: role } = await admin.from('user_roles').select('role')
      .eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!role) {
      return new Response(JSON.stringify({ error: 'admin_required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { reportId } = await req.json();
    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: report, error: reportErr } = await admin
      .from('bug_reports').select('*').eq('id', reportId).maybeSingle();
    if (reportErr || !report) {
      return new Response(JSON.stringify({ error: 'bug report not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userPrompt = `Bug report:

Reported by: ${report.user_email}
Page: ${report.current_page || 'unknown'}
URL: ${report.current_url || 'unknown'}
User agent: ${report.user_agent || 'unknown'}
Priority (user-set): ${report.priority || 'normal'}
${report.screenshot_url ? `Screenshot URL: ${report.screenshot_url}` : ''}

Description from user:
${report.details || '(none provided)'}

Additional context:
${report.context || '(none)'}

Recent app/chat context:
${report.conversation_context || '(none captured)'}`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.5',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[triage-bug-report] AI gateway error', aiRes.status, errText);
      return new Response(
        JSON.stringify({ error: 'ai_failed', status: aiRes.status, details: errText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content || '{}';
    let triage: any;
    try {
      triage = JSON.parse(raw);
    } catch {
      triage = { diagnosis: raw, suggested_fix: '', lovable_prompt: '', likely_files: [], severity: 'normal', category: 'other', user_facing_summary: '' };
    }

    return new Response(JSON.stringify({ success: true, triage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[triage-bug-report] error', e);
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
