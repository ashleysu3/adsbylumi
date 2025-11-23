-- Add loved_concepts column to campaign_workspaces table
ALTER TABLE campaign_workspaces 
ADD COLUMN IF NOT EXISTS loved_concepts jsonb DEFAULT '[]'::jsonb;