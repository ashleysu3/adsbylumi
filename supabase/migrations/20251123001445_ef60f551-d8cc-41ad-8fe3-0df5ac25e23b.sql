-- Create storage bucket for creative assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('creative-assets', 'creative-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for creative-assets bucket
-- Allow authenticated users to upload to their brand's folder
CREATE POLICY "Users can upload creative assets to their brand folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'creative-assets' 
  AND (storage.foldername(name))[1] IN (
    SELECT b.id::text 
    FROM brands b 
    WHERE b.user_id = auth.uid()
  )
);

-- Allow authenticated users to read their brand's assets
CREATE POLICY "Users can view their brand's creative assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'creative-assets' 
  AND (storage.foldername(name))[1] IN (
    SELECT b.id::text 
    FROM brands b 
    WHERE b.user_id = auth.uid()
  )
);

-- Allow authenticated users to update their brand's assets
CREATE POLICY "Users can update their brand's creative assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'creative-assets' 
  AND (storage.foldername(name))[1] IN (
    SELECT b.id::text 
    FROM brands b 
    WHERE b.user_id = auth.uid()
  )
);

-- Allow authenticated users to delete their brand's assets
CREATE POLICY "Users can delete their brand's creative assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'creative-assets' 
  AND (storage.foldername(name))[1] IN (
    SELECT b.id::text 
    FROM brands b 
    WHERE b.user_id = auth.uid()
  )
);