CREATE POLICY "ad-photos read all" ON storage.objects FOR SELECT USING (bucket_id = 'ad-photos');
CREATE POLICY "ad-photos auth upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ad-photos');
CREATE POLICY "ad-photos anon upload" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'ad-photos');