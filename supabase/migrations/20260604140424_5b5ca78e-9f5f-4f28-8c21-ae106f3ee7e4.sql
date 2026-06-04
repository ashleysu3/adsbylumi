CREATE TABLE public.brand_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  url text NOT NULL,
  source_url text,
  role text NOT NULL,
  width int,
  height int,
  kept boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_assets TO authenticated;
GRANT ALL ON public.brand_assets TO service_role;

ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own brand assets"
  ON public.brand_assets
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX brand_assets_user_id_idx ON public.brand_assets(user_id);
CREATE INDEX brand_assets_role_idx ON public.brand_assets(role);