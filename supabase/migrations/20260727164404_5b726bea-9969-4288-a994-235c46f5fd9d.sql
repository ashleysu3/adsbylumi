
CREATE POLICY "Admins can view all brand assets" ON public.brand_assets FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all brand kits" ON public.brand_kits FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all brand content assets" ON public.brand_content_assets FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
