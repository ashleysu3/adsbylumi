CREATE POLICY "Users read own recraft creatives"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recraft-creatives' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users insert own recraft creatives"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recraft-creatives' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own recraft creatives"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'recraft-creatives' AND auth.uid()::text = (storage.foldername(name))[1]);