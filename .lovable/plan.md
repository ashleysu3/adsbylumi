

## Plan: Beta Welcome Email + 7-Day Feedback Email with Slack Integration

### What needs to happen

1. **Add `is_beta` flag to `invite_codes` table** — a boolean column so you can mark specific codes as beta codes. Existing codes default to `false`.

2. **Create `send-beta-welcome-email` Edge Function** — a branded Lumi email explaining:
   - What beta means (they're shaping the platform with their feedback)
   - There may be bugs — that's expected
   - How to report bugs: ladybug button in bottom-right corner, or email support@adsbylumi.com
   - Please give feedback on the app itself

3. **Create `send-beta-feedback-email` Edge Function** — sent 7 days after signup, containing:
   - 3-4 short questions (e.g., "What's been your favorite feature?", "What felt confusing?", "What's missing?", "How likely are you to recommend Lumi?")
   - Each question links to a simple reply mechanism — since we can't embed forms in email, the CTA will link to a lightweight feedback page OR use a `reply-to` pattern
   - Actually: simplest approach is a dedicated `/beta-feedback` page in the app that posts responses to a `beta_feedback` table, which triggers a Slack notification

4. **Create `beta_feedback` database table** — stores responses tied to user_id

5. **Create `send-beta-feedback-to-slack` Edge Function** (or inline in the feedback submission) — posts the user's answers to the Slack channel

6. **Wire up Auth.tsx** — after signup with a beta code, fire `send-beta-welcome-email` alongside the regular welcome email

7. **Schedule the 7-day follow-up** — store `beta_signup_at` timestamp, then use a cron job (or a scheduled edge function) to query users who signed up 7 days ago with a beta code and send the feedback email

### Database Changes

**Migration 1: Add `is_beta` to `invite_codes`**
```sql
ALTER TABLE public.invite_codes ADD COLUMN is_beta boolean NOT NULL DEFAULT false;
```

**Migration 2: Create `beta_feedback` table**
```sql
CREATE TABLE public.beta_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  favorite_feature text,
  confusing_part text,
  missing_feature text,
  recommendation_score integer,
  additional_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback" ON public.beta_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON public.beta_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback" ON public.beta_feedback
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
```

**Migration 3: Track beta users for the 7-day email**
Add `is_beta_user` and `beta_feedback_sent` to `profiles`:
```sql
ALTER TABLE public.profiles 
  ADD COLUMN is_beta_user boolean NOT NULL DEFAULT false,
  ADD COLUMN beta_feedback_email_sent boolean NOT NULL DEFAULT false;
```

### New Edge Functions

1. **`send-beta-welcome-email`** — Resend email with Lumi branding, beta-specific copy, ladybug instructions
2. **`send-beta-feedback-email`** — Resend email with 3-4 questions + CTA to `/beta-feedback` page
3. **`send-beta-feedback-requests`** — Cron-triggered function that queries profiles where `is_beta_user = true` AND `beta_feedback_email_sent = false` AND `created_at <= now() - interval '7 days'`, sends the feedback email, then marks `beta_feedback_email_sent = true`

### New Frontend Page

**`/beta-feedback`** — simple branded page with 3-4 questions:
- "What's been your favorite feature so far?"
- "What felt confusing or hard to find?"
- "What feature do you wish Lumi had?"
- "On a scale of 1-10, how likely are you to recommend Lumi?"

On submit: insert into `beta_feedback`, then invoke a Slack notification to the `lumi-alerts` channel with the user's answers.

### Auth.tsx Changes

In the signup flow (around line 94), after claiming the invite code:
- Query `invite_codes` to check if the claimed code has `is_beta = true`
- If yes: set `is_beta_user = true` on the profile, and fire `send-beta-welcome-email` alongside the regular welcome email

### Config Updates

Add all three new functions to `supabase/config.toml` with `verify_jwt = false` (for the cron function) or `verify_jwt = true` as appropriate.

Set up a cron job to run `send-beta-feedback-requests` daily.

### Files to Create/Edit

| File | Action |
|------|--------|
| `supabase/functions/send-beta-welcome-email/index.ts` | Create |
| `supabase/functions/send-beta-feedback-email/index.ts` | Create |
| `supabase/functions/send-beta-feedback-requests/index.ts` | Create |
| `src/pages/BetaFeedback.tsx` | Create |
| `src/App.tsx` | Add `/beta-feedback` route |
| `src/pages/Auth.tsx` | Check `is_beta` on code, fire beta email, mark profile |
| `supabase/config.toml` | Add 3 new function entries |
| Database migrations | 3 migrations as above |
| Cron job SQL | Schedule daily `send-beta-feedback-requests` |

