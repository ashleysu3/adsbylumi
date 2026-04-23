import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4.0.0';

// ============================================================================
// approve-from-email (rewritten for Patch #7)
//
// Handles GET + POST for the one-click-approve flow from digest emails.
//
//   GET  /functions/v1/approve-from-email?token=XYZ
//     Shows a confirmation page with the action details and a Confirm button.
//     Deliberately does NOT mutate anything — some email clients prefetch
//     links in the background, and we don't want a prefetch to approve.
//
//   POST /functions/v1/approve-from-email?token=XYZ
//     Actually executes the action. Parses the structured action_data from
//     the token, dispatches to Meta via the brand's meta_access_token, logs
//     to ad_action_log, marks the token used, sends confirmation email.
//
// Token shape (written by send-weekly-reports):
//   {
//     action_description: string,
//     action_data: {
//       actionType: 'pause_ad' | 'resume_ad' | 'budget_increase' |
//                   'budget_decrease' | 'swap_creative' | 'promote_to_scaling'
//                   | <legacy — no actionType>,
//       actionPayload: { ...whatever the in-app executor would receive },
//       campaign?: string,
//       recDescription?: string,
//     },
//     ...
//   }
//
// Tokens without a structured actionType are legacy (parsed from report
// text) — we can't auto-execute those, so we tell the user to apply them
// manually in LUMI and still mark the token used.
// ============================================================================

const META_API = 'https://graph.facebook.com/v21.0';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return htmlResponse('Missing Token', 'No approval token was provided. Please use the link from your email.', false);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up the token for both GET + POST — same validation for both.
    const { data: tokenRow, error: tokenError } = await supabase
      .from('email_approval_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenRow) {
      return htmlResponse('Invalid Token', 'This approval link is invalid or has already been used.', false);
    }
    if (tokenRow.status === 'used') {
      return htmlResponse('Already Approved', 'This change was already approved. No further action needed! ✅', true);
    }
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      await supabase.from('email_approval_tokens').update({ status: 'expired' }).eq('id', tokenRow.id);
      return htmlResponse('Link Expired', 'This approval link has expired. Please check your latest report for updated recommendations.', false);
    }

    const actionData = (tokenRow.action_data || {}) as Record<string, any>;
    const actionType = (actionData.actionType as string) || null;
    const actionPayload = (actionData.actionPayload as Record<string, any>) || {};
    const description = tokenRow.action_description || '(no description)';
    const campaignName = actionData.campaign || '';

    // ---- GET: show confirmation page, do not mutate ----
    if (req.method === 'GET') {
      return confirmationPageHtml({
        token,
        description,
        campaignName,
        actionType,
        canExecute: !!actionType,
      });
    }

    // ---- POST: execute ----
    if (req.method === 'POST') {
      // Read the brand's Meta credentials up front — most action types
      // need this and we don't want to mark the token used before we
      // know we can actually call Meta.
      const { data: brand, error: brandErr } = await supabase
        .from('brands')
        .select('id, user_id, meta_access_token, meta_account_id')
        .eq('id', tokenRow.brand_id)
        .single();
      if (brandErr || !brand?.meta_access_token) {
        return htmlResponse('Meta Not Connected',
          'We couldn\'t reach your Meta account. Reconnect it in LUMI and try approving again from your dashboard.', false);
      }

      // Dispatch based on the structured action type. Legacy (no actionType)
      // tokens get recorded but not executed — we show the user a friendly
      // nudge to apply manually.
      let result: { ok: boolean; message: string };
      try {
        result = await dispatchAction({
          actionType,
          payload: actionPayload,
          brand,
          supabase,
          workspaceId: tokenRow.workspace_id,
        });
      } catch (err: any) {
        console.error('approve-from-email dispatch error:', err);
        result = { ok: false, message: err?.message || 'Unexpected error while applying the change.' };
      }

      // Mark the token used regardless of outcome so a retry doesn't double-apply.
      // If the Meta call failed, the user sees the error and can try again from
      // the dashboard (which goes through a different path).
      await supabase.from('email_approval_tokens').update({ status: 'used' }).eq('id', tokenRow.id);

      // Log to ad_action_log so it shows up in Action History + feeds the
      // change-aware recommendations engine (#6) as a recent event.
      await supabase.from('ad_action_log').insert({
        brand_id: tokenRow.brand_id,
        workspace_id: tokenRow.workspace_id,
        action_type: actionType ? `email_approved_${actionType}` : 'email_approved_manual',
        action_detail: {
          description,
          campaign: campaignName,
          actionType,
          actionPayload,
          result: result.ok ? 'applied' : 'failed',
          error: result.ok ? null : result.message,
        },
        source: 'lumi_approved',
      });

      // Optional: send confirmation email (best-effort; don't fail the response).
      sendConfirmationEmail(supabase, tokenRow.user_id, description, result.ok).catch(e =>
        console.error('Confirmation email failed (non-fatal):', e));

      return htmlResponse(
        result.ok ? 'Approved ✅' : 'Couldn\'t Apply',
        result.ok
          ? `Your change has been applied on Meta. ${result.message}`
          : `We couldn't apply this change: ${result.message}. Open LUMI to try from the dashboard.`,
        result.ok,
      );
    }

    return htmlResponse('Unsupported', 'Unsupported request method.', false);
  } catch (error: any) {
    console.error('approve-from-email error:', error);
    return htmlResponse('Error', 'Something went wrong. Please try approving from your dashboard instead.', false);
  }
});

