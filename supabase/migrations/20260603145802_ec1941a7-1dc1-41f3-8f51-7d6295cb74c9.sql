CREATE TABLE public.brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  source_url TEXT,
  colors JSONB,
  fonts JSONB,
  voice JSONB,
  offer JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT brand_kits_user_id_unique UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_kits TO authenticated;
GRANT ALL ON public.brand_kits TO service_role;

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own brand kits"
ON public.brand_kits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own brand kits"
ON public.brand_kits
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brand kits"
ON public.brand_kits
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own brand kits"
ON public.brand_kits
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE public.user_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  original_url TEXT,
  cutout_url TEXT,
  kind TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_assets TO authenticated;
GRANT ALL ON public.user_assets TO service_role;

ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assets"
ON public.user_assets
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assets"
ON public.user_assets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assets"
ON public.user_assets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets"
ON public.user_assets
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_brand_kits_updated_at
BEFORE UPDATE ON public.brand_kits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();