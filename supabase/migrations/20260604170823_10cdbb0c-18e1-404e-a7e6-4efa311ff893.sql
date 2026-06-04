
ALTER TABLE public.brand_assets
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS brand_assets_brand_id_idx ON public.brand_assets(brand_id);

DROP POLICY IF EXISTS "Users manage own brand assets" ON public.brand_assets;

CREATE POLICY "Users manage own brand assets"
  ON public.brand_assets
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND (
      brand_id IS NULL
      OR EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.user_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND brand_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.user_id = auth.uid())
  );
