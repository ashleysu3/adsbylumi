
CREATE TABLE public.stock_broll_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url text NOT NULL,
  thumbnail_url text,
  title text,
  categories text[] NOT NULL DEFAULT '{}',
  duration_seconds numeric,
  source text DEFAULT 'stock',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stock_broll_clips TO authenticated;
GRANT ALL ON public.stock_broll_clips TO service_role;

ALTER TABLE public.stock_broll_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view stock broll clips"
  ON public.stock_broll_clips FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert stock broll clips"
  ON public.stock_broll_clips FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update stock broll clips"
  ON public.stock_broll_clips FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete stock broll clips"
  ON public.stock_broll_clips FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_stock_broll_clips_categories
  ON public.stock_broll_clips USING GIN (categories);

CREATE POLICY "Authenticated can read stock-broll bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stock-broll');

CREATE POLICY "Admins can upload to stock-broll bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stock-broll' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update stock-broll bucket"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'stock-broll' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete from stock-broll bucket"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'stock-broll' AND public.has_role(auth.uid(), 'admin'::app_role));
