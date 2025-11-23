-- Add campaign builder fields to campaign_workspaces
ALTER TABLE campaign_workspaces 
ADD COLUMN IF NOT EXISTS chat_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS campaign_builder_answers JSONB,
ADD COLUMN IF NOT EXISTS meta_errors JSONB,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_meta_status 
ON campaign_workspaces(meta_campaign_status) 
WHERE meta_campaign_status IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN campaign_workspaces.chat_history IS 'Stores full conversation history for campaign builder chat';
COMMENT ON COLUMN campaign_workspaces.campaign_builder_answers IS 'Structured answers collected during campaign builder flow';
COMMENT ON COLUMN campaign_workspaces.meta_errors IS 'Logs any Meta API errors for troubleshooting';
COMMENT ON COLUMN campaign_workspaces.published_at IS 'Timestamp when campaign was published to Meta';