
-- 1. brand_learnings: add missing INSERT policy
CREATE POLICY "Users insert learnings for their brands"
ON public.brand_learnings
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.brands b
  WHERE b.id = brand_learnings.brand_id AND b.user_id = auth.uid()
));

-- 2. brands: add generated connection flags so UI doesn't need raw tokens
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS kit_connected boolean
    GENERATED ALWAYS AS (kit_access_token IS NOT NULL) STORED,
  ADD COLUMN IF NOT EXISTS flodesk_connected boolean
    GENERATED ALWAYS AS (flodesk_api_key IS NOT NULL) STORED,
  ADD COLUMN IF NOT EXISTS meta_connected boolean
    GENERATED ALWAYS AS (meta_access_token IS NOT NULL) STORED;

-- 3. brands: revoke table-level SELECT and re-grant on safe columns only
DO $$
DECLARE
  cols text;
  sensitive text[] := ARRAY['meta_access_token','kit_access_token','kit_refresh_token','flodesk_api_key'];
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='brands'
      AND NOT (column_name = ANY(sensitive));
  EXECUTE 'REVOKE SELECT ON public.brands FROM authenticated, anon, PUBLIC';
  EXECUTE format('GRANT SELECT (%s) ON public.brands TO authenticated', cols);
  -- service_role keeps full access
  EXECUTE 'GRANT ALL ON public.brands TO service_role';
END $$;

-- 4. partner_access_tokens: hide Stripe/internal fields from client reads
DO $$
DECLARE
  cols text;
  sensitive text[] := ARRAY['stripe_coupon_id','stripe_promotion_code_id','stripe_promo_synced_at','rewardful_affiliate_id','partner_email','comped_by'];
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='partner_access_tokens'
      AND NOT (column_name = ANY(sensitive));
  EXECUTE 'REVOKE SELECT ON public.partner_access_tokens FROM authenticated, anon, PUBLIC';
  EXECUTE format('GRANT SELECT (%s) ON public.partner_access_tokens TO authenticated', cols);
  EXECUTE 'GRANT ALL ON public.partner_access_tokens TO service_role';
END $$;

-- 5. brand_team_members: hide invite_token from clients; provide RPC for owners
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='brand_team_members'
      AND column_name <> 'invite_token';
  EXECUTE 'REVOKE SELECT ON public.brand_team_members FROM authenticated, anon, PUBLIC';
  EXECUTE format('GRANT SELECT (%s) ON public.brand_team_members TO authenticated', cols);
  EXECUTE 'GRANT INSERT, UPDATE, DELETE ON public.brand_team_members TO authenticated';
  EXECUTE 'GRANT ALL ON public.brand_team_members TO service_role';
END $$;

CREATE OR REPLACE FUNCTION public.get_team_invite_token(p_member_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  SELECT m.invite_token INTO v_token
  FROM public.brand_team_members m
  JOIN public.brands b ON b.id = m.brand_id
  WHERE m.id = p_member_id
    AND m.invite_status = 'pending'
    AND b.user_id = auth.uid();

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Invite not found or access denied';
  END IF;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_invite_token(uuid) TO authenticated;
