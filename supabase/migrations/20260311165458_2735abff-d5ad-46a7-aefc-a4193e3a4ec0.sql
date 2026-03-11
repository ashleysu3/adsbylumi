CREATE TABLE public.partner_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  rewardful_affiliate_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 year')
);

ALTER TABLE public.partner_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can validate tokens by select" ON public.partner_access_tokens
FOR SELECT TO anon, authenticated
USING (true);

CREATE INDEX idx_partner_tokens_token ON public.partner_access_tokens(token);
CREATE INDEX idx_partner_tokens_email ON public.partner_access_tokens(email);