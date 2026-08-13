ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS page_excerpt text,
  ADD COLUMN IF NOT EXISTS page_extracted_at timestamptz;