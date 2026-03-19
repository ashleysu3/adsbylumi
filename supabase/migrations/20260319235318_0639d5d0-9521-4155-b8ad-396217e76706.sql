
CREATE TABLE public.ad_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.campaign_workspaces(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  action_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'user',
  meta_entity_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_action_log_brand_id ON public.ad_action_log(brand_id);
CREATE INDEX idx_ad_action_log_created_at ON public.ad_action_log(created_at DESC);

ALTER TABLE public.ad_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ad action logs"
  ON public.ad_action_log FOR SELECT
  USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert ad action logs for their brands"
  ON public.ad_action_log FOR INSERT
  WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all ad action logs"
  ON public.ad_action_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
