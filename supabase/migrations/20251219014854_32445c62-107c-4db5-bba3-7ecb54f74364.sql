-- Add Instagram account and ad defaults columns to brands table
ALTER TABLE public.brands 
  ADD COLUMN IF NOT EXISTS instagram_account_id text,
  ADD COLUMN IF NOT EXISTS instagram_account_name text,
  ADD COLUMN IF NOT EXISTS multi_advertiser_ads boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS site_links_enabled boolean DEFAULT false;