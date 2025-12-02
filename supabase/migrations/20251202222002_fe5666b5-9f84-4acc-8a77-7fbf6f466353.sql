-- Add purpose and kpi_priorities columns to campaign_templates
ALTER TABLE campaign_templates
ADD COLUMN IF NOT EXISTS purpose text,
ADD COLUMN IF NOT EXISTS kpi_priorities jsonb DEFAULT '[]'::jsonb;