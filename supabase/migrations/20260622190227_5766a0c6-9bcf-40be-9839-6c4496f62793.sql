ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS recraft_style_id text,
  ADD COLUMN IF NOT EXISTS recraft_style_updated_at timestamptz;