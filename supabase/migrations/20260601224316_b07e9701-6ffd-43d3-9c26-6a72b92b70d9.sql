-- Separate "marketing ideas" (admin → shown only in partner's portal) from
-- "audience-facing strategies" (admin → shown in the welcome popup their referred users see).

ALTER TABLE public.partner_access_tokens
  ADD COLUMN IF NOT EXISTS audience_strategies jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Seed audience_strategies from the existing recommended_strategies for partners
-- that already had data, so we don't blank out the welcome popup.
UPDATE public.partner_access_tokens
SET audience_strategies = recommended_strategies
WHERE jsonb_typeof(audience_strategies) = 'array'
  AND jsonb_array_length(audience_strategies) = 0
  AND jsonb_typeof(recommended_strategies) = 'array'
  AND jsonb_array_length(recommended_strategies) > 0;

-- Update get_partner_welcome to read from audience_strategies (with fallback).
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
    'audience_strategies', CASE
      WHEN jsonb_typeof(audience_strategies) = 'array' AND jsonb_array_length(audience_strategies) > 0
        THEN audience_strategies
      ELSE COALESCE(recommended_strategies, '[]'::jsonb)
    END,
    'recommended_strategies', COALESCE(recommended_strategies, '[]'::jsonb),
    'trial_days', trial_days,
    'referral_link', referral_link
  )
  FROM public.partner_access_tokens
  WHERE partner_trial_code = upper(trim(p_code))
    AND is_active = true
  LIMIT 1;
$function$;