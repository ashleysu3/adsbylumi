-- Remove the legacy meta_access_token column from brands table
-- Tokens are now securely stored in Supabase Vault via store_meta_token/get_meta_token functions
ALTER TABLE public.brands DROP COLUMN IF EXISTS meta_access_token;