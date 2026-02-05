-- Add psychology tracking columns to brands table
ALTER TABLE brands 
  ADD COLUMN IF NOT EXISTS psychology_content_hash TEXT,
  ADD COLUMN IF NOT EXISTS psychology_generated_at TIMESTAMPTZ;

-- Add offer-specific audience psychology columns to offers table
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS offer_audience_psychology JSONB,
  ADD COLUMN IF NOT EXISTS psychology_content_hash TEXT;