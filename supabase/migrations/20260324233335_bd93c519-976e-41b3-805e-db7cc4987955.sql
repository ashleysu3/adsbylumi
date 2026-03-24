
CREATE TABLE public.email_approval_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.campaign_workspaces(id) ON DELETE SET NULL,
  action_description TEXT NOT NULL,
  action_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.email_approval_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.email_approval_tokens
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);
