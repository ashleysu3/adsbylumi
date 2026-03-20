
-- Agency clients scorecard metadata
CREATE TABLE public.agency_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  slack_client_channel text,
  slack_internal_channel text,
  contact_name text,
  contact_email text,
  health_status text NOT NULL DEFAULT 'healthy',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_id)
);

ALTER TABLE public.agency_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agency clients" ON public.agency_clients
  FOR SELECT TO authenticated
  USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert agency clients for their brands" ON public.agency_clients
  FOR INSERT TO authenticated
  WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own agency clients" ON public.agency_clients
  FOR UPDATE TO authenticated
  USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own agency clients" ON public.agency_clients
  FOR DELETE TO authenticated
  USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all agency clients" ON public.agency_clients
  FOR SELECT TO public
  USING (public.has_role(auth.uid(), 'admin'));

-- Review logs for Mon/Thu optimization reviews
CREATE TABLE public.review_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  reviewer_id uuid NOT NULL,
  campaign_metrics jsonb NOT NULL DEFAULT '{}',
  ad_level_data jsonb NOT NULL DEFAULT '{}',
  action_plan text,
  approval_status text NOT NULL DEFAULT 'draft',
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.review_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own review logs" ON public.review_logs
  FOR SELECT TO authenticated
  USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert review logs for their brands" ON public.review_logs
  FOR INSERT TO authenticated
  WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own review logs" ON public.review_logs
  FOR UPDATE TO authenticated
  USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own review logs" ON public.review_logs
  FOR DELETE TO authenticated
  USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all review logs" ON public.review_logs
  FOR SELECT TO public
  USING (public.has_role(auth.uid(), 'admin'));

-- Add last_review_date and next_report_due to brands
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS last_review_date date;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS next_report_due date;
