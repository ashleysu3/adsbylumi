
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  trigger_description TEXT,
  edge_function TEXT,
  category TEXT NOT NULL DEFAULT 'transactional',
  subject TEXT,
  intro TEXT,
  outro TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email templates"
  ON public.email_templates FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert email templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update email templates"
  ON public.email_templates FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete email templates"
  ON public.email_templates FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role (used by edge functions) can also read
CREATE POLICY "Service role can read email templates"
  ON public.email_templates FOR SELECT
  TO service_role
  USING (true);

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed catalog of known emails
INSERT INTO public.email_templates (key, label, description, trigger_description, edge_function, category, subject, intro, outro) VALUES
('welcome', 'Welcome Email', 'Sent to new users right after signup.', 'Triggered when a new user account is created.', 'send-welcome-email', 'lifecycle',
  'Welcome to Lumi ✨', 'Welcome aboard! We''re so glad you''re here.', 'Reply to this email any time — we read every one.'),
('beta_welcome', 'Founder Welcome', 'Welcome email for Founder Pricing members.', 'Triggered when a user activates Founder Pricing.', 'send-beta-welcome-email', 'lifecycle',
  'You''re in — welcome to Lumi Founders', 'Thanks for joining as a Founding Member.', 'We''ll be in touch personally over the next few days.'),
('onboarding_drip', 'Onboarding Drip', 'Multi-step onboarding nurture sequence.', 'Triggered on a schedule after signup until onboarding is complete.', 'send-onboarding-drip', 'lifecycle',
  'Your next step inside Lumi', 'Quick nudge from the Lumi team —', 'See you in the dashboard.'),
('beta_feedback_request', 'Founder Feedback Request', 'Asks Founders for product feedback.', 'Triggered ~14 days after Founder activation.', 'send-beta-feedback-requests', 'lifecycle',
  'Got 2 minutes? We''d love your take.', 'Your feedback genuinely shapes what we build next.', 'Thanks for being a Founder — it means the world.'),
('weekly_digest', 'Weekly Performance Digest', 'Weekly KPI summary for each brand.', 'Triggered every week on the brand''s configured digest day.', 'send-weekly-reports', 'reporting',
  'Your weekly Lumi report', 'Here''s how your ads performed this week.', 'Tap any recommendation to apply it.'),
('optimization_digest', 'Optimization Digest', 'Bundled optimization recommendations.', 'Triggered when new optimization recommendations are generated.', 'send-optimization-digest', 'reporting',
  'New optimizations ready for you', 'Lumi spotted a few moves worth making.', 'Approve or skip from the dashboard.'),
('critical_alert', 'Critical Performance Alert', 'Sent when a campaign breaches critical thresholds.', 'Triggered when CTR/ROAS/frequency hit critical alert thresholds.', 'send-critical-alerts', 'alerts',
  '⚠️ Action needed on your campaign', 'One of your campaigns just hit a critical threshold.', 'We recommend reviewing it today.'),
('client_report', 'Client Report', 'Performance report sent to agency clients.', 'Triggered when an agency user shares a client report.', 'generate-client-report', 'reporting',
  'Your latest performance report', 'Here''s your latest performance summary.', 'Reply with any questions.'),
('portal_notification', 'Client Portal Notification', 'Alerts client when portal activity occurs.', 'Triggered when client portal activity (view/approve/comment) happens.', 'send-portal-notification', 'reporting',
  'Update from your client portal', 'There''s new activity in your portal.', NULL),
('partner_approval', 'Partner Approval', 'Sent to applicants approved as partners.', 'Triggered when an admin approves a partner application.', 'send-partner-approval', 'partners',
  'You''re approved — welcome to the Lumi Partner Program', 'Congrats — your application is approved.', 'Your dashboard link is below.'),
('cancellation_confirmation', 'Cancellation Confirmation', 'Confirms a subscription cancellation.', 'Triggered when a user cancels their subscription.', 'send-cancellation-email', 'lifecycle',
  'Your Lumi subscription has been cancelled', 'We''re sorry to see you go.', 'You''re welcome back any time.'),
('trial_reminder', 'Trial Ending Reminder', 'Reminds users their trial is ending soon.', 'Triggered 2 days before the 7-day trial ends.', 'send-trial-reminders', 'lifecycle',
  'Your Lumi trial ends soon', 'Just a heads up — your trial is wrapping up.', 'No surprises: you can cancel any time from Settings.'),
('bug_report_received', 'Bug Report Auto-Reply', 'Auto-acknowledgment to anyone submitting a bug report.', 'Triggered when a user submits a bug report.', 'send-bug-report', 'support',
  'We got your message — response within 24 hours', 'Got your message and we''re on it.', 'We respond within 24 hours; bugs are reviewed every Friday.'),
('render_ready', 'Render Ready', 'Notifies user when a video render finishes.', 'Triggered when a creative render job completes.', 'send-render-ready-email', 'product',
  'Your Lumi render is ready 🎬', 'Your video just finished rendering.', 'Download or push to Meta from the dashboard.'),
('retrospective', 'Campaign Retrospective', 'Sends a campaign post-mortem report.', 'Triggered when a campaign retrospective is generated.', 'send-retrospective-email', 'reporting',
  'Your campaign retrospective is ready', 'Here''s the deep-dive on your last campaign.', 'Use these learnings on the next one.');
