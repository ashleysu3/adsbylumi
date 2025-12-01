-- Add page_id column to brands table for storing the Facebook Page ID
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS page_id text;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS page_name text;