
-- Creative Bench: tracks each creative asset's lifecycle status
CREATE TABLE public.creative_bench (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.campaign_workspaces(id) ON DELETE CASCADE,
  production_item_id TEXT,
  meta_ad_id TEXT,
  status TEXT NOT NULL DEFAULT 'bench' CHECK (status IN ('live', 'bench', 'paused', 'retired', 'retesting')),
  performance_snapshot JSONB DEFAULT '{}'::jsonb,
  auto_rotate_approved BOOLEAN NOT NULL DEFAULT false,
  paused_at TIMESTAMPTZ,
  last_live_at TIMESTAMPTZ,
  retest_eligible_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Creative Rotation Log: audit trail for rotation events
CREATE TABLE public.creative_rotation_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.campaign_workspaces(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_ad_id TEXT,
  new_ad_id TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns to campaign_workspaces
ALTER TABLE public.campaign_workspaces
  ADD COLUMN IF NOT EXISTS auto_rotate_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rotation_preferences JSONB DEFAULT '{"fatigue_frequency_threshold": 4, "retest_cooldown_days": 14, "auto_retest_enabled": false}'::jsonb;

-- RLS for creative_bench
ALTER TABLE public.creative_bench ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own creative bench items"
  ON public.creative_bench FOR SELECT
  USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own creative bench items"
  ON public.creative_bench FOR INSERT
  WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own creative bench items"
  ON public.creative_bench FOR UPDATE
  USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own creative bench items"
  ON public.creative_bench FOR DELETE
  USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- RLS for creative_rotation_log
ALTER TABLE public.creative_rotation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rotation logs"
  ON public.creative_rotation_log FOR SELECT
  USING (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own rotation logs"
  ON public.creative_rotation_log FOR INSERT
  WITH CHECK (brand_id IN (SELECT id FROM public.brands WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_creative_bench_workspace ON public.creative_bench(workspace_id);
CREATE INDEX idx_creative_bench_brand ON public.creative_bench(brand_id);
CREATE INDEX idx_creative_bench_status ON public.creative_bench(status);
CREATE INDEX idx_creative_rotation_log_workspace ON public.creative_rotation_log(workspace_id);
