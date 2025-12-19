-- Drop the failed migration function if it exists
DROP FUNCTION IF EXISTS public.migrate_tokens_to_vault();

-- The vault functions are already updated, so we just need to ensure
-- existing tokens will be migrated on next access (lazy migration approach)
-- The get_meta_token function already has fallback to read from old column

-- Let's also update the functions to handle the migration lazily
-- When get_meta_token is called and token is in old column, migrate it to vault

CREATE OR REPLACE FUNCTION public.get_meta_token(p_brand_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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