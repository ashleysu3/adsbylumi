import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const SYSTEM_PROMPT = `You draft "your bug is fixed" support emails for Lumi (a Meta ads app for coaches and course creators). Voice: warm, enthusiastic, strategy-first (Ashley Braswell style), plain-English, non-expert-friendly. Emojis are OK sparingly.

The email must:
1. Warmly acknowledge the specific issue the user reported (reference what they saw, not code terms).
2. Explain what was fixed in plain language — NO filenames, NO code, NO jargon like "edge function", "RLS", "state", "hook". Translate technical work into "we fixed the thing where X wasn't loading" language.
3. Ask them to try again and reply / report back if anything is still off.
4. Sign off warmly.

Return STRICT JSON:
{
  "subject": "concise subject line, under 70 chars, no emoji prefixes",
  "body": "plain-text email body (no HTML). Use blank lines between paragraphs. Do NOT include a signature — the system adds 'Best, The Lumi Team'."
}

Do not include markdown fences. Raw JSON only.`;

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

    const { reportId, fixSummary } = await req.json();
    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: report } = await admin.from('bug_reports').select('*').eq('id', reportId).maybeSingle();
    if (!report) {
      return new Response(JSON.stringify({ error: 'bug report not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userPrompt = `Reporter email: ${report.user_email}
What they reported (from their form): ${report.details || '(none)'}
Page they were on: ${report.current_page || 'unknown'}

What we actually fixed (internal notes / triage summary — translate to plain user language):
${fixSummary || report.resolution_notes || '(no fix summary provided — write a warm generic "fix shipped, please retry" note based on what they reported)'}

Draft the fix-confirmation email now.`;

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
      console.error('[draft-bug-fix-email] AI gateway error', aiRes.status, errText);
      return new Response(
        JSON.stringify({ error: 'ai_failed', status: aiRes.status, details: errText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content || '{}';
    let draft: { subject: string; body: string };
    try {
      draft = JSON.parse(raw);
    } catch {
      draft = { subject: 'Update on your bug report', body: raw };
    }

    return new Response(JSON.stringify({ success: true, draft }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[draft-bug-fix-email] error', e);
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
