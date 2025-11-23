-- Add performance tracking columns to campaign_workspaces
ALTER TABLE campaign_workspaces
ADD COLUMN IF NOT EXISTS performance_history jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS performance_report_latest jsonb,
ADD COLUMN IF NOT EXISTS performance_reports jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS weekly_report_draft text,
ADD COLUMN IF NOT EXISTS meta_insights_last_sync timestamp with time zone;