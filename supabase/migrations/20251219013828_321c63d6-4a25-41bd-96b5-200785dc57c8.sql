-- Add Meta Pixel tracking fields to brands table
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS meta_pixel_id text,
ADD COLUMN IF NOT EXISTS meta_pixel_name text,
ADD COLUMN IF NOT EXISTS meta_pixel_verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS meta_pixel_events jsonb DEFAULT '{}'::jsonb;