-- Per-offer "how this actually sells" funnel map, captured via a guided
-- discovery chat (funnel-strategy-chat). Distinct from the ad-campaign
-- Grow/Nurture/Convert grouping already computed live in AdStrategy.tsx --
-- this captures the business-model funnel (lead magnet, discovery call,
-- etc.) that ads plug into, most of which isn't itself an ad campaign.
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS funnel_map JSONB,
  ADD COLUMN IF NOT EXISTS funnel_gaps JSONB,
  ADD COLUMN IF NOT EXISTS funnel_map_updated_at TIMESTAMP WITH TIME ZONE;
