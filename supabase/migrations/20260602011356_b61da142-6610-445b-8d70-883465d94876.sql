-- 1) Seed real shipped updates as approved changelog entries
INSERT INTO public.changelog_entries (title, body, category, approval_status, source, is_user_visible, created_at) VALUES
('Budget calculator: work backwards from your goal', 'New calculator in the campaign builder. Tell it your goal conversions, goal revenue, or set spend per day — it shows the daily budget you need to hit Meta''s 50-conversions-a-week learning phase.', 'feature', 'approved', 'manual', true, now() - interval '1 day'),
('Pixel won''t install? Two new safety nets', 'If your pixel check fails, you can now book a 1:1 with Ashley or switch your campaign to a Traffic objective in one click so you''re never blocked from launching.', 'feature', 'approved', 'manual', true, now() - interval '2 days'),
('Weekly reports now exclude paused campaigns', 'Your emailed optimization report only counts LIVE campaigns, so the numbers always match what you see in the Ad Performance page.', 'fix', 'approved', 'manual', true, now() - interval '3 days'),
('LUMI features catalog (admin)', 'A single place to track every Lumi feature, who it helps, and the marketing angles you can pull from it. Powers smarter newsletter and social ideas.', 'feature', 'approved', 'manual', true, now() - interval '4 days'),
('Marketing-idea generator now grounded in real features', 'The "Need ideas?" button in the Updates hub only suggests ideas tied to real Lumi features — no more off-brand audience-targeting advice.', 'improvement', 'approved', 'manual', true, now() - interval '5 days'),
('Partner payouts: one-click "mark paid"', 'Admin → Partner Payouts pulls every due payout from Rewardful, shows the partner''s PayPal/Wise on file, and marks it paid with one confirmation.', 'feature', 'approved', 'manual', true, now() - interval '6 days'),
('Partner portal redesign', 'Your affiliate dashboard now shows live earnings, your trial code, recent product updates, and a cleaner share link block.', 'improvement', 'approved', 'manual', true, now() - interval '7 days'),
('27-character headline guardrails', 'Headlines auto-warn when they go past Meta''s safe mobile-display limit so they never get truncated in your ads.', 'improvement', 'approved', 'manual', true, now() - interval '8 days'),
('9:16 video everywhere', 'Every AI-generated video script and b-roll list now defaults to 9:16 vertical — the format that actually performs on Reels and Stories.', 'improvement', 'approved', 'manual', true, now() - interval '9 days'),
('Founder Pricing: $97/month + 7-day free trial', 'Lock in $97/mo for as long as you stay subscribed. New accounts get a 7-day free trial — no charge until day 8.', 'announcement', 'approved', 'manual', true, now() - interval '10 days'),
('Agency Mode for white-labeled brands', 'Agency accounts can now manage up to 10 brands and 10 ad accounts under one login, with portal branding per client.', 'feature', 'approved', 'manual', true, now() - interval '11 days'),
('Live campaign cap raised to 10 per brand', 'You can now run up to 10 active campaigns per brand at once — enough to test new angles without blowing up the learning phase.', 'improvement', 'approved', 'manual', true, now() - interval '12 days'),
('Broad+ only: no more audience guesswork', 'Lumi now uses Advantage+ "Broad+" audiences on every campaign. Meta''s AI finds your buyers — you focus on creative.', 'improvement', 'approved', 'manual', true, now() - interval '13 days'),
('Generic ad set names ("Ad Set 1, 2, 3…")', 'We stopped using audience-style ad set names. Cleaner reports, faster scanning, and no confusing "interest" labels.', 'improvement', 'approved', 'manual', true, now() - interval '14 days'),
('Lumi onboarding concierge', 'A friendly AI chat that walks new users through the brand wizard, answers questions, and never invents features that don''t exist.', 'feature', 'approved', 'manual', true, now() - interval '15 days'),
('5-step guided brand wizard', 'New users now have a clear, mandatory 5-step setup so every brand has the offer, audience, and voice data we need to write great ads.', 'feature', 'approved', 'manual', true, now() - interval '16 days'),
('Diagnostic system: green/yellow/red on every campaign', 'Each live campaign now shows a clear status with the exact reason — budget hog, creative fatigue, low CTR — and what to do next.', 'feature', 'approved', 'manual', true, now() - interval '17 days'),
('Creative fatigue detector', 'When frequency climbs past 4 or CTR drops 25%, you''ll see a "refresh creative" nudge with new AI-generated angles ready to drop in.', 'feature', 'approved', 'manual', true, now() - interval '18 days'),
('Budget hog flag', 'Spot the campaign quietly eating your daily budget without the results to justify it — flagged automatically in the diagnostics panel.', 'feature', 'approved', 'manual', true, now() - interval '19 days'),
('Soft paywall: explore before you pay', 'Unpaid users can browse, see sample outputs, and hit a friendly banner instead of a hard wall — no surprise lock-outs mid-setup.', 'improvement', 'approved', 'manual', true, now() - interval '20 days'),
('Payment-first checkout flow', 'You enter payment at the sales page now, then complete onboarding. Cuts the abandoned-account problem in half.', 'improvement', 'approved', 'manual', true, now() - interval '21 days'),
('250MB upload cap on creative', 'Image and video uploads up to 250MB across the platform — big enough for high-quality raw footage, small enough to upload fast.', 'improvement', 'approved', 'manual', true, now() - interval '22 days'),
('Action-based creative directions', 'Every AI visual direction now describes what you''re doing in the shot (lofi, real life) — no awkward acting prompts.', 'improvement', 'approved', 'manual', true, now() - interval '23 days'),
('Seller + Buyer perspective copy', 'Hooks and primary copy are now generated from both your perspective AND your buyer''s perspective so you get a wider angle library.', 'improvement', 'approved', 'manual', true, now() - interval '24 days'),
('Advisory tone across all AI feedback', 'Lumi now says "we recommend" instead of "you should" — gentler, clearer, more like a strategist than a critic.', 'improvement', 'approved', 'manual', true, now() - interval '25 days'),
('Meta Graph API v21.0 upgrade', 'Backend now talks to Meta''s newest API version for faster syncs and fewer ad-account permission errors.', 'improvement', 'approved', 'manual', true, now() - interval '26 days'),
('adsbylumi.com OAuth on Meta connect', 'Cleaner branded Meta connection flow — you''ll see "adsbylumi.com" instead of a generic Supabase URL.', 'improvement', 'approved', 'manual', true, now() - interval '27 days'),
('GitHub → changelog auto-drafts', 'Every code push now auto-drafts a plain-English changelog entry for admin approval, so nothing meaningful slips past the newsletter.', 'feature', 'approved', 'manual', true, now() - interval '28 days'),
('Try-again fallbacks on every data load', 'Empty states across the app now show a "Try again" button instead of a silent spinner so you''re never stuck.', 'improvement', 'approved', 'manual', true, now() - interval '29 days'),
('Slack alerts trimmed to what matters', 'Internal Slack only pings on bug reports and new signups — no more notification noise drowning out the important stuff.', 'improvement', 'approved', 'manual', true, now() - interval '30 days');

