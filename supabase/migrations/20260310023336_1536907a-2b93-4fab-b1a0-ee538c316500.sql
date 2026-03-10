
CREATE TABLE public.agency_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  logo_url text,
  primary_color text DEFAULT '#6366f1',
  secondary_color text,
  accent_color text,
  company_name text,
  white_label_reports boolean DEFAULT false,
  white_label_portal boolean DEFAULT false,
  custom_footer_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(brand_id)
);

ALTER TABLE public.agency_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agency branding"
  ON public.agency_branding FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM brands WHERE brands.id = agency_branding.brand_id AND brands.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own agency branding"
  ON public.agency_branding FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM brands WHERE brands.id = agency_branding.brand_id AND brands.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own agency branding"
  ON public.agency_branding FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM brands WHERE brands.id = agency_branding.brand_id AND brands.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own agency branding"
  ON public.agency_branding FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM brands WHERE brands.id = agency_branding.brand_id AND brands.user_id = auth.uid()
  ));
