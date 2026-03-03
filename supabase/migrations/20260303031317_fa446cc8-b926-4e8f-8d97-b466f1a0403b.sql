
CREATE TABLE public.weekly_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  date_range_start date NOT NULL,
  date_range_end date NOT NULL,
  report_text text NOT NULL,
  metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendations_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  campaign_statuses jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own brand reports"
ON public.weekly_reports FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.brands
  WHERE brands.id = weekly_reports.brand_id AND brands.user_id = auth.uid()
));

CREATE POLICY "Users can insert reports for their brands"
ON public.weekly_reports FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.brands
  WHERE brands.id = weekly_reports.brand_id AND brands.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own brand reports"
ON public.weekly_reports FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.brands
  WHERE brands.id = weekly_reports.brand_id AND brands.user_id = auth.uid()
));

CREATE POLICY "Admins can view all reports"
ON public.weekly_reports FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_weekly_reports_brand_id ON public.weekly_reports(brand_id);
CREATE INDEX idx_weekly_reports_date ON public.weekly_reports(brand_id, date_range_end DESC);
