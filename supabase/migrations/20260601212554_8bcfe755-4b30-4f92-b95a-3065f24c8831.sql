
-- Changelog entries (manually logged updates/wins/features)
CREATE TABLE public.changelog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  category text NOT NULL DEFAULT 'feature', -- feature, fix, improvement, announcement
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  included_in_campaign_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.changelog_entries TO authenticated;
GRANT ALL ON public.changelog_entries TO service_role;
ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage changelog" ON public.changelog_entries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_changelog_updated_at
  BEFORE UPDATE ON public.changelog_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Newsletter campaigns (drafts -> scheduled -> sent)
CREATE TABLE public.newsletter_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_label text NOT NULL,
  selected_update_ids uuid[] NOT NULL DEFAULT '{}',
  angles jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_note text,
  user_subject text,
  user_resend_subject text,
  user_html text,
  partner_subject text,
  partner_resend_subject text,
  partner_html text,
  status text NOT NULL DEFAULT 'draft', -- draft, scheduled, sending, sent
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_campaigns TO authenticated;
GRANT ALL ON public.newsletter_campaigns TO service_role;
ALTER TABLE public.newsletter_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage campaigns" ON public.newsletter_campaigns
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_newsletter_campaigns_updated_at
  BEFORE UPDATE ON public.newsletter_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-recipient send records (for open/click tracking + resend logic)
CREATE TABLE public.newsletter_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.newsletter_campaigns(id) ON DELETE CASCADE,
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  variant text NOT NULL CHECK (variant IN ('user','partner')),
  message_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  clicked_at timestamptz,
  click_count integer NOT NULL DEFAULT 0,
  resent_at timestamptz,
  resend_message_id text,
  UNIQUE (campaign_id, recipient_email, variant)
);

CREATE INDEX idx_newsletter_sends_campaign ON public.newsletter_sends(campaign_id);
CREATE INDEX idx_newsletter_sends_open ON public.newsletter_sends(campaign_id) WHERE opened_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.newsletter_sends TO authenticated;
GRANT ALL ON public.newsletter_sends TO service_role;
ALTER TABLE public.newsletter_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read sends" ON public.newsletter_sends
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Profiles: add referral_code + newsletter_opt_in
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS newsletter_opt_in boolean NOT NULL DEFAULT true;

-- Backfill referral codes for existing profiles
UPDATE public.profiles
SET referral_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- Function to generate a unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  LOOP
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

-- Trigger to auto-populate referral_code on new profiles
CREATE OR REPLACE FUNCTION public.set_referral_code_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_referral_code ON public.profiles;
CREATE TRIGGER trg_profile_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_referral_code_on_insert();

-- Referrals: tracks who referred whom
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_email text NOT NULL,
  code text NOT NULL,
  source text NOT NULL DEFAULT 'newsletter_forward', -- newsletter_forward, link
  status text NOT NULL DEFAULT 'pending', -- pending, signed_up, paid, credited
  credited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_user_id)
);

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_user_id);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Account credits ($40 friend-referral credits, etc.)
CREATE TABLE public.account_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  source text NOT NULL, -- 'friend_referral', 'manual', etc.
  source_ref text, -- referral id or other reference
  note text,
  applied_at timestamptz,
  stripe_balance_transaction_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_account_credits_user ON public.account_credits(user_id);

GRANT SELECT ON public.account_credits TO authenticated;
GRANT ALL ON public.account_credits TO service_role;
ALTER TABLE public.account_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own credits" ON public.account_credits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- RPC: get my referral summary (code + credits balance + referral count)
CREATE OR REPLACE FUNCTION public.get_my_referral_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'referral_code', p.referral_code,
    'total_credits_cents', COALESCE((SELECT SUM(amount_cents) FROM public.account_credits WHERE user_id = auth.uid()), 0),
    'pending_referrals', COALESCE((SELECT COUNT(*) FROM public.referrals WHERE referrer_user_id = auth.uid() AND status IN ('pending','signed_up')), 0),
    'paid_referrals', COALESCE((SELECT COUNT(*) FROM public.referrals WHERE referrer_user_id = auth.uid() AND status IN ('paid','credited')), 0)
  )
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

-- RPC: admin fetches signals for a new draft (recent changelog, recent activity)
CREATE OR REPLACE FUNCTION public.admin_get_newsletter_signals()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN jsonb_build_object(
    'changelog', COALESCE((
      SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at DESC)
      FROM (
        SELECT id, title, body, category, created_at, included_in_campaign_id
        FROM public.changelog_entries
        WHERE created_at > now() - interval '60 days'
        ORDER BY created_at DESC
      ) c
    ), '[]'::jsonb),
    'recent_strategies', COALESCE((SELECT COUNT(*) FROM public.strategies WHERE created_at > now() - interval '30 days'), 0),
    'recent_campaigns', COALESCE((SELECT COUNT(*) FROM public.campaign_workspaces WHERE created_at > now() - interval '30 days'), 0),
    'new_users_30d', COALESCE((SELECT COUNT(*) FROM public.profiles WHERE created_at > now() - interval '30 days'), 0),
    'active_partners', COALESCE((SELECT COUNT(*) FROM public.partner_access_tokens WHERE is_active = true), 0)
  );
END;
$$;
