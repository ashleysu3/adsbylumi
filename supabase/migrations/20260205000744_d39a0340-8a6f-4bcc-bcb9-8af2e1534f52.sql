-- Create table for storing user's content assets (testimonials, scripts, etc.)
CREATE TABLE public.brand_content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'testimonials',
    'webinar_scripts', 
    'survey_answers',
    'client_objections',
    'client_questions',
    'other'
  )),
  content TEXT NOT NULL,
  label TEXT,
  offer_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.brand_content_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own brand's assets
CREATE POLICY "Users can view their brand content assets"
  ON public.brand_content_assets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.brands 
    WHERE brands.id = brand_content_assets.brand_id 
    AND brands.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their brand content assets"
  ON public.brand_content_assets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.brands 
    WHERE brands.id = brand_content_assets.brand_id 
    AND brands.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their brand content assets"
  ON public.brand_content_assets FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.brands 
    WHERE brands.id = brand_content_assets.brand_id 
    AND brands.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their brand content assets"
  ON public.brand_content_assets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.brands 
    WHERE brands.id = brand_content_assets.brand_id 
    AND brands.user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_brand_content_assets_updated_at
  BEFORE UPDATE ON public.brand_content_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();