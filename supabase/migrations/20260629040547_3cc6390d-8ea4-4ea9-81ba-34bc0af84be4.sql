
CREATE OR REPLACE FUNCTION public.store_meta_token(p_brand_id uuid, p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_vault_secret_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM public.brands WHERE id = p_brand_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Brand not found';
  END IF;

  -- End-user callers must own the brand; service-role callers (auth.uid() IS NULL) pass through.
  IF auth.uid() IS NOT NULL AND v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied: you do not own this brand';
  END IF;

  UPDATE public.brands
    SET meta_access_token = p_token,
        updated_at = NOW()
    WHERE id = p_brand_id;

  -- If a vault entry already exists, overwrite it. get_meta_token prefers vault
  -- over the brands column, so without this a reconnect would still read the
  -- old expired token from vault and every Meta API call would keep failing.
  SELECT vault_secret_id INTO v_vault_secret_id
  FROM public.brand_vault_secrets
  WHERE brand_id = p_brand_id AND secret_name = 'meta_access_token';

  IF v_vault_secret_id IS NOT NULL THEN
    BEGIN
      PERFORM vault.update_secret(v_vault_secret_id, p_token);
    EXCEPTION WHEN OTHERS THEN
      -- Fallback: drop the stale pointer so the next get_meta_token call
      -- lazily re-seeds vault from the fresh token we just wrote above.
      DELETE FROM public.brand_vault_secrets
        WHERE brand_id = p_brand_id AND secret_name = 'meta_access_token';
      BEGIN
        DELETE FROM vault.secrets WHERE id = v_vault_secret_id;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  END IF;

  RETURN p_brand_id;
END;
$function$;
