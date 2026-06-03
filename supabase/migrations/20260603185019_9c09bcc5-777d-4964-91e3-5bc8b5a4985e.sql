CREATE POLICY "Authenticated can read template-refs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'template-refs');

CREATE POLICY "Admins can insert template-refs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'template-refs' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update template-refs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'template-refs' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete template-refs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'template-refs' AND public.has_role(auth.uid(), 'admin'::app_role));
