ALTER TABLE public.stock_broll_clips
  ADD COLUMN IF NOT EXISTS credit_name text,
  ADD COLUMN IF NOT EXISTS credit_url text;