-- Create bug_reports table
CREATE TABLE public.bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  details TEXT,
  context TEXT,
  current_page TEXT,
  current_url TEXT,
  user_agent TEXT,
  conversation_context TEXT,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT DEFAULT 'normal',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view all bug reports"
ON public.bug_reports
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert bug reports"
ON public.bug_reports
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update bug reports"
ON public.bug_reports
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bug reports"
ON public.bug_reports
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX idx_bug_reports_status ON public.bug_reports(status);
CREATE INDEX idx_bug_reports_created_at ON public.bug_reports(created_at DESC);
CREATE INDEX idx_bug_reports_user_email ON public.bug_reports(user_email);

-- Create trigger for updated_at
CREATE TRIGGER update_bug_reports_updated_at
  BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();