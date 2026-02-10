
-- Add moderator to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';

-- Add archive columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
