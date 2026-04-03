ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS broll_library jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS overlay_style jsonb DEFAULT '{"fontFamily": "Inter", "fontSize": 32, "textColor": "#FFFFFF", "bgColor": "#000000", "bgOpacity": 0.6, "position": "bottom", "textShadow": true}'::jsonb;

-- Create a public storage bucket for b-roll library clips
INSERT INTO storage.buckets (id, name, public)
VALUES ('broll-library', 'broll-library', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their brand's folder
CREATE POLICY "Users can upload broll clips"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'broll-library');

-- Allow public read access for previews
CREATE POLICY "Public read access for broll clips"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'broll-library');

-- Allow users to delete their own clips
CREATE POLICY "Users can delete own broll clips"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'broll-library');