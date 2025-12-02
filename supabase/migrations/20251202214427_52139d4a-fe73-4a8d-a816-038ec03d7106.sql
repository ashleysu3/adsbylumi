-- Add messaging_guidelines column to offers table
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS messaging_guidelines jsonb DEFAULT '{}'::jsonb;

-- Add a comment describing the expected structure
COMMENT ON COLUMN public.offers.messaging_guidelines IS 'Offer-specific messaging guidelines: { core_message, key_benefits[], tone_notes, dont_say[], always_include[], approved_examples[], competitor_differentiation }';