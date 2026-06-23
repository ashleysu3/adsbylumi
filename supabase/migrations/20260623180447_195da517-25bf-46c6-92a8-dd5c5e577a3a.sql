ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS business_model text,
  ADD COLUMN IF NOT EXISTS business_model_confirmed_at timestamptz;

ALTER TABLE public.brands
  DROP CONSTRAINT IF EXISTS brands_business_model_check;
ALTER TABLE public.brands
  ADD CONSTRAINT brands_business_model_check
  CHECK (business_model IS NULL OR business_model IN (
    'lead_gen_funnels',
    'low_ticket_direct',
    'high_ticket_consult',
    'ecommerce',
    'community_membership'
  ));