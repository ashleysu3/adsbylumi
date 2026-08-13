CREATE TABLE public.demo_pinned_ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  label TEXT,
  template TEXT,
  copy JSONB,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.demo_pinned_ads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_pinned_ads TO authenticated;
GRANT ALL ON public.demo_pinned_ads TO service_role;

ALTER TABLE public.demo_pinned_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active pinned demo ads"
  ON public.demo_pinned_ads FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can view all pinned demo ads"
  ON public.demo_pinned_ads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert pinned demo ads"
  ON public.demo_pinned_ads FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pinned demo ads"
  ON public.demo_pinned_ads FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pinned demo ads"
  ON public.demo_pinned_ads FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_demo_pinned_ads_updated_at
  BEFORE UPDATE ON public.demo_pinned_ads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();