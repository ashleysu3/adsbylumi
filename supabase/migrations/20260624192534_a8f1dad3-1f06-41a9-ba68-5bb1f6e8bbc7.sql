CREATE TABLE public.creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  asset_url text,
  thumb_url text,
  source text NOT NULL DEFAULT 'lab',
  source_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'unused',
  used_in jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_creatives_brand_id ON public.creatives(brand_id);
CREATE INDEX idx_creatives_user_id ON public.creatives(user_id);
CREATE INDEX idx_creatives_type ON public.creatives(type);
CREATE INDEX idx_creatives_status ON public.creatives(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creatives TO authenticated;
GRANT ALL ON public.creatives TO service_role;

ALTER TABLE public.creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their creatives"
ON public.creatives
FOR ALL
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_creatives_updated_at
BEFORE UPDATE ON public.creatives
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();