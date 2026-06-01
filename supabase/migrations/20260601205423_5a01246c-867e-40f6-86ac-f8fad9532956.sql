
-- Extend partner_access_tokens with full welcome package fields
ALTER TABLE public.partner_access_tokens
  ADD COLUMN IF NOT EXISTS welcome_message text,
  ADD COLUMN IF NOT EXISTS partner_photo_url text,
  ADD COLUMN IF NOT EXISTS partner_title text,
  ADD COLUMN IF NOT EXISTS support_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recommended_strategies jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Allow admin INSERT/UPDATE/DELETE on partner_access_tokens
DROP POLICY IF EXISTS "Admins can insert partner tokens" ON public.partner_access_tokens;
CREATE POLICY "Admins can insert partner tokens"
  ON public.partner_access_tokens FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update partner tokens" ON public.partner_access_tokens;
CREATE POLICY "Admins can update partner tokens"
  ON public.partner_access_tokens FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete partner tokens" ON public.partner_access_tokens;
CREATE POLICY "Admins can delete partner tokens"
  ON public.partner_access_tokens FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated welcome RPC returns full package
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
    'recommended_strategies', COALESCE(recommended_strategies, '[]'::jsonb)
  )
  FROM public.partner_access_tokens
  WHERE partner_trial_code = upper(trim(p_code))
    AND is_active = true
  LIMIT 1;
$function$;

-- Public storage bucket for partner photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-assets', 'partner-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Partner assets public read" ON storage.objects;
CREATE POLICY "Partner assets public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'partner-assets');

DROP POLICY IF EXISTS "Admins manage partner assets" ON storage.objects;
CREATE POLICY "Admins manage partner assets"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'partner-assets' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'partner-assets' AND has_role(auth.uid(), 'admin'::app_role));
