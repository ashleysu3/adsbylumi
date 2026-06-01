import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (s: string, d?: any) => console.log(`[RESOLVE-CHECKOUT-PARTNER] ${s}${d ? " " + JSON.stringify(d) : ""}`);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { session_id } = await req.json();
    if (!session_id || typeof session_id !== "string") {
      return new Response(JSON.stringify({ partner_code: null }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["total_details.breakdown.discounts.discount.promotion_code"],
    });

    // Find a promotion code used on this session
    let promotionCodeId: string | null = null;
    const discounts = (session.total_details as any)?.breakdown?.discounts || [];
    for (const d of discounts) {
      const pc = d?.discount?.promotion_code;
      if (typeof pc === "string") { promotionCodeId = pc; break; }
      if (pc?.id) { promotionCodeId = pc.id; break; }
    }
    if (!promotionCodeId && (session as any).discounts?.length) {
      const first = (session as any).discounts[0];
      promotionCodeId = typeof first.promotion_code === "string" ? first.promotion_code : first.promotion_code?.id || null;
    }

    let codeStr: string | null = null;
    if (promotionCodeId) {
      try {
        const pc = await stripe.promotionCodes.retrieve(promotionCodeId);
        codeStr = pc.code;
      } catch (e: any) { log("promo retrieve failed", { e: e.message }); }
    }

    if (!codeStr) {
      return new Response(JSON.stringify({ partner_code: null }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: partner } = await admin
      .from("partner_access_tokens")
      .select("partner_trial_code")
      .eq("partner_trial_code", codeStr.toUpperCase().trim())
      .eq("is_active", true)
      .maybeSingle();

    if (!partner) {
      return new Response(JSON.stringify({ partner_code: null }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ partner_code: partner.partner_trial_code }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    log("ERROR", { message: e.message });
    return new Response(JSON.stringify({ partner_code: null, error: e.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
