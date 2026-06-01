
-- Recommended strategies (admin-managed library)
CREATE TABLE public.recommended_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  industry text[] NOT NULL DEFAULT '{}',
  business_model text[] NOT NULL DEFAULT '{}',
  primary_goals text[] NOT NULL DEFAULT '{}',
  keywords text[] NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  why_it_works text NOT NULL DEFAULT '',
  campaigns jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommended_strategies TO authenticated;
GRANT ALL ON public.recommended_strategies TO service_role;

ALTER TABLE public.recommended_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active strategies"
ON public.recommended_strategies FOR SELECT TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage strategies"
ON public.recommended_strategies FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_recommended_strategies_updated
  BEFORE UPDATE ON public.recommended_strategies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Strategy requests (fallback when no template matches)
CREATE TABLE public.strategy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  brand_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_goal text,
  status text NOT NULL DEFAULT 'pending',
  admin_response jsonb,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE INDEX idx_strategy_requests_status ON public.strategy_requests (status, created_at DESC);
CREATE INDEX idx_strategy_requests_user ON public.strategy_requests (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_requests TO authenticated;
GRANT ALL ON public.strategy_requests TO service_role;

ALTER TABLE public.strategy_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own strategy requests"
ON public.strategy_requests FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own strategy requests"
ON public.strategy_requests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins update strategy requests"
ON public.strategy_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete strategy requests"
ON public.strategy_requests FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE CONSTRAINT TRIGGER trg_strategy_requests_status_check
  AFTER INSERT OR UPDATE ON public.strategy_requests
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
