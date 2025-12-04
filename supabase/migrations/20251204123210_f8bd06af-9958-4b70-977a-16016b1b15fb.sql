-- Make creative-assets bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'creative-assets';

-- Create RLS policies for creative-assets bucket
-- Allow authenticated users to upload to their brand's folder
CREATE POLICY "Users can upload to their brand folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'creative-assets' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.brands WHERE user_id = auth.uid()
  )
);

-- Allow users to view files from their brands
CREATE POLICY "Users can view their brand assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'creative-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.brands WHERE user_id = auth.uid()
  )
);

-- Allow users to update their brand assets
CREATE POLICY "Users can update their brand assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'creative-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.brands WHERE user_id = auth.uid()
  )
);

-- Allow users to delete their brand assets
CREATE POLICY "Users can delete their brand assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'creative-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.brands WHERE user_id = auth.uid()
  )
);