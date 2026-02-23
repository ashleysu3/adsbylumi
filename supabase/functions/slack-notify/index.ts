import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/slack/api';

Deno.serve(async (req) => {
  // This function is called internally by other edge functions, no CORS needed
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
    const { channel, text, blocks } = await req.json();

    if (!channel || !text) {
      return new Response(JSON.stringify({ error: 'channel and text are required' }), { status: 400 });
    }

    const payload: Record<string, unknown> = {
      channel,
      text,
      username: 'Lumi',
      icon_emoji: ':sparkles:',
    };

    if (blocks) {
      payload.blocks = blocks;
    }

    const response = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': SLACK_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error('Slack API error:', JSON.stringify(data));
      throw new Error(`Slack API call failed [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true, ts: data.ts }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error sending Slack message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
