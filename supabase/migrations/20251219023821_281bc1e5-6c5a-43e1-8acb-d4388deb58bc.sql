-- Create atomic function to claim invite code (prevents race conditions)
CREATE OR REPLACE FUNCTION public.claim_invite_code(code_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE public.invite_codes
  SET current_uses = current_uses + 1
  WHERE code = UPPER(TRIM(code_input))
    AND active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND current_uses < max_uses;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.claim_invite_code(TEXT) TO anon, authenticated;