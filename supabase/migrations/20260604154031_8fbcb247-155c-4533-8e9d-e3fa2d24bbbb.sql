DROP INDEX IF EXISTS public.brand_kits_user_brand_unique;

ALTER TABLE public.brand_kits
DROP CONSTRAINT IF EXISTS brand_kits_user_brand_unique;

ALTER TABLE public.brand_kits
ADD CONSTRAINT brand_kits_user_brand_unique UNIQUE (user_id, brand_id);