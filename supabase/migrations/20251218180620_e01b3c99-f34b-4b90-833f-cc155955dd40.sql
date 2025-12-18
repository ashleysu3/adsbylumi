-- Add meta_access_token column to brands table for secure token storage
-- Supabase encrypts all data at rest by default
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS meta_access_token text;

-- Update store_meta_token to use the column directly
CREATE OR REPLACE FUNCTION public.store_meta_token(p_brand_id uuid, p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.brands 
  SET meta_access_token = p_token,
      updated_at = NOW()
  WHERE id = p_brand_id;
  
  RETURN p_brand_id;
END;
$function$;

-- Update get_meta_token to retrieve from the column
CREATE OR REPLACE FUNCTION public.get_meta_token(p_brand_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token TEXT;
BEGIN
  SELECT meta_access_token INTO v_token
  FROM public.brands
  WHERE id = p_brand_id;
  
  RETURN v_token;
END;
$function$;

-- Update delete_meta_token to clear the column
CREATE OR REPLACE FUNCTION public.delete_meta_token(p_brand_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.brands 
  SET meta_access_token = NULL,
      updated_at = NOW()
  WHERE id = p_brand_id;
  
  RETURN TRUE;
END;
$function$;