-- Named b-roll libraries scoped to a brand
CREATE TABLE public.broll_libraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  clips jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_broll_libraries_brand_id ON public.broll_libraries(brand_id);

ALTER TABLE public.broll_libraries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their broll libraries"
ON public.broll_libraries FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.brands b
  WHERE b.id = broll_libraries.brand_id AND b.user_id = auth.uid()
));

CREATE POLICY "Users can insert their broll libraries"
ON public.broll_libraries FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.brands b
  WHERE b.id = broll_libraries.brand_id AND b.user_id = auth.uid()
));

CREATE POLICY "Users can update their broll libraries"
ON public.broll_libraries FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.brands b
  WHERE b.id = broll_libraries.brand_id AND b.user_id = auth.uid()
));

CREATE POLICY "Users can delete their broll libraries"
ON public.broll_libraries FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.brands b
  WHERE b.id = broll_libraries.brand_id AND b.user_id = auth.uid()
));

CREATE POLICY "Admins can view all broll libraries"
ON public.broll_libraries FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_broll_libraries_updated_at
BEFORE UPDATE ON public.broll_libraries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Optional link from a campaign workspace to a named library
ALTER TABLE public.campaign_workspaces
ADD COLUMN broll_library_id uuid REFERENCES public.broll_libraries(id) ON DELETE SET NULL;
