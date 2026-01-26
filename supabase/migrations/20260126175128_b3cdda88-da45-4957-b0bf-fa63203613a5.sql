-- Fix 1: Remove public access to invite_codes - require authenticated users
-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can validate active codes" ON public.invite_codes;

-- Create a more restrictive policy that only allows authenticated users to validate codes
-- This prevents unauthenticated enumeration while still allowing signup flow validation
CREATE POLICY "Authenticated users can validate active codes"
  ON public.invite_codes FOR SELECT
  TO authenticated
  USING (active = true);

-- Fix 2: Restrict campaign_templates to authenticated users only
-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Templates are viewable by everyone" ON public.campaign_templates;

-- Create policy that only allows authenticated users to view active templates
CREATE POLICY "Authenticated users can view active templates"
  ON public.campaign_templates FOR SELECT
  TO authenticated
  USING (active = true);

-- Fix 3: Add ownership verification to vault token functions
-- These functions use SECURITY DEFINER but didn't verify auth.uid() matches brand owner

-- Update get_meta_token to verify ownership
CREATE OR REPLACE FUNCTION public.get_meta_token(p_brand_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token TEXT;
  v_user_id UUID;
  v_vault_secret_id UUID;
  v_old_token TEXT;
BEGIN
  -- Get brand info
  SELECT user_id INTO v_user_id
  FROM public.brands
  WHERE id = p_brand_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Brand not found';
  END IF;
  
  -- SECURITY FIX: Verify the calling user owns this brand
  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: you do not own this brand';
  END IF;
  
  -- Get the vault secret reference
  SELECT vault_secret_id INTO v_vault_secret_id
  FROM public.brand_vault_secrets
  WHERE brand_id = p_brand_id AND secret_name = 'meta_access_token';
  
  -- If token is in vault, retrieve it
  IF v_vault_secret_id IS NOT NULL THEN
    SELECT decrypted_secret INTO v_token
    FROM vault.decrypted_secrets
    WHERE id = v_vault_secret_id;
    RETURN v_token;
  END IF;
  
  -- Fallback to old column - this means token hasn't been migrated yet
  SELECT meta_access_token INTO v_old_token
  FROM public.brands
  WHERE id = p_brand_id;
  
  -- If there's an old token, migrate it to vault (lazy migration)
  IF v_old_token IS NOT NULL THEN
    -- Insert into vault
    INSERT INTO vault.secrets (secret, name, description)
    VALUES (
      v_old_token,
      'meta_token_' || p_brand_id::text,
      'Meta access token for brand ' || p_brand_id::text
    )
    RETURNING id INTO v_vault_secret_id;
    
    -- Store reference
    INSERT INTO public.brand_vault_secrets (brand_id, secret_name, vault_secret_id)
    VALUES (p_brand_id, 'meta_access_token', v_vault_secret_id);
    
    -- Clear old token
    UPDATE public.brands 
    SET meta_access_token = NULL
    WHERE id = p_brand_id;
    
    RETURN v_old_token;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Update store_meta_token to verify ownership
CREATE OR REPLACE FUNCTION public.store_meta_token(p_brand_id uuid, p_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get brand owner
  SELECT user_id INTO v_user_id
  FROM public.brands
  WHERE id = p_brand_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Brand not found';
  END IF;
  
  -- SECURITY FIX: Verify the calling user owns this brand
  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: you do not own this brand';
  END IF;

  UPDATE public.brands 
  SET meta_access_token = p_token,
      updated_at = NOW()
  WHERE id = p_brand_id;
  
  RETURN p_brand_id;
END;
$function$;

-- Update delete_meta_token to verify ownership
CREATE OR REPLACE FUNCTION public.delete_meta_token(p_brand_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get brand owner
  SELECT user_id INTO v_user_id
  FROM public.brands
  WHERE id = p_brand_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Brand not found';
  END IF;
  
  -- SECURITY FIX: Verify the calling user owns this brand
  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: you do not own this brand';
  END IF;

  UPDATE public.brands 
  SET meta_access_token = NULL,
      updated_at = NOW()
  WHERE id = p_brand_id;
  
  RETURN TRUE;
END;
$function$;