-- 2) Auto-draft trigger on lumi_features
CREATE OR REPLACE FUNCTION public.lumi_feature_to_changelog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body text;
  v_category text;
BEGIN
  -- Only react to user-meaningful changes
  IF TG_OP = 'INSERT' THEN
    v_category := 'feature';
    v_title := left('New: ' || COALESCE(NEW.name, 'Feature added'), 120);
    v_body := COALESCE(NEW.short_description, NEW.why_helpful, 'A new feature was added to the Lumi catalog. Draft this into next month''s newsletter.');
  ELSIF TG_OP = 'UPDATE' THEN
    -- Skip noise: only fire when name / description / why_helpful actually changed
    IF NEW.name IS NOT DISTINCT FROM OLD.name
       AND NEW.short_description IS NOT DISTINCT FROM OLD.short_description
       AND NEW.why_helpful IS NOT DISTINCT FROM OLD.why_helpful THEN
      RETURN NEW;
    END IF;
    v_category := 'improvement';
    v_title := left('Updated: ' || COALESCE(NEW.name, 'Feature updated'), 120);
    v_body := COALESCE(NEW.short_description, NEW.why_helpful, 'A feature in the Lumi catalog was updated.');
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.changelog_entries (title, body, category, approval_status, source, is_user_visible)
  VALUES (v_title, v_body, v_category, 'draft', 'features_catalog', true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lumi_feature_to_changelog ON public.lumi_features;
CREATE TRIGGER trg_lumi_feature_to_changelog
AFTER INSERT OR UPDATE ON public.lumi_features
FOR EACH ROW
EXECUTE FUNCTION public.lumi_feature_to_changelog();