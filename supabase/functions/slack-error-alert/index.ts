const GATEWAY_URL = 'https://connector-gateway.lovable.dev/slack/api';
const SLACK_CHANNEL = 'lumi-alerts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY is not configured' }), { status: 500 });
  }

  const SLACK_API_KEY = Deno.env.get('SLACK_API_KEY');
  if (!SLACK_API_KEY) {
    return new Response(JSON.stringify({ error: 'SLACK_API_KEY is not configured' }), { status: 500 });
  }

  try {
    const { category, severity, title, message, details, source } = await req.json();

    if (!title || !message) {
      return new Response(JSON.stringify({ error: 'Missing title or message' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Map severity to emoji and color
    const severityMap: Record<string, { emoji: string; color: string }> = {
      critical: { emoji: '🚨', color: '#dc2626' },
      error: { emoji: '❌', color: '#ef4444' },
      warning: { emoji: '⚠️', color: '#f59e0b' },
      info: { emoji: 'ℹ️', color: '#3b82f6' },
      security: { emoji: '🔒', color: '#7c3aed' },
    };

    const sev = severityMap[severity] || severityMap.warning;
    const categoryLabel = category || 'System';
    const sourceLabel = source || 'Unknown';

    const blocks: any[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${sev.emoji} ${title}`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Category:*\n${categoryLabel}` },
          { type: 'mrkdwn', text: `*Severity:*\n${severity || 'warning'}` },
          { type: 'mrkdwn', text: `*Source:*\n\`${sourceLabel}\`` },
          { type: 'mrkdwn', text: `*Time:*\n${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} UTC` },
        ],
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: message },
      },
    ];

    // Add details if present
    if (details) {
      const detailStr = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `\`\`\`${detailStr.substring(0, 2900)}\`\`\`` },
      });
    }

    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '_Lumi Error Monitor_' }],
    });

    const response = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': SLACK_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: SLACK_CHANNEL,
        text: `${sev.emoji} [${categoryLabel}] ${title}: ${message}`,
        blocks,
        username: 'Lumi Monitor',
        icon_emoji: ':rotating_light:',
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      console.error('Slack API error:', JSON.stringify(data));
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('slack-error-alert error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
