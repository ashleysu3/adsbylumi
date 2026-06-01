ALTER TABLE public.partner_access_tokens
  ADD COLUMN IF NOT EXISTS partner_display_name TEXT,
  ADD COLUMN IF NOT EXISTS perks JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.get_partner_welcome(p_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'partner_display_name', partner_display_name,
    'partner_trial_code', partner_trial_code,
    'perks', COALESCE(perks, '[]'::jsonb)
  )
  FROM public.partner_access_tokens
  WHERE partner_trial_code = upper(trim(p_code))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_welcome(text) TO anon, authenticated;

INSERT INTO public.partner_access_tokens (email, partner_trial_code, partner_display_name, perks)
VALUES (
  'ashley@adsbylumi.com',
  'ASHLEY',
  'Ashley Ebert',
  '[
    {"title": "30-Minute 1:1 Setup Call", "description": "A private onboarding call to get your first campaign live, fast."},
    {"title": "Weekly Office Hours", "description": "Drop-in Q&A every Monday at 10am EST on Google Meet."}
  ]'::jsonb
)
ON CONFLICT (partner_trial_code)
DO UPDATE SET
  partner_display_name = EXCLUDED.partner_display_name,
  perks = EXCLUDED.perks;