// Shared server-side paywall check for premium AI edge functions.
// Allows: active/trialing subscribers, agency users, comped partners.
// Returns null when allowed, or a Response (HTTP 402) when blocked.

import { createClient } from "npm:@supabase/supabase-js@2";

export interface PaywallOptions {
  corsHeaders: Record<string, string>;
}

export async function requireActiveSubscription(
  userId: string,
  { corsHeaders }: PaywallOptions,
): Promise<Response | null> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // 1. Agency users bypass
    const { data: profile } = await admin
      .from("profiles")
      .select("is_agency_user")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.is_agency_user === true) return null;

    // 2. Admin role bypass
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (isAdmin === true) return null;

    // 3. Active/trialing subscription
    const { data: sub } = await admin
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (sub) return null;

    // 4. Comped partner
    const { data: partner } = await admin
      .from("partner_access_tokens")
      .select("id")
      .eq("partner_user_id", userId)
      .eq("membership_comped", true)
      .eq("is_active", true)
      .maybeSingle();

    if (partner) return null;

    // Blocked
    return new Response(
      JSON.stringify({
        error: "subscription_required",
        message:
          "An active subscription is required to use this feature. Please upgrade to continue.",
      }),
      {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("[check-subscription] error", e);
    // Fail-closed: block on errors to protect AI credits.
    return new Response(
      JSON.stringify({
        error: "subscription_check_failed",
        message: "Could not verify subscription. Please try again.",
      }),
      {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
