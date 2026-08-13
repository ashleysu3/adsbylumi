import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Does this email already belong to a real (non-anonymous) LUMI account?
// Used by the Ad Kit save flow to decide between "log in and we'll pull this
// kit into your account" and "we'll email it to you".
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email || !email.includes("@") || email.length > 255) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .limit(1);

    if (error) throw error;

    return new Response(JSON.stringify({ exists: (data ?? []).length > 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("check-account-exists error", err);
    // Never block the save flow on this lookup — treat unknown as "no account".
    return new Response(JSON.stringify({ exists: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
