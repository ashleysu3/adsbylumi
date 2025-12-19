-- Explicitly deny all client access to brand_vault_secrets (used only by SECURITY DEFINER/server roles)
CREATE POLICY "Deny all access to brand_vault_secrets"
ON public.brand_vault_secrets
FOR ALL
USING (false)
WITH CHECK (false);