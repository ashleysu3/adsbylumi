-- Add production_items column to track loved concepts through production workflow
ALTER TABLE campaign_workspaces 
ADD COLUMN IF NOT EXISTS production_items JSONB DEFAULT '[]'::jsonb;