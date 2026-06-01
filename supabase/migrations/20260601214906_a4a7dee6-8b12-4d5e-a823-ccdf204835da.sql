ALTER TABLE public.partner_access_tokens
  ADD COLUMN IF NOT EXISTS stripe_coupon_id text,
  ADD COLUMN IF NOT EXISTS stripe_promotion_code_id text,
  ADD COLUMN IF NOT EXISTS stripe_promo_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_partner_access_tokens_stripe_promo
  ON public.partner_access_tokens(stripe_promotion_code_id);