import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (s: string, d?: any) => console.log(`[SYNC-PARTNER-PROMO] ${s}${d ? " " + JSON.stringify(d) : ""}`);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabaseAuth.auth.getUser(authHeader.replace("Bearer ", ""));
    const userId = userData.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Admin only" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { partner_id } = await req.json();
    if (!partner_id) return new Response(JSON.stringify({ error: "partner_id required" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: partner, error: pErr } = await admin
      .from("partner_access_tokens")
      .select("id, partner_trial_code, stripe_coupon_id, stripe_promotion_code_id, partner_display_name, email")
      .eq("id", partner_id)
      .maybeSingle();
    if (pErr || !partner) return new Response(JSON.stringify({ error: "Partner not found" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const code = (partner.partner_trial_code || "").toUpperCase().trim();
    if (!code) return new Response(JSON.stringify({ error: "Partner has no trial code set" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    // 1. Ensure coupon (1¢ off once - marker only)
    let couponId = partner.stripe_coupon_id;
    if (couponId) {
      try { await stripe.coupons.retrieve(couponId); } catch { couponId = null; }
    }
    if (!couponId) {
      const coupon = await stripe.coupons.create({
        name: `Partner: ${partner.partner_display_name || code}`,
        amount_off: 1,
        currency: "usd",
        duration: "once",
        metadata: { partner_id: partner.id, partner_code: code },
      });
      couponId = coupon.id;
      log("Coupon created", { couponId, code });
    }

    // 2. Ensure promotion code with the partner trial code as the code string.
    //    If one exists under a different coupon (e.g. stale), deactivate then create new.
    let promoId = partner.stripe_promotion_code_id;
    let promoActiveAndCorrect = false;
    if (promoId) {
      try {
        const existing = await stripe.promotionCodes.retrieve(promoId);
        if (existing.active && existing.code === code && (existing.coupon as any).id === couponId) {
          promoActiveAndCorrect = true;
        } else if (existing.active) {
          await stripe.promotionCodes.update(promoId, { active: false });
        }
      } catch { promoId = null; }
    }

    if (!promoActiveAndCorrect) {
      // Search for any active promo code with same code string
      const list = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
      if (list.data.length > 0 && (list.data[0].coupon as any).id === couponId) {
        promoId = list.data[0].id;
      } else {
        // Deactivate stale matches under other coupons
        for (const p of list.data) {
          try { await stripe.promotionCodes.update(p.id, { active: false }); } catch { /* ignore */ }
        }
        const created = await stripe.promotionCodes.create({
          coupon: couponId,
          code,
          metadata: { partner_id: partner.id, partner_email: partner.email || "" },
        });
        promoId = created.id;
        log("Promotion code created", { promoId, code });
      }
    }

    await admin
      .from("partner_access_tokens")
      .update({
        stripe_coupon_id: couponId,
        stripe_promotion_code_id: promoId,
        stripe_promo_synced_at: new Date().toISOString(),
      })
      .eq("id", partner.id);

    return new Response(JSON.stringify({ success: true, code, stripe_coupon_id: couponId, stripe_promotion_code_id: promoId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    log("ERROR", { message: e.message });
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
