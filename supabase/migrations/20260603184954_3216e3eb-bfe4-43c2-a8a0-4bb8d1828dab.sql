CREATE TABLE public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  type text NOT NULL DEFAULT 'single',
  html text,
  copy_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  slide_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  placements jsonb NOT NULL DEFAULT '["feed","story"]'::jsonb,
  needs_photo boolean NOT NULL DEFAULT true,
  style_hint text,
  source_image_url text,
  preview_url text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.templates
  ADD CONSTRAINT templates_type_check CHECK (type IN ('single','carousel')),
  ADD CONSTRAINT templates_status_check CHECK (status IN ('draft','approved','rejected'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read approved templates"
  ON public.templates FOR SELECT
  TO authenticated
  USING (status = 'approved' OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert templates"
  ON public.templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update templates"
  ON public.templates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete templates"
  ON public.templates FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
