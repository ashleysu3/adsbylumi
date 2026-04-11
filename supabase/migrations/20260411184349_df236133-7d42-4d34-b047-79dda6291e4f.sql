-- Add unique constraint on workspace_id to prevent duplicate goals per campaign
-- First clean up any potential duplicates (keep the latest)
DELETE FROM campaign_goals a
USING campaign_goals b
WHERE a.workspace_id = b.workspace_id
AND a.created_at < b.created_at;

-- Add the unique constraint
ALTER TABLE campaign_goals ADD CONSTRAINT campaign_goals_workspace_id_unique UNIQUE (workspace_id);