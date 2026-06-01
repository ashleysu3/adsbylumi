
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
  END
  FROM public.partner_access_tokens p
  WHERE p.id = p_partner_id
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_partner_portal_admin(uuid) TO authenticated;
