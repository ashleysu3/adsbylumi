-- Create user_alerts table for in-app notifications
CREATE TABLE IF NOT EXISTS public.user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'meta_token_expiring', 'meta_token_expired', 'meta_token_invalid', etc.
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'error'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT, -- Optional URL to navigate to
  action_label TEXT, -- Optional button label
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Auto-expire old alerts
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying user's active alerts
CREATE INDEX IF NOT EXISTS user_alerts_user_active_idx 
  ON public.user_alerts (user_id, dismissed_at, expires_at) 
  WHERE dismissed_at IS NULL;

-- Index for brand-specific alerts
CREATE INDEX IF NOT EXISTS user_alerts_brand_idx 
  ON public.user_alerts (brand_id, type) 
  WHERE dismissed_at IS NULL;

-- Enable RLS
ALTER TABLE public.user_alerts ENABLE ROW LEVEL SECURITY;

-- Users can read their own alerts
CREATE POLICY "Users can view own alerts"
ON public.user_alerts
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update (dismiss) their own alerts
CREATE POLICY "Users can update own alerts"
ON public.user_alerts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own alerts
CREATE POLICY "Users can delete own alerts"
ON public.user_alerts
FOR DELETE
USING (auth.uid() = user_id);