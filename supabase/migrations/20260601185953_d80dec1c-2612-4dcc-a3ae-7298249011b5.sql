ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS voice_profile JSONB,
ADD COLUMN IF NOT EXISTS voice_profile_generated_at TIMESTAMPTZ;