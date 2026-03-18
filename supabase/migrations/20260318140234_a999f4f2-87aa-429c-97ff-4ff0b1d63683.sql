
CREATE TABLE public.cancellation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reason text NOT NULL,
  stripe_subscription_id text,
  user_email text,
  user_name text,
  tier_at_cancellation text,
  period_end timestamp with time zone
);

ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own cancellation requests"
  ON public.cancellation_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own cancellation requests"
  ON public.cancellation_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all cancellation requests"
  ON public.cancellation_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
