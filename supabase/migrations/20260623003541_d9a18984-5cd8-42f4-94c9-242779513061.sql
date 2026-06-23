
ALTER TABLE public.campaign_goals
  ADD COLUMN IF NOT EXISTS tertiary_kpi text,
  ADD COLUMN IF NOT EXISTS tertiary_kpi_label text,
  ADD COLUMN IF NOT EXISTS tertiary_kpi_goal_type text,
  ADD COLUMN IF NOT EXISTS tertiary_kpi_threshold numeric;

CREATE OR REPLACE FUNCTION public.validate_campaign_goals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.primary_kpi_goal_type NOT IN ('less_than', 'greater_than') THEN
    RAISE EXCEPTION 'Invalid primary_kpi_goal_type: %. Must be less_than or greater_than.', NEW.primary_kpi_goal_type;
  END IF;
  IF NEW.secondary_kpi_goal_type IS NOT NULL AND NEW.secondary_kpi_goal_type NOT IN ('less_than', 'greater_than') THEN
    RAISE EXCEPTION 'Invalid secondary_kpi_goal_type: %. Must be less_than or greater_than.', NEW.secondary_kpi_goal_type;
  END IF;
  IF NEW.tertiary_kpi_goal_type IS NOT NULL AND NEW.tertiary_kpi_goal_type NOT IN ('less_than', 'greater_than') THEN
    RAISE EXCEPTION 'Invalid tertiary_kpi_goal_type: %. Must be less_than or greater_than.', NEW.tertiary_kpi_goal_type;
  END IF;
  IF NEW.check_frequency_at NOT IN ('campaign', 'ad', 'both') THEN
    RAISE EXCEPTION 'Invalid check_frequency_at: %. Must be campaign, ad, or both.', NEW.check_frequency_at;
  END IF;
  RETURN NEW;
END;
$function$;
