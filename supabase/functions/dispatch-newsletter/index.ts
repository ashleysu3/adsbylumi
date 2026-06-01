import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { Resend } from 'npm:resend@2.0.0';
import { getCorsHeaders } from '../_shared/cors.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TRACK_BASE = `${SUPABASE_URL}/functions/v1/newsletter-track`;

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const { campaignId, mode } = body; // mode: 'send' | 'resend'

    if (!campaignId) {
      return new Response(JSON.stringify({ error: 'campaignId required' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Require admin
    const authHeader = req.headers.get('Authorization');
    if (authHeader && !authHeader.includes(SERVICE_KEY)) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: campaign, error: cErr } = await supabase.from('newsletter_campaigns').select('*').eq('id', campaignId).maybeSingle();
    if (cErr || !campaign) return new Response(JSON.stringify({ error: 'Campaign not found' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (mode === 'resend') {
      return await handleResend(supabase, campaign, corsHeaders);
    }

    // SEND mode
    await supabase.from('newsletter_campaigns').update({ status: 'sending' }).eq('id', campaignId);

    // Collect user recipients
    const { data: userProfiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, referral_code')
      .eq('newsletter_opt_in', true)
      .not('email', 'is', null);

    // Collect partner recipients (linked partners)
    const { data: partners } = await supabase
      .from('partner_access_tokens')
      .select('partner_user_id, partner_email')
      .not('partner_user_id', 'is', null)
      .eq('is_active', true);
    const partnerEmails = new Set<string>();
    const partnerLookup: Record<string, any> = {};
    for (const p of partners || []) {
      const { data: pp } = await supabase.from('profiles').select('id, email, full_name').eq('id', p.partner_user_id).maybeSingle();
      if (pp?.email) {
        partnerEmails.add(pp.email.toLowerCase());
        partnerLookup[pp.email.toLowerCase()] = pp;
      } else if (p.partner_email) {
        partnerEmails.add(p.partner_email.toLowerCase());
      }
    }

    let sent = 0, failed = 0;

    // USER sends (skip if recipient is a partner; partners get partner edition)
    for (const u of userProfiles || []) {
      const emailLc = u.email?.toLowerCase();
      if (!emailLc || partnerEmails.has(emailLc)) continue;
      const result = await sendOne(supabase, {
        campaignId, recipientEmail: u.email, recipientUserId: u.id,
        variant: 'user', subject: campaign.user_subject || 'Latest from Lumi',
        html: campaign.user_html || '', referralCode: u.referral_code,
      });
      result ? sent++ : failed++;
    }

    // PARTNER sends
    for (const email of partnerEmails) {
      const pp = partnerLookup[email];
      const result = await sendOne(supabase, {
        campaignId, recipientEmail: email, recipientUserId: pp?.id,
        variant: 'partner', subject: campaign.partner_subject || 'Partner Update from Lumi',
        html: campaign.partner_html || '', referralCode: null,
      });
      result ? sent++ : failed++;
    }

    await supabase.from('newsletter_campaigns').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', campaignId);

    // Auto-publish to partner_updates
    const updateIds = campaign.selected_update_ids || [];
    if (updateIds.length > 0) {
      const { data: entries } = await supabase.from('changelog_entries').select('*').in('id', updateIds);
      for (const e of entries || []) {
        await supabase.from('partner_updates').insert({
          title: e.title, body: e.body, is_published: true, published_at: new Date().toISOString(),
        });
        await supabase.from('changelog_entries').update({ included_in_campaign_id: campaignId }).eq('id', e.id);
      }
    }

    return new Response(JSON.stringify({ success: true, sent, failed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('dispatch-newsletter error:', e);
    return new Response(JSON.stringify({ error: e?.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function sendOne(supabase: any, opts: {
  campaignId: string; recipientEmail: string; recipientUserId?: string;
  variant: 'user' | 'partner'; subject: string; html: string; referralCode?: string | null;
}) {
  try {
    // Idempotency: skip if already sent
    const { data: existing } = await supabase
      .from('newsletter_sends')
      .select('id')
      .eq('campaign_id', opts.campaignId)
      .eq('recipient_email', opts.recipientEmail)
      .eq('variant', opts.variant)
      .maybeSingle();
    if (existing) return true;

    // Insert pending row to get id
    const { data: sendRow, error: insErr } = await supabase
      .from('newsletter_sends')
      .insert({
        campaign_id: opts.campaignId,
        recipient_email: opts.recipientEmail,
        recipient_user_id: opts.recipientUserId,
        variant: opts.variant,
      })
      .select('id').single();
    if (insErr) { console.error('insert send err', insErr); return false; }

    const finalHtml = wrapHtml(opts.html, opts.variant, sendRow.id, opts.referralCode);

    const { data: sendRes, error: emailErr } = await resend.emails.send({
      from: 'Lumi <hello@adsbylumi.com>',
      to: [opts.recipientEmail],
      subject: opts.subject,
      html: finalHtml,
    });

    if (emailErr) {
      console.error('resend err', emailErr);
      return false;
    }

    await supabase.from('newsletter_sends').update({ message_id: sendRes?.id }).eq('id', sendRow.id);
    return true;
  } catch (e) {
    console.error('sendOne err', e);
    return false;
  }
}

async function handleResend(supabase: any, campaign: any, corsHeaders: HeadersInit) {
  const { data: unopened } = await supabase
    .from('newsletter_sends')
    .select('id, recipient_email, recipient_user_id, variant')
    .eq('campaign_id', campaign.id)
    .is('opened_at', null)
    .is('resent_at', null)
    .lt('sent_at', new Date(Date.now() - 48 * 3600 * 1000).toISOString());

  let resent = 0;
  for (const s of unopened || []) {
    const subject = s.variant === 'user'
      ? (campaign.user_resend_subject || campaign.user_subject)
      : (campaign.partner_resend_subject || campaign.partner_subject);
    const html = s.variant === 'user' ? campaign.user_html : campaign.partner_html;
    let referralCode: string | null = null;
    if (s.recipient_user_id) {
      const { data: pp } = await supabase.from('profiles').select('referral_code').eq('id', s.recipient_user_id).maybeSingle();
      referralCode = pp?.referral_code || null;
    }
    const finalHtml = wrapHtml(html || '', s.variant, s.id, referralCode);
    const { data: r, error } = await resend.emails.send({
      from: 'Lumi <hello@adsbylumi.com>',
      to: [s.recipient_email],
      subject: subject || 'A quick follow-up from Lumi',
      html: finalHtml,
    });
    if (!error) {
      await supabase.from('newsletter_sends').update({ resent_at: new Date().toISOString(), resend_message_id: r?.id }).eq('id', s.id);
      resent++;
    }
  }
  return new Response(JSON.stringify({ success: true, resent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function wrapHtml(innerHtml: string, variant: 'user' | 'partner', sendId: string, referralCode: string | null | undefined): string {
  const pixel = `<img src="${TRACK_BASE}?open=${sendId}" width="1" height="1" alt="" style="display:none" />`;

  // Wrap links to track clicks
  const wrappedHtml = innerHtml.replace(/href="(https?:\/\/[^"]+)"/g, (_m, url) =>
    `href="${TRACK_BASE}?click=${sendId}&u=${encodeURIComponent(url)}"`
  );

  let forwardBlock = '';
  if (variant === 'user' && referralCode) {
    const refUrl = `https://adsbylumi.com/?ref=${referralCode}`;
    forwardBlock = `
      <div style="background:#FFF7ED;border-radius:12px;padding:20px;margin:24px 0;text-align:center;border:1px dashed #F97316;">
        <p style="margin:0 0 8px 0;font-weight:700;color:#9A3412;">Know someone who needs Lumi in their life?</p>
        <p style="margin:0 0 12px 0;color:#4a5568;font-size:14px;">Share your link — they get Lumi, you get $40 credit on your next month.</p>
        <a href="${refUrl}" style="display:inline-block;background:linear-gradient(135deg,#F97316,#EC4899);color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;">Share Lumi →</a>
        <p style="margin:12px 0 0 0;font-size:12px;color:#9A3412;font-family:monospace;">${refUrl}</p>
      </div>`;
  }
  const finalInner = wrappedHtml.replace('FOOTER_FORWARD_BLOCK', forwardBlock) +
    (variant === 'user' && !wrappedHtml.includes('FOOTER_FORWARD_BLOCK') ? forwardBlock : '');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF9F6;font-family:'Red Hat Display',-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9F6;padding:30px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
<tr><td style="padding:40px;">${finalInner}</td></tr>
<tr><td style="background:#FAF9F6;padding:22px 40px;text-align:center;border-top:1px solid #F5F3EE;">
<p style="margin:0;color:#a0aec0;font-size:11px;line-height:1.6;">Lumi · Meta Ads, Simplified · adsbylumi.com</p>
</td></tr></table></td></tr></table>${pixel}</body></html>`;
}
