
CREATE POLICY "Users read own lead magnet assets" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'lead-magnet-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own lead magnet assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lead-magnet-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own lead magnet assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'lead-magnet-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own lead magnet assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'lead-magnet-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
