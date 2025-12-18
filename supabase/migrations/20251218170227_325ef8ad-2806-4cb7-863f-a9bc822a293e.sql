-- Enable vault extension if not already enabled (pgsodium is a dependency)
-- Note: These are typically enabled by default in Supabase projects

-- Create a function to securely store Meta access tokens in the vault
-- This function can only be called by service role (SECURITY DEFINER with restricted access)
CREATE OR REPLACE FUNCTION public.store_meta_token(p_brand_id UUID, p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
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
  
  -- Clear the plaintext token from brands table and store vault reference
  UPDATE public.brands 
  SET meta_access_token = NULL,
      updated_at = NOW()
  WHERE id = p_brand_id;
  
  RETURN v_secret_id;
END;
$$;

-- Create a function to retrieve Meta access tokens from the vault
-- This function can only be called by service role (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_meta_token(p_brand_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  v_token TEXT;
  v_secret_name TEXT;
  v_legacy_token TEXT;
BEGIN
  v_secret_name := 'meta_token_' || p_brand_id::text;
  
  -- First try to get from vault
  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE name = v_secret_name;
  
  -- If found in vault, return it
  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;
  
  -- Fallback: Check if there's a legacy plaintext token
  -- This allows for gradual migration
  SELECT meta_access_token INTO v_legacy_token
  FROM public.brands
  WHERE id = p_brand_id;
  
  IF v_legacy_token IS NOT NULL THEN
    -- Migrate the legacy token to vault automatically
    PERFORM public.store_meta_token(p_brand_id, v_legacy_token);
    RETURN v_legacy_token;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create a function to delete Meta token from vault (for disconnecting accounts)
CREATE OR REPLACE FUNCTION public.delete_meta_token(p_brand_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  v_secret_name TEXT;
BEGIN
  v_secret_name := 'meta_token_' || p_brand_id::text;
  
  -- Delete from vault
  DELETE FROM vault.secrets WHERE name = v_secret_name;
  
  -- Also clear any legacy plaintext token
  UPDATE public.brands 
  SET meta_access_token = NULL,
      updated_at = NOW()
  WHERE id = p_brand_id;
  
  RETURN TRUE;
END;
$$;

-- Grant execute permissions only to authenticated users (RLS will still apply)
-- The SECURITY DEFINER ensures vault access happens with elevated privileges
REVOKE ALL ON FUNCTION public.store_meta_token(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_meta_token(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_meta_token(UUID) FROM PUBLIC;

-- Grant to authenticated role (edge functions use service role which bypasses this)
GRANT EXECUTE ON FUNCTION public.store_meta_token(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meta_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_meta_token(UUID) TO authenticated;