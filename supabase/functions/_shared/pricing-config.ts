// Resolves the configurable first-month discount into a Stripe coupon,
// creating it on first use. The percent lives in site_settings so it can
// be changed (e.g. for an A/B test) without redeploying either checkout
// function — see supabase/migrations/20260710170000_add_pricing_config.sql.
// deno-lint-ignore-file no-explicit-any

const DEFAULT_DISCOUNT_PERCENT = 50;

export async function resolveDiscountCouponId(
  supabaseAdmin: any,
  stripe: any,
): Promise<{ couponId: string; discountPercent: number }> {
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "pricing_config")
    .maybeSingle();

  const configured = Number((data?.value as any)?.discountPercent);
  const discountPercent =
    Number.isFinite(configured) && configured > 0 && configured < 100
      ? configured
      : DEFAULT_DISCOUNT_PERCENT;

  const couponId = `first-month-${discountPercent}pct-off`;
  try {
    await stripe.coupons.retrieve(couponId);
  } catch {
    await stripe.coupons.create({
      id: couponId,
      percent_off: discountPercent,
      duration: "once",
      name: `${discountPercent}% off first month`,
    });
  }

  return { couponId, discountPercent };
}
