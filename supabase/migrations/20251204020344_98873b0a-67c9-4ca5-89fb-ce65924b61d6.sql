-- Add offer_id column to campaign_workspaces to link to rich offer data
ALTER TABLE public.campaign_workspaces 
ADD COLUMN offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_campaign_workspaces_offer_id ON public.campaign_workspaces(offer_id);

-- Backfill offer_id for existing workspaces where possible (matching by brand + offer name)
UPDATE public.campaign_workspaces cw
SET offer_id = o.id
FROM public.offers o
WHERE cw.brand_id = o.brand_id 
  AND cw.offer_name IS NOT NULL 
  AND o.name = cw.offer_name
  AND cw.offer_id IS NULL;