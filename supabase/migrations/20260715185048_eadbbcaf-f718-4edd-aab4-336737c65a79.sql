ALTER TABLE public.campaign_workspaces
  ADD COLUMN IF NOT EXISTS approved_copy_signature TEXT,
  ADD COLUMN IF NOT EXISTS approved_copy_at TIMESTAMPTZ;