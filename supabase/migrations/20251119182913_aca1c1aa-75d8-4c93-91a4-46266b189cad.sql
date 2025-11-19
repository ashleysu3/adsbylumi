-- Create campaign_workspaces table
CREATE TABLE public.campaign_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.campaign_templates(id) ON DELETE SET NULL,
  strategy_id UUID REFERENCES public.strategies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  strategy_json JSONB,
  creative_json JSONB,
  offer_name TEXT,
  offer_url TEXT,
  offer_price TEXT,
  offer_description TEXT,
  progress_status TEXT NOT NULL DEFAULT 'draft',
  user_uploaded_assets JSONB DEFAULT '[]'::jsonb,
  production_checklist JSONB,
  meta_campaign_status TEXT,
  meta_campaign_ids JSONB,
  final_answers JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_workspaces ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view workspaces for their brands"
  ON public.campaign_workspaces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = campaign_workspaces.brand_id
      AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert workspaces for their brands"
  ON public.campaign_workspaces
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = campaign_workspaces.brand_id
      AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update workspaces for their brands"
  ON public.campaign_workspaces
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = campaign_workspaces.brand_id
      AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete workspaces for their brands"
  ON public.campaign_workspaces
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = campaign_workspaces.brand_id
      AND brands.user_id = auth.uid()
    )
  );

-- Update trigger for updated_at
CREATE TRIGGER update_campaign_workspaces_updated_at
  BEFORE UPDATE ON public.campaign_workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for better performance
CREATE INDEX idx_campaign_workspaces_brand_id ON public.campaign_workspaces(brand_id);
CREATE INDEX idx_campaign_workspaces_progress_status ON public.campaign_workspaces(progress_status);