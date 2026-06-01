import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { audience, message } = await req.json();
    if (!message || typeof message !== "string" || message.length < 5) {
      return new Response(JSON.stringify({ error: "Message required" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Confirm caller is an active partner
    const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: partner } = await service
      .from("partner_access_tokens")
      .select("partner_display_name, partner_email, partner_trial_code")
      .eq("partner_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!partner) {
      return new Response(JSON.stringify({ error: "Not a partner" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve recipient
    const { data: cfg } = await service.from("site_settings").select("value").eq("key", "partner_portal_config").maybeSingle();
    const config: any = cfg?.value || {};
    const to = config.webinar_request_to || config.owner_email;

    if (!to) {
      return new Response(JSON.stringify({ error: "No recipient configured" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Email not configured" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const html = `
      <h2>Joint webinar request from ${partner.partner_display_name || partner.partner_trial_code}</h2>
      <p><strong>Partner email:</strong> ${user.email || partner.partner_email || "—"}</p>
      <p><strong>Audience:</strong> ${audience || "—"}</p>
      <p><strong>Message:</strong></p>
      <p style="white-space: pre-wrap;">${String(message).replace(/</g, "&lt;")}</p>
    `;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Lumi Partners <partners@adsbylumi.com>",
        to: [to],
        reply_to: user.email,
        subject: `Partner webinar request — ${partner.partner_display_name || partner.partner_trial_code}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errTxt = await emailRes.text();
      return new Response(JSON.stringify({ error: "Email send failed", detail: errTxt }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
