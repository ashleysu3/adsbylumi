ALTER TABLE public.user_assets
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_assets_brand_id_idx ON public.user_assets(brand_id);

DROP POLICY IF EXISTS "Users can view their own assets" ON public.user_assets;
DROP POLICY IF EXISTS "Users can create their own assets" ON public.user_assets;
DROP POLICY IF EXISTS "Users can update their own assets" ON public.user_assets;
DROP POLICY IF EXISTS "Users can delete their own assets" ON public.user_assets;

CREATE POLICY "Users can view brand-scoped assets"
ON public.user_assets
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND brand_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.brands b
    WHERE b.id = user_assets.brand_id
      AND b.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create brand-scoped assets"
ON public.user_assets
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND brand_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.brands b
    WHERE b.id = user_assets.brand_id
      AND b.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update brand-scoped assets"
ON public.user_assets
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND brand_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.brands b
    WHERE b.id = user_assets.brand_id
      AND b.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND brand_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.brands b
    WHERE b.id = user_assets.brand_id
      AND b.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete brand-scoped assets"
ON public.user_assets
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND brand_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.brands b
    WHERE b.id = user_assets.brand_id
      AND b.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users manage own brand assets" ON public.brand_assets;

CREATE POLICY "Users manage brand-scoped brand assets"
  ON public.brand_assets
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND brand_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.brands b
      WHERE b.id = brand_assets.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND brand_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.brands b
      WHERE b.id = brand_assets.brand_id
        AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ad-photos read all" ON storage.objects;
DROP POLICY IF EXISTS "ad-photos auth upload" ON storage.objects;
DROP POLICY IF EXISTS "ad-photos anon upload" ON storage.objects;
DROP POLICY IF EXISTS "ad-photos users read own" ON storage.objects;
DROP POLICY IF EXISTS "ad-photos users insert own" ON storage.objects;
DROP POLICY IF EXISTS "ad-photos users update own" ON storage.objects;
DROP POLICY IF EXISTS "ad-photos users delete own" ON storage.objects;

CREATE POLICY "ad-photos users read own"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'ad-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ad-photos users insert own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ad-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ad-photos users update own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'ad-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'ad-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ad-photos users delete own"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'ad-photos' AND (storage.foldername(name))[1] = auth.uid()::text);