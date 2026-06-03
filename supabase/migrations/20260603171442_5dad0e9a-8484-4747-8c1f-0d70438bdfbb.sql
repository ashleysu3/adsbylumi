CREATE POLICY "Authenticated can read inspiration bucket"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'inspiration');

CREATE POLICY "Admins can upload to inspiration bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'inspiration' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update inspiration bucket"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'inspiration' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete from inspiration bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'inspiration' AND public.has_role(auth.uid(), 'admin'::app_role));