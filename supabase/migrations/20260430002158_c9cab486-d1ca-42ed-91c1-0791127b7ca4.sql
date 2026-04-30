-- Cache the full retrospective JSON on the workspace
ALTER TABLE public.campaign_workspaces
  ADD COLUMN IF NOT EXISTS retrospective_json jsonb,
  ADD COLUMN IF NOT EXISTS retrospective_generated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.brand_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  source_workspace_id uuid REFERENCES public.campaign_workspaces(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('win', 'miss', 'recommendation')),
  insight text NOT NULL,
  supporting_data text,
  confidence text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_learnings_brand_active
  ON public.brand_learnings (brand_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_learnings_workspace
  ON public.brand_learnings (source_workspace_id);

ALTER TABLE public.brand_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read learnings for their brands"
  ON public.brand_learnings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_learnings.brand_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users update learnings for their brands"
  ON public.brand_learnings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_learnings.brand_id AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_learnings.brand_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users delete learnings for their brands"
  ON public.brand_learnings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_learnings.brand_id AND b.user_id = auth.uid()
    )
  );