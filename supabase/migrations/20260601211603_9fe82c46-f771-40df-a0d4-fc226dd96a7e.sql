
-- Partner Portal: comp membership + share resources + updates feed

ALTER TABLE public.partner_access_tokens
  ADD COLUMN IF NOT EXISTS partner_user_id uuid,
  ADD COLUMN IF NOT EXISTS partner_email text,
  ADD COLUMN IF NOT EXISTS membership_comped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comped_at timestamptz,
  ADD COLUMN IF NOT EXISTS comped_by uuid,
  ADD COLUMN IF NOT EXISTS share_resources jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_partner_access_tokens_partner_user_id
  ON public.partner_access_tokens(partner_user_id);

-- Partner updates feed (what's new in Lumi)
CREATE TABLE IF NOT EXISTS public.partner_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  link_url text,
  link_label text,
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partner_updates TO authenticated;
GRANT ALL ON public.partner_updates TO service_role;

ALTER TABLE public.partner_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read published partner updates"
ON public.partner_updates FOR SELECT TO authenticated
USING (is_published = true);

CREATE POLICY "Admins manage partner updates"
ON public.partner_updates FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_partner_updates_updated_at
BEFORE UPDATE ON public.partner_updates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allow a linked partner user to read their own row (for portal + banner)
DO $$ BEGIN
  CREATE POLICY "Partner can view own token row"
  ON public.partner_access_tokens FOR SELECT TO authenticated
  USING (partner_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Detect if current user is a comped partner
CREATE OR REPLACE FUNCTION public.is_current_user_comped_partner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partner_access_tokens
    WHERE partner_user_id = auth.uid()
      AND membership_comped = true
      AND is_active = true
  );
$$;

-- Get the partner row for the current user (used by banner + portal)
CREATE OR REPLACE FUNCTION public.get_my_partner_portal()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'partner', to_jsonb(p.*) - 'comped_by',
    'updates', COALESCE((
      SELECT jsonb_agg(to_jsonb(u.*) ORDER BY u.published_at DESC)
      FROM (
        SELECT id, title, body, link_url, link_label, published_at
        FROM public.partner_updates
        WHERE is_published = true
        ORDER BY published_at DESC
        LIMIT 10
      ) u
    ), '[]'::jsonb),
    'config', COALESCE((
      SELECT value FROM public.site_settings WHERE key = 'partner_portal_config'
    ), '{}'::jsonb)
  )
  FROM public.partner_access_tokens p
  WHERE p.partner_user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_comped_partner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_partner_portal() TO authenticated;

-- Admin helper: link a partner row to a user by email
CREATE OR REPLACE FUNCTION public.admin_link_partner_user(p_partner_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No user with that email');
  END IF;

  UPDATE public.partner_access_tokens
    SET partner_user_id = v_user_id,
        partner_email = trim(p_email)
    WHERE id = p_partner_id;

  RETURN jsonb_build_object('success', true, 'partner_user_id', v_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_link_partner_user(uuid, text) TO authenticated;
