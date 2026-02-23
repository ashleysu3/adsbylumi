import { createClient } from 'npm:@supabase/supabase-js@2';

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
    const { question } = await req.json();
    if (!question || typeof question !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing "question" field' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Gather all app data for the AI to reason over
    const [
      profilesRes,
      brandsRes,
      offersRes,
      workspacesRes,
      bugReportsRes,
      subscriptionsRes,
      alertsRes,
      benchRes,
      rotationRes,
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, email, full_name, created_at'),
      supabaseAdmin.from('brands').select('id, user_id, name, website_url, meta_account_id, meta_pixel_id, industry, created_at'),
      supabaseAdmin.from('offers').select('id, brand_id, name, url, price_point, page_goal, created_at'),
      supabaseAdmin.from('campaign_workspaces').select('id, brand_id, name, progress_status, meta_campaign_status, auto_rotate_enabled, created_at, updated_at').order('updated_at', { ascending: false }).limit(50),
      supabaseAdmin.from('bug_reports').select('id, user_email, details, status, current_page, created_at').order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.from('subscriptions').select('id, user_id, tier, status, created_at, current_period_end'),
      supabaseAdmin.from('user_alerts').select('id, user_id, type, severity, title, message, created_at, read_at, dismissed_at').order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.from('creative_bench').select('id, workspace_id, status, created_at').limit(100),
      supabaseAdmin.from('creative_rotation_log').select('id, action, reason, created_at').order('created_at', { ascending: false }).limit(20),
    ]);

    const profiles = profilesRes.data || [];
    const brands = brandsRes.data || [];
    const offers = offersRes.data || [];
    const workspaces = workspacesRes.data || [];
    const bugReports = bugReportsRes.data || [];
    const subscriptions = subscriptionsRes.data || [];
    const alerts = alertsRes.data || [];
    const bench = benchRes.data || [];
    const rotationLogs = rotationRes.data || [];

    // Build context summary
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const newUsersToday = profiles.filter(p => new Date(p.created_at) >= oneDayAgo);
    const newUsersThisWeek = profiles.filter(p => new Date(p.created_at) >= oneWeekAgo);
    const brandsWithMeta = brands.filter(b => b.meta_account_id);
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active' || s.status === 'trial');
    const openBugs = bugReports.filter(b => b.status === 'new' || b.status === 'in_progress');
    const unreadAlerts = alerts.filter(a => !a.read_at && !a.dismissed_at);

    const dataContext = `
## Current App Data (as of ${now.toISOString()})

### Users
- Total users: ${profiles.length}
- New today: ${newUsersToday.length}
- New this week: ${newUsersThisWeek.length}
- User list: ${JSON.stringify(profiles.map(p => ({ email: p.email, name: p.full_name, joined: p.created_at })))}

### Brands
- Total brands: ${brands.length}
- With Meta connected: ${brandsWithMeta.length}
- Brand details: ${JSON.stringify(brands.map(b => ({ name: b.name, website: b.website_url, industry: b.industry, hasMeta: !!b.meta_account_id, hasPixel: !!b.meta_pixel_id })))}

### Offers
- Total offers: ${offers.length}
- Offer details: ${JSON.stringify(offers.map(o => ({ name: o.name, url: o.url, price: o.price_point, goal: o.page_goal })))}

### Subscriptions
- Active subscriptions: ${activeSubscriptions.length}
- By tier: ${JSON.stringify(activeSubscriptions.reduce((acc: any, s: any) => { acc[s.tier] = (acc[s.tier] || 0) + 1; return acc; }, {}))}
- Subscription details: ${JSON.stringify(subscriptions.map(s => ({ tier: s.tier, status: s.status, expires: s.current_period_end })))}

### Campaign Workspaces
- Total workspaces: ${workspaces.length}
- Recent activity: ${JSON.stringify(workspaces.slice(0, 10).map(w => ({ name: w.name, status: w.progress_status, metaStatus: w.meta_campaign_status, lastUpdated: w.updated_at })))}

### Bug Reports (Recent)
- Open bugs: ${openBugs.length}
- Recent reports: ${JSON.stringify(bugReports.slice(0, 5).map(b => ({ email: b.user_email, page: b.current_page, details: b.details?.substring(0, 100), status: b.status })))}

### Alerts
- Unread alerts: ${unreadAlerts.length}
- Recent alerts: ${JSON.stringify(alerts.slice(0, 5).map(a => ({ type: a.type, severity: a.severity, title: a.title })))}

### Creative Lifecycle
- Total bench items: ${bench.length}
- Live: ${bench.filter(b => b.status === 'live').length}
- On bench: ${bench.filter(b => b.status === 'bench').length}
- Paused: ${bench.filter(b => b.status === 'paused').length}
- Recent rotations: ${JSON.stringify(rotationLogs.slice(0, 5).map(r => ({ action: r.action, reason: r.reason, date: r.created_at })))}

### Email System
- Resend is configured (RESEND_API_KEY exists)
- Email reports are scheduled via pg_cron (send-weekly-reports runs at 8 AM UTC)
- Report frequency is configurable per brand in notification_preferences
`;

    // Call AI to answer the question
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are Lumi, the AI assistant for the "Your Ad Assistant" platform (adsbylumi.com). You're answering admin questions about the app's data, health, and users.

You have access to real-time database data below. Answer questions concisely and accurately using this data. Format numbers clearly. If you don't have enough data to answer, say so.

Keep responses under 300 words. Use bullet points for lists. Be warm but professional — like a smart ops manager.

${dataContext}`,
          },
          { role: 'user', content: question },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || 'Sorry, I couldn\'t generate an answer.';

    // Post answer to Slack
    const slackResponse = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': SLACK_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: SLACK_CHANNEL,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `💬 *Question:* ${question}` },
          },
          { type: 'divider' },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: answer },
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `_Lumi Admin Bot • ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} UTC_` }],
          },
        ],
        text: `Q: ${question}\nA: ${answer}`,
        username: 'Lumi Admin',
        icon_emoji: ':brain:',
      }),
    });

    const slackData = await slackResponse.json();
    if (!slackResponse.ok || !slackData.ok) {
      console.error('Slack error:', JSON.stringify(slackData));
    }

    return new Response(JSON.stringify({ success: true, answer }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('slack-lumi-chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
