
-- 1) broll-library storage: enforce ownership on INSERT and DELETE
DROP POLICY IF EXISTS "Users can delete own broll clips" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload broll clips" ON storage.objects;

CREATE POLICY "Users can delete own broll clips"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'broll-library'
  AND (storage.foldername(name))[1] IN (
    SELECT brands.id::text FROM public.brands WHERE brands.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload broll clips"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'broll-library'
  AND (storage.foldername(name))[1] IN (
    SELECT brands.id::text FROM public.brands WHERE brands.user_id = auth.uid()
  )
);

-- 2) partner_access_tokens: drop public read of trial codes, add safe RPC
DROP POLICY IF EXISTS "Users can validate partner trial codes" ON public.partner_access_tokens;

CREATE OR REPLACE FUNCTION public.validate_partner_trial_code(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.partner_access_tokens
    WHERE partner_trial_code = upper(trim(p_code))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.validate_partner_trial_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_partner_trial_code(text) TO authenticated;

-- 3) invite_codes: drop broad read, add safe RPC
DROP POLICY IF EXISTS "Authenticated users can validate active codes" ON public.invite_codes;

CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.invite_codes
    WHERE code = upper(trim(p_code))
      AND active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND current_uses < max_uses
  );
$$;

REVOKE EXECUTE ON FUNCTION public.validate_invite_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_invite_code(text) TO authenticated;
