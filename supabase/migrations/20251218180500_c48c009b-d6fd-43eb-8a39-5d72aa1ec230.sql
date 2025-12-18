-- Fix store_meta_token function - remove reference to non-existent meta_access_token column
CREATE OR REPLACE FUNCTION public.store_meta_token(p_brand_id uuid, p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'vault', 'public'
AS $function$
DECLARE
  v_secret_id UUID;
  v_secret_name TEXT;
BEGIN
  -- Generate a unique name for this brand's token
  v_secret_name := 'meta_token_' || p_brand_id::text;
  
  -- Delete any existing secret with this name
  DELETE FROM vault.secrets WHERE name = v_secret_name;
  
  -- Insert new encrypted secret into vault
  INSERT INTO vault.secrets (secret, name, description)
  VALUES (p_token, v_secret_name, 'Meta OAuth access token for brand ' || p_brand_id::text)
  RETURNING id INTO v_secret_id;
  
  RETURN v_secret_id;
END;
$function$;

-- Fix get_meta_token function - remove legacy fallback to non-existent column
CREATE OR REPLACE FUNCTION public.get_meta_token(p_brand_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'vault', 'public'
AS $function$
DECLARE
  v_token TEXT;
  v_secret_name TEXT;
BEGIN
  v_secret_name := 'meta_token_' || p_brand_id::text;
  
  -- Get from vault
  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE name = v_secret_name;
  
  RETURN v_token;
END;
$function$;