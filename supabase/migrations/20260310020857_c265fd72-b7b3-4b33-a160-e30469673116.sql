ALTER TABLE public.digest_settings 
  ADD COLUMN IF NOT EXISTS slack_channel_id text,
  ADD COLUMN IF NOT EXISTS report_auto_send boolean DEFAULT false;