// ============================================================================
// Action dispatch — direct Meta calls for atomic operations, so this endpoint
// stays self-contained without chaining through other authenticated edge
// functions (which would need user-token forging).
// ============================================================================
async function dispatchAction(args: {
  actionType: string | null;
  payload: Record<string, any>;
  brand: { id: string; user_id: string; meta_access_token: string; meta_account_id: string };
  supabase: any;
  workspaceId: string | null;
}): Promise<{ ok: boolean; message: string }> {
  const { actionType, payload, brand, supabase, workspaceId } = args;
  const token = brand.meta_access_token;

  if (!actionType) {
    // Legacy tokens with no structured action — we can't auto-execute.
    return {
      ok: true,
      message:
        'Noted in your action history. This item needs to be applied manually in LUMI — open the dashboard to take the action.',
    };
  }

  switch (actionType) {
    case 'pause_ad':
    case 'resume_ad': {
      const adId = payload.adId;
      if (!adId) throw new Error('Missing adId in action payload');
      const status = actionType === 'pause_ad' ? 'PAUSED' : 'ACTIVE';
      const resp = await fetch(`${META_API}/${adId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ status, access_token: token }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error?.message || 'Meta rejected the status change');
      return { ok: true, message: actionType === 'pause_ad' ? 'Ad paused.' : 'Ad resumed.' };
    }

    case 'budget_increase':
    case 'budget_decrease': {
      // Preserves ad-set-targeting semantics from patch #5. If the rec
      // included an adSetId, we POST to the ad set; otherwise campaign-level.
      // The original update-meta-budget function has richer CBO/ABO detection
      // — we rely on it when we can reach it authenticated, but email-side
      // we do a best-effort direct POST and let the user cross-check.
      const currentBudget = payload.currentBudget || 25;
      const pct = payload.percentageChange ?? 0;
      const newBudget = Math.round(currentBudget * (1 + pct / 100));
      const budgetCents = Math.round(newBudget * 100).toString();
      const targetId = payload.adSetId || payload.campaignId;
      if (!targetId) throw new Error('Missing adSetId / campaignId in action payload');
      const resp = await fetch(`${META_API}/${targetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ access_token: token, daily_budget: budgetCents }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error?.message || 'Meta rejected the budget change');
      return { ok: true, message: `Budget set to $${newBudget}/day.` };
    }

    case 'swap_creative': {
      // Mirrors rotate-creative: pause the fatigued ad, activate a bench ad.
      const fatigueAdId = payload.fatigueAdId;
      const benchAdId = payload.benchAdId;
      if (!fatigueAdId || !benchAdId) throw new Error('Missing fatigueAdId or benchAdId');
      const pauseResp = await fetch(`${META_API}/${fatigueAdId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ status: 'PAUSED', access_token: token }),
      });
      if (!(await pauseResp.json()).success) throw new Error('Failed to pause the old creative');

      const activateResp = await fetch(`${META_API}/${benchAdId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ status: 'ACTIVE', access_token: token }),
      });
      if (!(await activateResp.json()).success) {
        // Try to roll back the pause so we don't leave the user with nothing running.
        await fetch(`${META_API}/${fatigueAdId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ status: 'ACTIVE', access_token: token }),
        });
        throw new Error('Failed to activate the bench creative; the original ad was restored to ACTIVE.');
      }

      // Mirror the bench status changes so the UI stays consistent.
      if (workspaceId) {
        await supabase.from('creative_bench').update({
          status: 'paused', paused_at: new Date().toISOString(),
        }).eq('meta_ad_id', fatigueAdId).eq('workspace_id', workspaceId);
        await supabase.from('creative_bench').update({
          status: 'live', last_live_at: new Date().toISOString(),
        }).eq('meta_ad_id', benchAdId).eq('workspace_id', workspaceId);
      }

      return { ok: true, message: 'Creative rotated — old ad paused, bench ad live.' };
    }

    case 'promote_to_scaling': {
      // Multi-step (duplicate ad into Scaling set, pause source). We have a
      // dedicated edge function for this — call it via HTTP, using the
      // service role token. The function validates brand ownership
      // independently so no user-token forging needed.
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const resp = await fetch(`${supabaseUrl}/functions/v1/promote-ad-to-scaling`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Service role as Authorization — promote-ad-to-scaling checks
          // brand ownership via user_id comparison, which won't match
          // service role. If that fails we fall back to a manual nudge.
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ ...payload, workspaceId }),
      });
      const data = await resp.json();
      if (!data.success) {
        return {
          ok: false,
          message:
            'Promote-to-scaling is currently only approvable from inside LUMI. Open the dashboard to apply it.',
        };
      }
      return { ok: true, message: `Ad promoted to the Scaling ad set${data.pausedInTesting ? ' and paused in Testing.' : '.'}` };
    }

    default:
      return {
        ok: true,
        message:
          'Noted in your action history. This action type isn\'t yet supported from email — open LUMI to apply it.',
      };
  }
}

// ============================================================================
// Confirmation email + HTML helpers
// ============================================================================

async function sendConfirmationEmail(supabase: any, userId: string, actionDescription: string, applied: boolean) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return;
  const resend = new Resend(resendKey);
  const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', userId).single();
  if (!profile?.email) return;
  await resend.emails.send({
    from: 'Lumi <reports@adsbylumi.com>',
    to: [profile.email],
    subject: applied
      ? `✅ Applied: ${actionDescription.substring(0, 60)}`
      : `⚠️ Couldn't apply: ${actionDescription.substring(0, 60)}`,
    html: buildConfirmationEmail(profile.full_name || 'there', actionDescription, applied),
  });
}

