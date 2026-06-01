
CREATE TABLE public.lumi_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  category text NOT NULL DEFAULT 'feature',
  area text,
  short_description text,
  long_description text,
  why_helpful text,
  ideal_audience text,
  status text NOT NULL DEFAULT 'live',
  highlight boolean NOT NULL DEFAULT false,
  tags text[] NOT NULL DEFAULT '{}',
  related_pages text[] NOT NULL DEFAULT '{}',
  marketing_angles text[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  last_updated_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lumi_features TO authenticated;
GRANT ALL ON public.lumi_features TO service_role;

ALTER TABLE public.lumi_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage features"
ON public.lumi_features
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read active features"
ON public.lumi_features
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE TRIGGER trg_lumi_features_updated_at
BEFORE UPDATE ON public.lumi_features
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_lumi_features_sort ON public.lumi_features (sort_order, name);
CREATE INDEX idx_lumi_features_area ON public.lumi_features (area);
