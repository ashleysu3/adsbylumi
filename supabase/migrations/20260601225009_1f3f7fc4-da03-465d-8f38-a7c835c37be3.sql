-- Add approval workflow columns
ALTER TABLE public.changelog_entries
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS commit_refs jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Validate approval_status values
DO $$ BEGIN
  ALTER TABLE public.changelog_entries
    ADD CONSTRAINT changelog_entries_approval_status_check
    CHECK (approval_status IN ('draft','approved','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_changelog_entries_approval_status
  ON public.changelog_entries(approval_status, created_at DESC);

-- Hide drafts from end-user "What's new"
CREATE OR REPLACE FUNCTION public.get_whats_new()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_last timestamptz;
  v_cutoff timestamptz;
  v_entries jsonb;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('entries', '[]'::jsonb); END IF;
  SELECT last_seen_updates_at INTO v_last FROM public.profiles WHERE id = v_user;
  v_cutoff := COALESCE(v_last, now() - interval '30 days');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'title', title, 'body', body, 'category', category, 'created_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_entries
  FROM public.changelog_entries
  WHERE is_user_visible = true
    AND approval_status = 'approved'
    AND created_at > v_cutoff
  LIMIT 20;

  RETURN jsonb_build_object('entries', v_entries, 'last_seen', v_last);
END;
$function$;

-- Hide drafts from partner portal
CREATE OR REPLACE FUNCTION public.get_my_partner_portal()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'partner', to_jsonb(p.*) - 'comped_by',
    'updates', COALESCE((
      SELECT jsonb_agg(item ORDER BY (item->>'published_at') DESC)
      FROM (
        (SELECT jsonb_build_object(
          'id', id::text, 'title', title, 'body', body,
          'link_url', link_url, 'link_label', link_label,
          'published_at', published_at, 'source', 'partner_update'
        ) AS item
        FROM public.partner_updates
        WHERE is_published = true
        ORDER BY published_at DESC LIMIT 10)
        UNION ALL
        (SELECT jsonb_build_object(
          'id', id::text, 'title', title, 'body', body,
          'link_url', NULL, 'link_label', NULL,
          'published_at', created_at, 'source', 'changelog', 'category', category
        ) AS item
        FROM public.changelog_entries
        WHERE is_user_visible = true AND approval_status = 'approved'
        ORDER BY created_at DESC LIMIT 15)
      ) merged
    ), '[]'::jsonb),
    'config', COALESCE((
      SELECT value FROM public.site_settings WHERE key = 'partner_portal_config'
    ), '{}'::jsonb)
  )
  FROM public.partner_access_tokens p
  WHERE p.partner_user_id = auth.uid()
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_partner_portal_admin(p_partner_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN
    jsonb_build_object(
      'partner', to_jsonb(p.*) - 'comped_by',
      'updates', COALESCE((
        SELECT jsonb_agg(item ORDER BY (item->>'published_at') DESC)
        FROM (
          (SELECT jsonb_build_object(
            'id', id::text, 'title', title, 'body', body,
            'link_url', link_url, 'link_label', link_label,
            'published_at', published_at, 'source', 'partner_update'
          ) AS item
          FROM public.partner_updates WHERE is_published = true
          ORDER BY published_at DESC LIMIT 10)
          UNION ALL
          (SELECT jsonb_build_object(
            'id', id::text, 'title', title, 'body', body,
            'link_url', NULL, 'link_label', NULL,
            'published_at', created_at, 'source', 'changelog', 'category', category
          ) AS item
          FROM public.changelog_entries
          WHERE is_user_visible = true AND approval_status = 'approved'
          ORDER BY created_at DESC LIMIT 15)
        ) merged
      ), '[]'::jsonb),
      'config', COALESCE((
        SELECT value FROM public.site_settings WHERE key = 'partner_portal_config'
      ), '{}'::jsonb)
    )
  END
  FROM public.partner_access_tokens p
  WHERE p.id = p_partner_id
  LIMIT 1;
$function$;