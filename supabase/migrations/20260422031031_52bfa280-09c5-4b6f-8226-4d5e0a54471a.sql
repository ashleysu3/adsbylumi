-- Log of Meta connection checks for debugging.
-- Each row captures one diagnostic / test / refresh attempt against a brand's
-- Meta connection so users can see exactly when something started failing.
CREATE TABLE public.meta_connection_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  -- 'auto_test' | 'manual_test' | 'refresh' | 'diagnostic' | 'disconnect'
  check_type TEXT NOT NULL,
  -- 'success' | 'warning' | 'error'
  outcome TEXT NOT NULL,
  -- Short human-readable summary
  summary TEXT,
  -- Structured detail: which checks ran, which passed/failed, raw error
  checks_performed JSONB NOT NULL DEFAULT '[]'::jsonb,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meta_connection_checks_brand_created
  ON public.meta_connection_checks (brand_id, created_at DESC);

ALTER TABLE public.meta_connection_checks ENABLE ROW LEVEL SECURITY;

-- Owners of the brand can read and insert log rows.
CREATE POLICY "Brand owners can view their connection checks"
ON public.meta_connection_checks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = meta_connection_checks.brand_id
      AND b.user_id = auth.uid()
  )
);

CREATE POLICY "Brand owners can insert connection checks"
ON public.meta_connection_checks
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = meta_connection_checks.brand_id
      AND b.user_id = auth.uid()
  )
);

-- Owners can clear their own log
CREATE POLICY "Brand owners can delete their connection checks"
ON public.meta_connection_checks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = meta_connection_checks.brand_id
      AND b.user_id = auth.uid()
  )
);
