ALTER TABLE public.partner_access_tokens
  ADD COLUMN IF NOT EXISTS recommended_features jsonb NOT NULL DEFAULT '[]'::jsonb;