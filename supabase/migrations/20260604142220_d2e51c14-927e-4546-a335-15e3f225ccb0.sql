
CREATE POLICY "brand-assets users read own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "brand-assets users insert own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "brand-assets users update own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "brand-assets users delete own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
