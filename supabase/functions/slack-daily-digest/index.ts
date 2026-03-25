import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/slack/api';
const SLACK_CHANNEL = 'lumi-alerts';

Deno.serve(async (req) => {
  // Slack daily digest disabled — returning early
  return new Response(JSON.stringify({ success: true, disabled: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const since = yesterday.toISOString();

    // Parallel queries
    const [newUsersRes, bugReportsRes, activeUserRes, allProfilesRes, allBrandsRes, allOffersRes, allWorkspacesRes, fatigueLogsRes, benchCountRes] = await Promise.all([
      // New users in last 24h
      supabaseAdmin.from('profiles').select('id, email, full_name, created_at').gte('created_at', since).order('created_at', { ascending: false }),
      // Bug reports in last 24h
      supabaseAdmin.from('bug_reports').select('id, user_email, current_page, details, status, created_at').gte('created_at', since).order('created_at', { ascending: false }),
      // Most active user (most workspace updates in last 24h)
      supabaseAdmin.from('campaign_workspaces').select('brand_id, updated_at').gte('updated_at', since),
      // Friction detection: all profiles
      supabaseAdmin.from('profiles').select('id, email, full_name, created_at'),
      // All brands
      supabaseAdmin.from('brands').select('id, user_id, meta_account_id'),
      // All offers
      supabaseAdmin.from('offers').select('id, brand_id'),
      // All workspaces
      supabaseAdmin.from('campaign_workspaces').select('id, brand_id'),
      // Creative fatigue logs in last 24h
      supabaseAdmin.from('creative_rotation_log').select('id, workspace_id, brand_id, action, reason, created_at').gte('created_at', since).order('created_at', { ascending: false }),
      // Low bench count workspaces
      supabaseAdmin.from('creative_bench').select('workspace_id, status'),
    ]);

    const newUsers = newUsersRes.data || [];
    const bugReports = bugReportsRes.data || [];
    const recentWorkspaces = activeUserRes.data || [];

    // Find most active user
    let mostActiveUser: { email: string; name: string; count: number } | null = null;
    if (recentWorkspaces.length > 0) {
      const brandCounts: Record<string, number> = {};
      for (const ws of recentWorkspaces) {
        brandCounts[ws.brand_id] = (brandCounts[ws.brand_id] || 0) + 1;
      }
      const topBrandId = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topBrandId) {
        const allBrands = allBrandsRes.data || [];
        const brand = allBrands.find((b: any) => b.id === topBrandId);
        if (brand) {
          const allProfiles = allProfilesRes.data || [];
          const profile = allProfiles.find((p: any) => p.id === brand.user_id);
          if (profile) {
            mostActiveUser = {
              email: profile.email,
              name: profile.full_name || 'Unknown',
              count: brandCounts[topBrandId],
            };
          }
        }
      }
    }

    // Friction points detection
    const allProfiles = allProfilesRes.data || [];
    const allBrands = allBrandsRes.data || [];
    const allOffers = allOffersRes.data || [];
    const allWorkspaces = allWorkspacesRes.data || [];

    const userIdsWithBrands = new Set(allBrands.map((b: any) => b.user_id));
    const brandIdsWithMeta = new Set(allBrands.filter((b: any) => b.meta_account_id).map((b: any) => b.id));
    const brandIdsWithOffers = new Set(allOffers.map((o: any) => o.brand_id));
    const brandIdsWithWorkspaces = new Set(allWorkspaces.map((w: any) => w.brand_id));

    const noBrand = allProfiles.filter((p: any) => !userIdsWithBrands.has(p.id));
    const noMeta = allBrands.filter((b: any) => !brandIdsWithMeta.has(b.id));
    const noOffers = allBrands.filter((b: any) => !brandIdsWithOffers.has(b.id));
    const noWorkspaces = allBrands.filter((b: any) => brandIdsWithOffers.has(b.id) && !brandIdsWithWorkspaces.has(b.id));

    // Build Slack message
    const sections: any[] = [];

    // Header
    sections.push({
      type: 'header',
      text: { type: 'plain_text', text: '☀️ Lumi Daily Digest', emoji: true },
    });

    sections.push({ type: 'divider' });

    // New users
    if (newUsers.length > 0) {
      const userList = newUsers.slice(0, 10).map((u: any) => `• *${u.full_name || 'Unknown'}* (${u.email})`).join('\n');
      sections.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `:tada: *New Users (${newUsers.length})*\n${userList}${newUsers.length > 10 ? `\n_...and ${newUsers.length - 10} more_` : ''}` },
      });
    } else {
      sections.push({
        type: 'section',
        text: { type: 'mrkdwn', text: ':bust_in_silhouette: *New Users:* None yesterday' },
      });
    }

    sections.push({ type: 'divider' });

    // Bug reports
    if (bugReports.length > 0) {
      const bugList = bugReports.slice(0, 5).map((b: any) => {
        const snippet = b.details ? b.details.substring(0, 80) + (b.details.length > 80 ? '...' : '') : 'No details';
        return `• *${b.user_email}* on \`${b.current_page || 'unknown'}\`: ${snippet}`;
      }).join('\n');
      sections.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `:bug: *Bug Reports (${bugReports.length})*\n${bugList}` },
      });
    } else {
      sections.push({
        type: 'section',
        text: { type: 'mrkdwn', text: ':white_check_mark: *Bug Reports:* None yesterday' },
      });
    }

    sections.push({ type: 'divider' });

    // Most active user
    if (mostActiveUser) {
      sections.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `:fire: *Most Active User*\n*${mostActiveUser.name}* (${mostActiveUser.email}) — ${mostActiveUser.count} workspace update${mostActiveUser.count !== 1 ? 's' : ''}` },
      });
    } else {
      sections.push({
        type: 'section',
        text: { type: 'mrkdwn', text: ':zzz: *Most Active User:* No workspace activity yesterday' },
      });
    }

    // Friction points
    const frictionItems: string[] = [];
    if (noBrand.length > 0) frictionItems.push(`• *${noBrand.length}* user${noBrand.length !== 1 ? 's' : ''} signed up but never created a brand`);
    if (noMeta.length > 0) frictionItems.push(`• *${noMeta.length}* brand${noMeta.length !== 1 ? 's' : ''} without a Meta account connected`);
    if (noOffers.length > 0) frictionItems.push(`• *${noOffers.length}* brand${noOffers.length !== 1 ? 's' : ''} with no offers created`);
    if (noWorkspaces.length > 0) frictionItems.push(`• *${noWorkspaces.length}* brand${noWorkspaces.length !== 1 ? 's' : ''} with offers but no campaign workspaces`);

    if (frictionItems.length > 0) {
      sections.push({ type: 'divider' });
      sections.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `:warning: *Potential Friction Points*\n${frictionItems.join('\n')}` },
      });
    }

    // Creative Fatigue & Rotation Summary
    const fatigueLogs = fatigueLogsRes.data || [];
    const benchData = benchCountRes.data || [];
    
    if (fatigueLogs.length > 0 || benchData.length > 0) {
      const creativeItems: string[] = [];
      
      // Rotation events
      const autoRotations = fatigueLogs.filter((l: any) => l.action === 'auto_rotated');
      const fatigueDetections = fatigueLogs.filter((l: any) => l.action === 'pause_fatigue');
      
      if (autoRotations.length > 0) {
        creativeItems.push(`• ✅ *${autoRotations.length}* auto-rotation${autoRotations.length !== 1 ? 's' : ''} completed`);
      }
      if (fatigueDetections.length > 0) {
        creativeItems.push(`• ⚠️ *${fatigueDetections.length}* ad${fatigueDetections.length !== 1 ? 's' : ''} flagged for fatigue`);
      }
      
      // Low bench count
      const benchByWorkspace: Record<string, number> = {};
      benchData.forEach((b: any) => {
        if (b.status === 'bench') {
          benchByWorkspace[b.workspace_id] = (benchByWorkspace[b.workspace_id] || 0) + 1;
        }
      });
      const lowBenchWorkspaces = Object.entries(benchByWorkspace).filter(([_, count]) => count <= 1);
      if (lowBenchWorkspaces.length > 0) {
        creativeItems.push(`• 🪫 *${lowBenchWorkspaces.length}* workspace${lowBenchWorkspaces.length !== 1 ? 's' : ''} running low on bench creative`);
      }
      
      if (creativeItems.length > 0) {
        sections.push({ type: 'divider' });
        sections.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `:art: *Creative Lifecycle*\n${creativeItems.join('\n')}` },
        });
      }
    }

    // Footer
    sections.push({ type: 'divider' });
    sections.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `_Generated ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} UTC_` }],
    });

    const fallbackText = `Lumi Daily Digest: ${newUsers.length} new users, ${bugReports.length} bug reports`;

    const response = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': SLACK_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: SLACK_CHANNEL,
        text: fallbackText,
        blocks: sections,
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
    console.error('Error sending daily digest:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
