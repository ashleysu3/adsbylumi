-- Add audience psychology and status to brands table
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS audience_psychology jsonb,
ADD COLUMN IF NOT EXISTS psychology_status text DEFAULT 'pending';

-- Add offer-related columns to offers table
ALTER TABLE public.offers
ADD COLUMN IF NOT EXISTS url text,
ADD COLUMN IF NOT EXISTS product_psychology jsonb,
ADD COLUMN IF NOT EXISTS ai_generated_description boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_generated_price boolean DEFAULT false;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_brands_psychology_status ON public.brands(psychology_status);
CREATE INDEX IF NOT EXISTS idx_offers_brand_id ON public.offers(brand_id);

-- Enable realtime for brands table to track psychology generation
ALTER PUBLICATION supabase_realtime ADD TABLE public.brands;