-- Captures name + email from an anonymous ad-first visitor before they
-- convert to a real account, so the ad-pack lead magnet can be emailed
-- to them async. Anonymous sessions are real auth.users rows (is_anonymous
-- = true) with a real uid, so the existing RLS on brands (scoped to
-- user_id = auth.uid()) already covers writes from this flow — no new
-- table or policy needed.
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS lead_email TEXT,
  ADD COLUMN IF NOT EXISTS lead_name TEXT,
  ADD COLUMN IF NOT EXISTS ad_pack_image_url TEXT;
