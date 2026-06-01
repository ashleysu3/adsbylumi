ALTER TABLE public.partner_access_tokens
  ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS referral_link text;

ALTER TABLE public.partner_access_tokens
  ADD CONSTRAINT partner_trial_days_allowed CHECK (trial_days IN (7, 14, 30));

CREATE OR REPLACE FUNCTION public.get_partner_welcome(p_code text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'partner_display_name', partner_display_name,
    'partner_trial_code', partner_trial_code,
    'partner_title', partner_title,
    'partner_photo_url', partner_photo_url,
    'welcome_message', welcome_message,
    'perks', COALESCE(perks, '[]'::jsonb),
    'support_links', COALESCE(support_links, '[]'::jsonb),
    'recommended_strategies', COALESCE(recommended_strategies, '[]'::jsonb),
    'trial_days', trial_days,
    'referral_link', referral_link
  )
  FROM public.partner_access_tokens
  WHERE partner_trial_code = upper(trim(p_code))
    AND is_active = true
  LIMIT 1;
$function$;