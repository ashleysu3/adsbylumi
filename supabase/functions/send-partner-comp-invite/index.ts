import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (s: string, d?: any) => console.log(`[PARTNER-COMP-INVITE] ${s}${d ? " " + JSON.stringify(d) : ""}`);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" });

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabaseAuth.auth.getUser(authHeader.replace("Bearer ", ""));
    const userId = userData.user?.id;
    if (!userId) return json({ error: "Unauthorized" });

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Admin only" });

    const { email, first_name, partner_id, custom_message } = await req.json();
    if (!email || !partner_id) return json({ error: "email and partner_id are required" });

    const signupUrl = `https://adsbylumi.com/auth?email=${encodeURIComponent(email)}&intent=partner_comp&partner=${partner_id}`;
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const firstName = first_name || "there";

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#FAF9F6;font-family:'Red Hat Display',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9F6;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
      <tr><td style="height:4px;background:linear-gradient(90deg,#F97316,#EC4899,#A78BFA,#93C5FD);"></td></tr>
      <tr><td style="padding:32px 40px 8px;">
        <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;color:#fff;background:linear-gradient(135deg,#F97316,#EC4899);letter-spacing:0.5px;">PARTNER GIFT</span>
        <h1 style="margin:16px 0 8px;font-size:26px;font-weight:800;color:#111;line-height:1.3;">${firstName}, your Lumi account is on us 🎁</h1>
        <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.7;">
          As a thank-you for being a Lumi partner, we'd love to comp your Lumi membership so you can use the same tools you're sharing with your audience.
        </p>
        ${custom_message ? `<div style="margin:0 0 20px;padding:16px 20px;background:#FFF7ED;border-radius:10px;border-left:4px solid #F97316;"><p style="margin:0;font-size:14px;color:#333;line-height:1.7;font-style:italic;">"${custom_message}"</p></div>` : ""}
        <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
          Create your account with this email (${email}) and we'll upgrade you to a comped Agency-tier membership automatically.
        </p>
      </td></tr>
      <tr><td style="padding:0 40px 32px;" align="center">
        <a href="${signupUrl}" style="display:inline-block;padding:14px 40px;border-radius:10px;font-size:15px;font-weight:700;color:#fff;background:linear-gradient(135deg,#F97316,#EC4899);text-decoration:none;">
          Claim Your Free Lumi Account →
        </a>
      </td></tr>
      <tr><td style="padding:0 40px 32px;font-size:12px;color:#999;text-align:center;">
        Questions? Just reply to this email.
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;

    const { error: sendErr } = await resend.emails.send({
      from: "LUMI Partners <hello@adsbylumi.com>",
      to: [email],
      subject: `${firstName}, your Lumi account is on us 🎁`,
      html,
    });
    if (sendErr) {
      log("send error", { msg: (sendErr as any)?.message });
      return json({ error: (sendErr as any)?.message || "Failed to send" });
    }

    return json({ success: true });
  } catch (e: any) {
    log("ERROR", { message: e.message });
    return json({ error: e.message || String(e) });
  }
});