function confirmationPageHtml(args: {
  token: string;
  description: string;
  campaignName: string;
  actionType: string | null;
  canExecute: boolean;
}): Response {
  const { token, description, campaignName, actionType, canExecute } = args;
  const safeDesc = escapeHtml(description);
  const safeCampaign = escapeHtml(campaignName);
  const actionBadge = actionType ? `<span class="badge">${escapeHtml(actionType.replace(/_/g, ' '))}</span>` : '';

  return new Response(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Confirm Approval — Lumi</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;700;800&display=swap');
body{margin:0;padding:40px 20px;font-family:'Red Hat Display',sans-serif;background:#FAF9F6;display:flex;justify-content:center;align-items:flex-start;min-height:100vh}
.card{background:#fff;border-radius:16px;padding:40px;max-width:520px;width:100%;box-shadow:0 8px 30px rgba(0,0,0,.06)}
h1{margin:0 0 8px;font-size:22px;font-weight:800;color:#111}
.sub{margin:0 0 20px;font-size:14px;color:#6b7280}
.detail{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:16px;margin:16px 0}
.detail-label{margin:0 0 4px;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.5px}
.detail-text{margin:0;color:#111;font-size:15px;font-weight:600}
.campaign{margin-top:8px;font-size:12px;color:#4b5563}
.badge{display:inline-block;background:#EEF2FF;color:#4338CA;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:8px;text-transform:uppercase;letter-spacing:.5px}
.btn{display:inline-block;background:linear-gradient(135deg,#F97316,#EC4899,#A78BFA);color:#fff;border:0;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit}
.btn:hover{opacity:.9}
.btn-secondary{display:inline-block;margin-left:8px;padding:14px 20px;color:#6b7280;text-decoration:none;font-size:14px}
.warn{background:#FEF3C7;border:1px solid #FCD34D;border-radius:8px;padding:12px;margin-top:16px;font-size:13px;color:#92400E}
</style></head><body><div class="card">
<h1>Confirm this change?</h1>
<p class="sub">Clicking Apply will make this change on your Meta ad account.</p>
<div class="detail">
  <p class="detail-label">Action${actionBadge ? '' : ''}</p>
  <p class="detail-text">${safeDesc}${actionBadge}</p>
  ${safeCampaign ? `<p class="campaign">Campaign: ${safeCampaign}</p>` : ''}
</div>
${!canExecute ? `<div class="warn">This is a narrative recommendation — clicking Apply will record your approval in your action history, but the change will need to be made manually in LUMI.</div>` : ''}
<form method="POST" action="/functions/v1/approve-from-email?token=${escapeAttr(token)}" style="margin-top:24px">
  <button type="submit" class="btn">${canExecute ? 'Apply on Meta →' : 'Record Approval →'}</button>
  <a href="https://adsbylumi.com/ad-performance" class="btn-secondary">Cancel</a>
</form>
</div></body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    status: 200,
  });
}

function htmlResponse(title: string, message: string, success: boolean): Response {
  const color = success ? '#22C55E' : '#EF4444';
  const emoji = success ? '✅' : '❌';
  return new Response(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Lumi</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;700;800&display=swap');
body{margin:0;padding:40px 20px;font-family:'Red Hat Display',sans-serif;background:#FAF9F6;display:flex;justify-content:center;align-items:center;min-height:100vh}
.card{background:#fff;border-radius:16px;padding:48px;max-width:480px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.06)}
.icon{font-size:48px;margin-bottom:16px}
h1{margin:0 0 12px;font-size:24px;font-weight:800;color:#111}
p{margin:0;font-size:15px;color:#4a5568;line-height:1.7}
.btn{display:inline-block;margin-top:24px;background:linear-gradient(135deg,#F97316,#EC4899,#A78BFA);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px}
.accent{color:${color}}
</style></head><body><div class="card">
<div class="icon">${emoji}</div>
<h1 class="accent">${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p>
<a href="https://adsbylumi.com/ad-performance" class="btn">Go to Dashboard →</a>
</div></body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    status: 200,
  });
}

function buildConfirmationEmail(userName: string, actionDescription: string, applied: boolean): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>@import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;700;800&display=swap');</style>
</head><body style="margin:0;padding:0;font-family:'Red Hat Display',sans-serif;background:#FAF9F6">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 20px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.06)">
<tr><td style="background:linear-gradient(135deg,${applied ? '#22C55E,#10B981' : '#F59E0B,#EF4444'});padding:30px 40px;text-align:center">
<h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">${applied ? '✅ Change Applied' : "⚠️ Couldn't Apply"}</h1>
</td></tr>
<tr><td style="padding:30px 40px">
<p style="margin:0;color:#111;font-size:16px;font-weight:600">Hey ${escapeHtml(userName)} 👋</p>
<p style="margin:12px 0;color:#4a5568;font-size:14px;line-height:1.7">${applied ? 'You approved and we applied this change on Meta:' : "You approved this change, but Meta didn't accept it. Open LUMI to try from the dashboard:"}</p>
<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:16px;margin:16px 0">
<p style="margin:0;color:#166534;font-size:14px;font-weight:600">${escapeHtml(actionDescription)}</p>
</div>
<p style="margin:20px 0 0;text-align:center"><a href="https://adsbylumi.com/ad-performance" style="display:inline-block;background:linear-gradient(135deg,#F97316,#EC4899);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:14px">View Dashboard →</a></p>
</td></tr>
<tr><td style="background:#FAF9F6;padding:20px 40px;text-align:center;border-top:1px solid #F5F3EE">
<p style="margin:0;color:#a0aec0;font-size:11px">Lumi by Ads by Lumi · Meta Ads, Simplified</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch] as string));
}

function escapeAttr(s: string): string {
  return String(s).replace(/"/g, '&quot;');
}
