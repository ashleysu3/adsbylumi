
-- Create pending_optimizations table
CREATE TABLE public.pending_optimizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.campaign_workspaces(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.optimization_reports(id) ON DELETE SET NULL,
  recommendation_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  meta_action JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  auto_applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);

-- Enable RLS
ALTER TABLE public.pending_optimizations ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own brand's pending optimizations
CREATE POLICY "Users can view their own pending optimizations"
ON public.pending_optimizations FOR SELECT TO authenticated
USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- RLS: Users can update (approve/reject) their own pending optimizations
CREATE POLICY "Users can update their own pending optimizations"
ON public.pending_optimizations FOR UPDATE TO authenticated
USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- RLS: Users can insert pending optimizations for their brands
CREATE POLICY "Users can insert pending optimizations"
ON public.pending_optimizations FOR INSERT TO authenticated
WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- RLS: Users can delete their own pending optimizations
CREATE POLICY "Users can delete their own pending optimizations"
ON public.pending_optimizations FOR DELETE TO authenticated
USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- Add auto_optimize column to digest_settings
ALTER TABLE public.digest_settings ADD COLUMN IF NOT EXISTS auto_optimize BOOLEAN DEFAULT false;
