-- Revoke direct client access to sensitive secret columns. RLS still applies to the row,
-- but clients (authenticated/anon roles) can no longer SELECT these columns. Access must go
-- through existing SECURITY DEFINER helpers (get_meta_token, redeem_strategy_code, etc.),
-- which enforce ownership/gate checks server-side. service_role retains full access.

-- brands: hide raw token/API-key columns from client roles.
REVOKE SELECT (meta_access_token, flodesk_api_key, kit_access_token, kit_refresh_token)
  ON public.brands FROM authenticated;
REVOKE SELECT (meta_access_token, flodesk_api_key, kit_access_token, kit_refresh_token)
  ON public.brands FROM anon;

-- Also revoke UPDATE on these columns so clients can't write raw secrets either;
-- writes must go through store_meta_token / delete_meta_token SECURITY DEFINER RPCs.
REVOKE UPDATE (meta_access_token, flodesk_api_key, kit_access_token, kit_refresh_token)
  ON public.brands FROM authenticated;
REVOKE UPDATE (meta_access_token, flodesk_api_key, kit_access_token, kit_refresh_token)
  ON public.brands FROM anon;

-- recommended_strategies: hide access_code from clients. Redemption goes through
-- the redeem_strategy_code(code) SECURITY DEFINER RPC which returns rows by code
-- without exposing the code column itself.
REVOKE SELECT (access_code) ON public.recommended_strategies FROM authenticated;
REVOKE SELECT (access_code) ON public.recommended_strategies FROM anon;
