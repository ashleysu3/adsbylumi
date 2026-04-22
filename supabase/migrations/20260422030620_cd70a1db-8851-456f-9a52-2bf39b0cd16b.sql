-- Per-offer toggle: should generation apply brand Style defaults
-- (copy voice, emoji preferences, b-roll, overlay style)?
ALTER TABLE public.offers
ADD COLUMN use_brand_style_defaults boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.offers.use_brand_style_defaults IS
  'When true (default), AI script and creative generation for campaigns linked to this offer applies the brand Style defaults: copy perspective, emoji settings, bullet emoji, text overlay style, and b-roll library. When false, generation falls back to neutral defaults so this offer can have its own voice.';
