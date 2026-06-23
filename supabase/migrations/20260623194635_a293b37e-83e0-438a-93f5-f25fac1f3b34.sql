ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS guided_onboarding_step int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS guided_onboarding_completed_at timestamptz;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS onboarding_step int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;