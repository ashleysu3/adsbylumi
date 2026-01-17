-- Add emoji settings to brands table
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS use_emojis boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS brand_emojis text[] DEFAULT ARRAY['✨', '🎯', '💡', '🚀', '💪'],
ADD COLUMN IF NOT EXISTS bullet_emoji text DEFAULT '✅';

-- Add comment for documentation
COMMENT ON COLUMN public.brands.use_emojis IS 'Whether to use emojis in generated copy';
COMMENT ON COLUMN public.brands.brand_emojis IS 'Brand''s preferred emojis (up to 6)';
COMMENT ON COLUMN public.brands.bullet_emoji IS 'Emoji used for bullet points in copy';