ALTER TABLE public.brand_kits
ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE;

ALTER TABLE public.brand_kits
DROP CONSTRAINT IF EXISTS brand_kits_user_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS brand_kits_user_brand_unique
ON public.brand_kits (user_id, brand_id)
WHERE brand_id IS NOT NULL;