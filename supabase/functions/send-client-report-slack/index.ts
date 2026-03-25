import { getCorsHeaders } from '../_shared/cors.ts';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/slack/api';

Deno.serve(async (req) => {
  // Slack client report notifications disabled — returning early
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ success: true, disabled: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { channel, reportText, brandName, dateRange } = await req.json();
    if (!channel) throw new Error('channel is required');
    if (!reportText) throw new Error('reportText is required');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const SLACK_API_KEY = Deno.env.get('SLACK_API_KEY');
    if (!SLACK_API_KEY) throw new Error('SLACK_API_KEY is not configured — connect Slack first');

    const blocks = convertReportToBlocks(reportText, brandName, dateRange);

    const response = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': SLACK_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text: `📊 ${brandName || 'Performance'} Report — ${dateRange || ''}`,
        blocks,
        unfurl_links: false,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(`Slack API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error sending report to Slack:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

function convertReportToBlocks(markdown: string, brandName?: string, dateRange?: string): any[] {
  const blocks: any[] = [];

  // Header block
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `📊 ${brandName || 'Performance'} Report`,
      emoji: true,
    },
  });

  if (dateRange) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `_${dateRange}_` }],
    });
  }

  blocks.push({ type: 'divider' });

  const lines = markdown.split('\n');
  let currentSection = '';
  let tableRows: string[][] = [];
  let inTable = false;

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const fields = tableRows.map(([key, val]) => ({
      type: 'mrkdwn',
      text: `*${key.replace(/\*\*/g, '').trim()}*\n${val.replace(/\*\*/g, '').trim()}`,
    }));
    // Slack allows max 10 fields per section, split if needed
    for (let i = 0; i < fields.length; i += 10) {
      blocks.push({ type: 'section', fields: fields.slice(i, i + 10) });
    }
    tableRows = [];
    inTable = false;
  };

  const flushSection = () => {
    if (!currentSection.trim()) return;
    // Split into chunks of 3000 chars (Slack limit)
    const text = currentSection.trim();
    for (let i = 0; i < text.length; i += 3000) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: text.slice(i, i + 3000) },
      });
    }
    currentSection = '';
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Horizontal rule → divider
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushTable();
      flushSection();
      blocks.push({ type: 'divider' });
      continue;
    }

    // H3 headers → header block
    if (trimmed.startsWith('### ')) {
      flushTable();
      flushSection();
      const headerText = trimmed.replace(/^###\s*/, '').slice(0, 150);
      blocks.push({
        type: 'header',
        text: { type: 'plain_text', text: headerText, emoji: true },
      });
      continue;
    }

    // H4 headers → bold section
    if (trimmed.startsWith('#### ')) {
      flushTable();
      flushSection();
      const h4Text = trimmed.replace(/^####\s*/, '');
      currentSection += `\n*${h4Text}*\n`;
      continue;
    }

    // Table separator row (|---|---|)
    if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
      inTable = true;
      continue;
    }

    // Table header row — start table mode
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && !inTable) {
      flushSection();
      inTable = true;
      // Skip header row, we'll use data rows
      continue;
    }

    // Table data row
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && inTable) {
      const cells = trimmed.split('|').filter(c => c.trim());
      if (cells.length >= 2) {
        tableRows.push([cells[0].trim(), cells[1].trim()]);
      }
      continue;
    }

    // End of table
    if (inTable && !trimmed.startsWith('|')) {
      flushTable();
    }

    // Checklist items → emoji conversion
    if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
      const isChecked = trimmed.startsWith('- [x]');
      const itemText = trimmed.replace(/^- \[[ x]\]\s*/, '');
      currentSection += `\n${isChecked ? '☑️' : '☐'} ${convertBoldToSlack(itemText)}`;
      continue;
    }

    // Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      const bulletText = trimmed.replace(/^[-•]\s*/, '');
      currentSection += `\n• ${convertBoldToSlack(bulletText)}`;
      continue;
    }

    // Bold labels (e.g., **What's Happening:**)
    if (trimmed.startsWith('**') && trimmed.includes(':**')) {
      flushTable();
      currentSection += `\n${convertBoldToSlack(trimmed)}`;
      continue;
    }

    // Regular text
    if (trimmed) {
      currentSection += `\n${convertBoldToSlack(trimmed)}`;
    }
  }

  flushTable();
  flushSection();

  // Footer
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: '💜 Sent by LUMI · <https://adsbylumi.com/data|View Full Dashboard>' }],
  });

  // Slack has a 50-block limit
  return blocks.slice(0, 50);
}

function convertBoldToSlack(text: string): string {
  // Convert markdown **bold** to Slack *bold*
  return text.replace(/\*\*([^*]+)\*\*/g, '*$1*');
}
