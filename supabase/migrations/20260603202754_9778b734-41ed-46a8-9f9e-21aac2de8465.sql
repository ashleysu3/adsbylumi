
CREATE TABLE public.template_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_url text NOT NULL,
  source_path text,
  notes text,
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.template_requests TO authenticated;
GRANT ALL ON public.template_requests TO service_role;

ALTER TABLE public.template_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own requests"
  ON public.template_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Users read own requests"
  ON public.template_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update requests"
  ON public.template_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX template_requests_status_idx ON public.template_requests(status, created_at);

CREATE TRIGGER update_template_requests_updated_at
  BEFORE UPDATE ON public.template_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
