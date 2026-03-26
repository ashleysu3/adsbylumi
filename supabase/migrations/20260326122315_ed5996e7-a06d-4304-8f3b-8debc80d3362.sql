ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS flodesk_api_key text;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS flodesk_webhook_id text;