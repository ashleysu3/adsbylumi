-- Add journey stages and KPI benchmarks columns to campaign_templates
ALTER TABLE public.campaign_templates 
ADD COLUMN IF NOT EXISTS journey_stages JSONB DEFAULT '["grow", "nurture", "convert"]',
ADD COLUMN IF NOT EXISTS kpi_benchmarks JSONB DEFAULT '{}';