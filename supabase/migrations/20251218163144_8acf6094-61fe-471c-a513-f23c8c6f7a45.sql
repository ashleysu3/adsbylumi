-- Add notification preferences and alert thresholds to brands table
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"weekly_digest": true, "critical_alerts": true, "performance_drops": true}'::jsonb,
ADD COLUMN IF NOT EXISTS alert_thresholds jsonb DEFAULT '{"ctr_warning": 0.8, "ctr_critical": 0.5, "roas_warning": 1.5, "roas_critical": 1.0, "frequency_warning": 4, "frequency_critical": 6}'::jsonb,
ADD COLUMN IF NOT EXISTS meta_token_expires_at timestamp with time zone;