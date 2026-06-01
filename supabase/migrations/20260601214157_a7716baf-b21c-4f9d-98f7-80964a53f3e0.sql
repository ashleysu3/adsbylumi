
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_updates_at timestamptz;
ALTER TABLE public.changelog_entries ADD COLUMN IF NOT EXISTS is_user_visible boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_whats_new()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE is_user_visible = true AND created_at > v_cutoff
  LIMIT 20;

  RETURN jsonb_build_object('entries', v_entries, 'last_seen', v_last);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_updates_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.profiles SET last_seen_updates_at = now() WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_whats_new() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_updates_seen() TO authenticated;
