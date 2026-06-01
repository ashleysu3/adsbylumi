ALTER TABLE public.partner_access_tokens
  ADD COLUMN IF NOT EXISTS partner_application_id uuid REFERENCES public.partner_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rewardful_affiliate_id text;

CREATE INDEX IF NOT EXISTS idx_partner_access_tokens_application_id
  ON public.partner_access_tokens(partner_application_id);

-- Backfill: link existing partner rows to applications when emails match
UPDATE public.partner_access_tokens p
SET partner_application_id = a.id,
    rewardful_affiliate_id = COALESCE(p.rewardful_affiliate_id, a.rewardful_affiliate_id)
FROM public.partner_applications a
WHERE p.partner_application_id IS NULL
  AND lower(coalesce(p.partner_email, p.email)) = lower(a.email)
  AND a.application_type = 'partner';