import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/slack/api';
const SLACK_CHANNEL = '#bug-reports';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { reportId } = await req.json();
    if (!reportId) throw new Error('reportId is required');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SLACK_API_KEY = Deno.env.get('SLACK_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
    if (!SLACK_API_KEY) throw new Error('SLACK_API_KEY not configured — connect Slack first');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: report, error: fetchErr } = await supabase
      .from('bug_reports')
      .select('*')
      .eq('id', reportId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!report) throw new Error('Bug report not found');

    const prompt = `Please fix this bug reported by a user:

**User's Description:**
${report.details || '(no details provided)'}

**Page where it occurred:** ${report.current_page || 'unknown'}
**Full URL:** ${report.current_url || 'unknown'}
**User email:** ${report.user_email}
**Reported at:** ${report.created_at}
${report.screenshot_url ? `**Screenshot:** ${report.screenshot_url}` : ''}
${report.conversation_context ? `\n**Recent chat context:**\n${report.conversation_context}` : ''}

Please investigate, find the root cause, and implement a fix. Reference bug report ID: ${reportId}`;

    const blocks: any[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🐛➡️💜 Fix in Lovable', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*User:*\n${report.user_email}` },
          { type: 'mrkdwn', text: `*Page:*\n\`${report.current_page || 'unknown'}\`` },
          { type: 'mrkdwn', text: `*Priority:*\n${report.priority}` },
          { type: 'mrkdwn', text: `*Status:*\n${report.status}` },
        ],
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Paste this into Lovable:*' },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '```' + prompt.slice(0, 2800) + '```' },
      },
    ];

    if (report.screenshot_url) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `📎 <${report.screenshot_url}|View screenshot>` },
      });
    }

    const slackRes = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': SLACK_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: SLACK_CHANNEL,
        text: `🐛 Fix in Lovable: bug from ${report.user_email}`,
        blocks,
        unfurl_links: false,
      }),
    });

    const slackData = await slackRes.json();
    if (!slackRes.ok || !slackData.ok) {
      return new Response(
        JSON.stringify({ error: `Slack error: ${slackData.error || slackRes.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark in_progress
    await supabase
      .from('bug_reports')
      .update({ status: 'in_progress' })
      .eq('id', reportId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('send-bug-to-lovable error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
