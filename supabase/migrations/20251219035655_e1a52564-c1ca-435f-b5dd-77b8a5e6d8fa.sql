-- Create mapping table for storing references to secrets in Vault
CREATE TABLE IF NOT EXISTS public.brand_vault_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  secret_name TEXT NOT NULL,
  vault_secret_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure one secret reference per brand+name
CREATE UNIQUE INDEX IF NOT EXISTS brand_vault_secrets_brand_secret_unique
  ON public.brand_vault_secrets (brand_id, secret_name);

-- Lock down direct access from clients (used only via SECURITY DEFINER functions)
ALTER TABLE public.brand_vault_secrets ENABLE ROW LEVEL SECURITY;