
CREATE TABLE IF NOT EXISTS public.template_stock_props (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  description text,
  image_url text NOT NULL,
  storage_path text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.template_stock_props TO authenticated;
GRANT ALL ON public.template_stock_props TO service_role;
ALTER TABLE public.template_stock_props ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authed can read stock props" ON public.template_stock_props FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert stock props" ON public.template_stock_props FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can update stock props" ON public.template_stock_props FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can delete stock props" ON public.template_stock_props FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins manage template-props objects" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'template-props' AND public.has_role(auth.uid(),'admin'))
WITH CHECK (bucket_id = 'template-props' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Authed read template-props objects" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'template-props');
