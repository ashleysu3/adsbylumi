CREATE OR REPLACE FUNCTION public.lumi_feature_to_changelog()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_title text;
  v_body text;
  v_category text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_category := 'feature';
    -- Outcome-led placeholder; admin rewrites in /admin/updates before approving.
    v_title := left(COALESCE(NEW.why_helpful, NEW.short_description, NEW.name, 'New way to make ads easier'), 120);
    v_body := COALESCE(NEW.why_helpful, NEW.short_description, 'Rewrite this in outcome language (what changes for the creator) before approving.') ||
              E'\n\n(Auto-drafted from features catalog: ' || COALESCE(NEW.name, '') || '. Rewrite title + body to lead with the creator''s win, not the feature name.)';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.name IS NOT DISTINCT FROM OLD.name
       AND NEW.short_description IS NOT DISTINCT FROM OLD.short_description
       AND NEW.why_helpful IS NOT DISTINCT FROM OLD.why_helpful THEN
      RETURN NEW;
    END IF;
    v_category := 'improvement';
    v_title := left(COALESCE(NEW.why_helpful, NEW.short_description, NEW.name, 'Smoother experience inside Lumi'), 120);
    v_body := COALESCE(NEW.why_helpful, NEW.short_description, 'Rewrite this in outcome language before approving.') ||
              E'\n\n(Auto-drafted from features catalog: ' || COALESCE(NEW.name, '') || '. Rewrite to lead with the creator''s win.)';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.changelog_entries (title, body, category, approval_status, source, is_user_visible)
  VALUES (v_title, v_body, v_category, 'draft', 'features_catalog', true);

  RETURN NEW;
END;
$function$;