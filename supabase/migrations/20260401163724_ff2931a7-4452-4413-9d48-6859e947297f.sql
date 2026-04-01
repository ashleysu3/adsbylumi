
CREATE OR REPLACE FUNCTION public.delete_meta_token(p_brand_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_vault_secret_id UUID;
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

  -- Delete vault entry if it exists
  SELECT vault_secret_id INTO v_vault_secret_id
  FROM public.brand_vault_secrets
  WHERE brand_id = p_brand_id AND secret_name = 'meta_access_token';

  IF v_vault_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_vault_secret_id;
    DELETE FROM public.brand_vault_secrets
      WHERE brand_id = p_brand_id AND secret_name = 'meta_access_token';
  END IF;

  -- Clear token and ALL meta fields from brands table
  UPDATE public.brands 
  SET meta_access_token = NULL,
      meta_token_expires_at = NULL,
      updated_at = NOW()
  WHERE id = p_brand_id;
  
  RETURN TRUE;
END;
$function$;
