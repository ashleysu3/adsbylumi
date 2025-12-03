-- Add selected_copy column to campaign_workspaces for storing copy selections
ALTER TABLE public.campaign_workspaces 
ADD COLUMN IF NOT EXISTS selected_copy jsonb DEFAULT '{}'::jsonb;