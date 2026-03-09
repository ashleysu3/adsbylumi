
-- Table 1: campaign_goals
CREATE TABLE public.campaign_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.campaign_workspaces(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  primary_kpi text NOT NULL,
  primary_kpi_label text NOT NULL,
  primary_kpi_goal_type text NOT NULL,
  primary_kpi_threshold numeric NOT NULL,
  secondary_kpi text,
  secondary_kpi_label text,
  secondary_kpi_goal_type text,
  secondary_kpi_threshold numeric,
  frequency_threshold numeric DEFAULT 4,
  check_frequency_at text DEFAULT 'campaign'
);

-- Validation trigger for campaign_goals
CREATE OR REPLACE FUNCTION public.validate_campaign_goals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.primary_kpi_goal_type NOT IN ('less_than', 'greater_than') THEN
    RAISE EXCEPTION 'Invalid primary_kpi_goal_type: %. Must be less_than or greater_than.', NEW.primary_kpi_goal_type;
  END IF;
  IF NEW.secondary_kpi_goal_type IS NOT NULL AND NEW.secondary_kpi_goal_type NOT IN ('less_than', 'greater_than') THEN
    RAISE EXCEPTION 'Invalid secondary_kpi_goal_type: %. Must be less_than or greater_than.', NEW.secondary_kpi_goal_type;
  END IF;
  IF NEW.check_frequency_at NOT IN ('campaign', 'ad', 'both') THEN
    RAISE EXCEPTION 'Invalid check_frequency_at: %. Must be campaign, ad, or both.', NEW.check_frequency_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_campaign_goals_trigger
  BEFORE INSERT OR UPDATE ON public.campaign_goals
  FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_goals();

ALTER TABLE public.campaign_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select own goals" ON public.campaign_goals
  FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Owner can insert goals" ON public.campaign_goals
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owner can update own goals" ON public.campaign_goals
  FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Owner can delete own goals" ON public.campaign_goals
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Table 2: optimization_reports
CREATE TABLE public.optimization_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  date_range_start date NOT NULL,
  date_range_end date NOT NULL,
  report_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb DEFAULT '{}'::jsonb,
  share_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status text DEFAULT 'complete'
);

ALTER TABLE public.optimization_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select own reports" ON public.optimization_reports
  FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Owner can insert reports" ON public.optimization_reports
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owner can update own reports" ON public.optimization_reports
  FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Owner can delete own reports" ON public.optimization_reports
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Security definer function for public access by share_token
CREATE OR REPLACE FUNCTION public.get_shared_report(p_share_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_report jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', r.id,
    'brand_id', r.brand_id,
    'created_at', r.created_at,
    'date_range_start', r.date_range_start,
    'date_range_end', r.date_range_end,
    'report_data', r.report_data,
    'summary', r.summary,
    'status', r.status
  ) INTO v_report
  FROM public.optimization_reports r
  WHERE r.share_token = p_share_token;
  
  RETURN v_report;
END;
$$;

-- Table 3: digest_settings
CREATE TABLE public.digest_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  send_day text NOT NULL DEFAULT 'monday',
  send_time text NOT NULL DEFAULT '08:00',
  timezone text NOT NULL DEFAULT 'America/New_York',
  date_range_days integer NOT NULL DEFAULT 7,
  additional_emails text[] DEFAULT '{}',
  enabled boolean DEFAULT true,
  last_sent_at timestamptz
);

-- Validation trigger for digest_settings
CREATE OR REPLACE FUNCTION public.validate_digest_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.send_day NOT IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday') THEN
    RAISE EXCEPTION 'Invalid send_day: %. Must be a day of the week.', NEW.send_day;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_digest_settings_trigger
  BEFORE INSERT OR UPDATE ON public.digest_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_digest_settings();

ALTER TABLE public.digest_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select own digest settings" ON public.digest_settings
  FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Owner can insert digest settings" ON public.digest_settings
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owner can update own digest settings" ON public.digest_settings
  FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Owner can delete own digest settings" ON public.digest_settings
  FOR DELETE TO authenticated USING (created_by = auth.uid());
