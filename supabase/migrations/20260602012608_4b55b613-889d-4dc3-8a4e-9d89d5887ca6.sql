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

  -- Show at most 3 highest-impact updates: announcements + features first, then improvements, then fixes.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'title', title, 'body', body, 'category', category, 'created_at', created_at
  ) ORDER BY priority ASC, created_at DESC), '[]'::jsonb)
  INTO v_entries
  FROM (
    SELECT id, title, body, category, created_at,
      CASE category
        WHEN 'announcement' THEN 1
        WHEN 'feature' THEN 2
        WHEN 'improvement' THEN 3
        WHEN 'fix' THEN 4
        ELSE 5
      END AS priority
    FROM public.changelog_entries
    WHERE is_user_visible = true
      AND approval_status = 'approved'
      AND created_at > v_cutoff
    ORDER BY
      CASE category
        WHEN 'announcement' THEN 1
        WHEN 'feature' THEN 2
        WHEN 'improvement' THEN 3
        WHEN 'fix' THEN 4
        ELSE 5
      END ASC,
      created_at DESC
    LIMIT 3
  ) top;

  RETURN jsonb_build_object('entries', v_entries, 'last_seen', v_last);
END;
$function$;