-- Add archive columns to campaign_workspaces
ALTER TABLE campaign_workspaces
ADD COLUMN archived BOOLEAN DEFAULT false,
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;

-- Add index for better query performance
CREATE INDEX idx_campaign_workspaces_archived 
ON campaign_workspaces(archived, brand_id);