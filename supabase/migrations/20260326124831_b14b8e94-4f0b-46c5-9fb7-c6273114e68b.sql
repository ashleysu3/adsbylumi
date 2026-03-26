ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS kit_access_token text,
ADD COLUMN IF NOT EXISTS kit_refresh_token text,
ADD COLUMN IF NOT EXISTS kit_webhook_id text;