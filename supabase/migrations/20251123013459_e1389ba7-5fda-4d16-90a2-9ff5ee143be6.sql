-- Add creative_feedback column to store user feedback on hated concepts
ALTER TABLE campaign_workspaces 
ADD COLUMN IF NOT EXISTS creative_feedback JSONB DEFAULT '{"hated_concepts": []}'::jsonb;

COMMENT ON COLUMN campaign_workspaces.creative_feedback IS 'Stores user feedback on disliked creative concepts to help AI learn preferences';