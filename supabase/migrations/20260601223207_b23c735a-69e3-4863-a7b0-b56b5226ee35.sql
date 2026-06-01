CREATE OR REPLACE FUNCTION public.get_my_partner_portal()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
        WHERE is_user_visible = true
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
$$;

CREATE OR REPLACE FUNCTION public.get_partner_portal_admin(p_partner_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
          FROM public.changelog_entries WHERE is_user_visible = true
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
$$;