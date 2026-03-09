ALTER TABLE public.digest_settings ADD COLUMN IF NOT EXISTS send_days text[] DEFAULT '{}';

UPDATE public.digest_settings SET send_days = ARRAY[send_day] WHERE send_days = '{}' AND send_day IS NOT NULL;