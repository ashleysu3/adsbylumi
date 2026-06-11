// Shared server-side paywall check for premium AI edge functions.
// Validates the caller's JWT and ensures they are a paid/comped user.
// Allowed: active/trialing subscribers, agency users, admin role, comped active partners.
// Returns { userId } on success, or a Response (HTTP 401/402) on failure
// which the caller should return immediately.

import { createClient } from "npm:@supabase/supabase-js@2";

export interface GateResult {
  userId: string | null;
  blocked: Response | null;
}

export async function requirePaidUser(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<GateResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      userId: null,
      blocked: new Response(
        JSON.stringify({ error: "unauthorized", message: "Missing authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  const token = authHeader.replace("Bearer ", "");

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  let userId: string | null = null;
  try {
    const { data: claimsData } = await userClient.auth.getClaims(token);
    userId = claimsData?.claims?.sub ?? null;
    if (!userId) {
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id ?? null;
    }
  } catch (_) {
    userId = null;
  }

  if (!userId) {
    return {
      userId: null,
      blocked: new Response(
        JSON.stringify({ error: "unauthorized", message: "Invalid or expired session." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: profile } = await admin
      .from("profiles")
      .select("is_agency_user")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.is_agency_user === true) return { userId, blocked: null };

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (isAdmin === true) return { userId, blocked: null };

    const { data: sub } = await admin
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .maybeSingle();
    if (sub) return { userId, blocked: null };

    const { data: partner } = await admin
      .from("partner_access_tokens")
      .select("id")
      .eq("partner_user_id", userId)
      .eq("membership_comped", true)
      .eq("is_active", true)
      .maybeSingle();
    if (partner) return { userId, blocked: null };

    return {
      userId,
      blocked: new Response(
        JSON.stringify({
          error: "subscription_required",
          message:
            "An active subscription is required to use this feature. Please upgrade to continue.",
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  } catch (e) {
    console.error("[requirePaidUser] error", e);
    return {
      userId,
      blocked: new Response(
        JSON.stringify({
          error: "subscription_check_failed",
          message: "Could not verify your subscription. Please try again.",
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }
}
