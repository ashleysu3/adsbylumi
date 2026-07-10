-- Configurable first-month discount percent, replacing the hardcoded
-- 7-day free trial. Read by create-checkout / create-guest-checkout to
-- resolve which Stripe coupon to apply — change this row's value to
-- A/B test a different percent without a redeploy.
INSERT INTO public.site_settings (key, value)
VALUES ('pricing_config', '{"discountPercent": 50}'::jsonb)
ON CONFLICT (key) DO NOTHING;
