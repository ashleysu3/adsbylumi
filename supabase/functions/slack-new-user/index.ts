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
    const { email, full_name } = await req.json();

    const displayName = full_name || 'Unknown';
    const text = `🎉 New user signed up: *${displayName}* (${email})`;

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:tada: *New User Signup*\n\n*Name:* ${displayName}\n*Email:* ${email}\n*Time:* ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
        },
      },
    ];

    const response = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': SLACK_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: SLACK_CHANNEL,
        text,
        blocks,
        username: 'Lumi',
        icon_emoji: ':sparkles:',
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      console.error('Slack API error:', JSON.stringify(data));
      throw new Error(`Slack API call failed [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error sending new user Slack notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
