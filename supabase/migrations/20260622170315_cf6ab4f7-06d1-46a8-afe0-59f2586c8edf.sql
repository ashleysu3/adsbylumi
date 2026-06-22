CREATE TABLE public.recommendation_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  ad_id text,
  recommendation_action text,
  user_action text,
  reason_quick text,
  reason_text text,
  snooze_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendation_overrides TO authenticated;
GRANT ALL ON public.recommendation_overrides TO service_role;

ALTER TABLE public.recommendation_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage overrides for their brands"
ON public.recommendation_overrides
FOR ALL
TO authenticated
USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()))
WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE INDEX idx_recommendation_overrides_brand_ad ON public.recommendation_overrides(brand_id, ad_id);
CREATE INDEX idx_recommendation_overrides_snooze ON public.recommendation_overrides(snooze_until) WHERE snooze_until IS NOT NULL;