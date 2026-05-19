CREATE TABLE IF NOT EXISTS public.winback_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  offered_price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  interval TEXT NOT NULL DEFAULT 'month',
  price_id TEXT,
  trial_days INTEGER NOT NULL DEFAULT 14,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at TIMESTAMPTZ,
  consent_ip TEXT,
  consent_user_agent TEXT,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_by_admin_id UUID,
  start_choice TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_winback_offers_token ON public.winback_offers(token);
CREATE INDEX IF NOT EXISTS idx_winback_offers_user_id ON public.winback_offers(user_id);
CREATE INDEX IF NOT EXISTS idx_winback_offers_email ON public.winback_offers(email);

ALTER TABLE public.winback_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all winback offers"
  ON public.winback_offers
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_winback_offers_updated_at
  BEFORE UPDATE ON public.winback_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_winback_offer_by_token(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'email', o.email,
    'offered_price_cents', o.offered_price_cents,
    'currency', o.currency,
    'interval', o.interval,
    'trial_days', o.trial_days,
    'status', o.status,
    'expires_at', o.expires_at,
    'accepted_at', o.accepted_at
  ) INTO v_offer
  FROM public.winback_offers o
  WHERE o.token = p_token;
  RETURN v_offer;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_winback_offer_by_token(TEXT) TO anon, authenticated;