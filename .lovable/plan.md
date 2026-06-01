
# Lumi Updates → Newsletter System

A single admin workflow that captures product updates, drafts both a user newsletter and a partner edition, tracks engagement, and rewards friend referrals.

## 1. Updates hub (Admin)

New admin page `/admin/updates`:
- **Auto-pulled signals** shown as checkable cards:
  - Recent deploys / git activity (from a new `release_log` table populated via a deploy webhook; backfill manually for now)
  - Manual changelog entries you log anytime (`changelog_entries` table)
  - Usage analytics — most-used and least-used features over the last 30 days (from existing event tables; "needs attention" = low usage + recently shipped)
- Checkbox each item you want to highlight this month
- Add 2–4 **angle ideas** per highlighted item (AI-suggested, editable: e.g., "time-saver", "before/after", "founder story")
- A **custom note from Ashley** field
- "Generate draft" button → calls AI with the selected items + angles + your note

Reuses existing `partner_updates` table for the items that should also appear in the partner portal — auto-published when included in a sent newsletter.

## 2. Newsletter drafting & editing

New table `newsletter_campaigns` (one row = one monthly send):
- Stores: month label, selected update IDs, angles, custom note, **user_html**, **partner_html**, **subject_a**, **subject_b** (resend subject), status (`draft|scheduled|sending|sent`), `scheduled_at`, `sent_at`
- AI generates:
  - 3 subject line options for each variant (you pick one + a backup for the 48h resend)
  - **User newsletter body**: product news, friendly Ashley tone, footer with "Forward to a friend → they get Lumi, you get $40 credit" with the user's unique referral URL
  - **Partner edition body**: same news + appended "How to share this month" section with copy tidbits, swipe captions, and angle ideas. No forward CTA.
- Rich editor (Tiptap, already in stack pattern) to tweak both bodies and subject lines before scheduling
- Preview pane that swaps between user and partner views

## 3. Sending, scheduling, resend

- "Send now" or "Schedule for…"
- A cron-scheduled edge function `dispatch-newsletter` runs every 5 min, picks up due campaigns, and enqueues one transactional email per recipient via the built-in `send-transactional-email` function (one template `monthly-newsletter` with `variant: user|partner` and per-recipient `referralUrl`)
- Recipients:
  - User edition → all users with `newsletter_opt_in = true` (new column on profiles, default true; unsubscribe handled by existing footer)
  - Partner edition → everyone in `partner_access_tokens` with a linked `partner_user_id`
- **48h resend with new subject**: a second cron job re-enqueues unopened recipients with `subject_b`. Tracked via `newsletter_sends` rows (one per recipient per variant)

## 4. Open/click tracking & results dashboard

- `newsletter_sends` table: campaign_id, recipient_email, variant, message_id, sent_at, opened_at, clicked_at, resent_at
- Tracking pixel + link wrapping handled inside the `monthly-newsletter` template; an edge function `newsletter-track` records opens/clicks
- Results view in `/admin/updates/[campaignId]`: total sent, open rate, click rate, top links, partner vs user breakdown, list of who hasn't opened (feeds the resend)

## 5. Friend-forward + $40 referral credit

- Footer CTA in user newsletter only: "Know someone who needs Lumi? Send them your link → they get Lumi, you get $40 off your next month"
- Each user gets a stable `referral_code` (added to `profiles`)
- Landing on `/?ref=CODE` stores the code in localStorage; checkout edge function reads it and:
  - On successful paid signup, inserts a row into new `account_credits` table for the referrer ($40, currency USD, applied to next Stripe invoice via `stripe.customers.createBalanceTransaction`)
  - Records the referral in `referrals` table (referrer_user_id, referred_user_id, status, credited_at)
- Credit is only granted when the referred user is a **standard** (non-partner) signup — partners already have their own Rewardful flow
- User-facing "Your credits" card on Settings page shows balance and history

## 6. What the user (Ashley) sees

```text
/admin/updates
├─ "This month's updates" — checklist of auto-pulled + manual items
├─ Angles & custom note section
├─ [Generate draft]
├─ Draft editor (User tab | Partner tab)
│   ├─ Subject line picker (A + resend B)
│   └─ Rich text body with merge tags
├─ [Save draft] [Schedule] [Send now]
└─ Past campaigns list → click into results dashboard
```

## Technical section

**New tables (all with GRANTs + RLS):**
- `changelog_entries` (title, body, category, created_by, created_at) — admin-only
- `release_log` (sha, title, deployed_at, summary) — admin-only, populated manually for now
- `newsletter_campaigns` (see fields above) — admin-only write, no public read
- `newsletter_sends` (campaign_id, recipient_email, variant, message_id, sent_at, opened_at, clicked_at, resent_at, resend_message_id) — admin-only read
- `account_credits` (user_id, amount_cents, currency, source, source_ref, applied_at, stripe_balance_transaction_id) — user can read own
- `referrals` (referrer_user_id, referred_user_id, referred_email, code, status, credited_at) — user can read own (as referrer)
- Add `referral_code` (unique) and `newsletter_opt_in` (bool default true) to `profiles`

**New edge functions:**
- `generate-newsletter-draft` — calls Lovable AI (google/gemini-2.5-pro) with selected updates + angles + note; returns `{user_html, partner_html, subject_options:[3], resend_subject_options:[3], partner_share_tidbits}`
- `suggest-update-angles` — small AI call returning 4 angles per update item
- `dispatch-newsletter` — cron, drains due campaigns, enqueues per-recipient sends via `send-transactional-email` with idempotency key `nl-{campaign_id}-{variant}-{recipient}`
- `resend-newsletter-unopened` — cron, runs hourly, finds sends >48h old with `opened_at IS NULL AND resent_at IS NULL`, re-enqueues with `subject_b` and idempotency key `nl-{campaign_id}-{variant}-{recipient}-resend`
- `newsletter-track` — public GET endpoints for pixel (`/open?s=...`) and link redirect (`/c?s=...&u=...`); writes timestamps
- `process-referral-credit` — called from Stripe webhook on first successful paid invoice for a referred user; inserts `account_credits` row, calls Stripe `createBalanceTransaction` for -$4000 on referrer's customer

**New transactional template:** `monthly-newsletter.tsx` accepts `{variant, subject, htmlBody, referralUrl?, recipientName?}`. Partner variant omits the forward block entirely. Registered in template registry.

**Cron jobs (via pg_cron):**
- `dispatch-newsletter` every 5 min
- `resend-newsletter-unopened` every hour

**Auto-pull queries:**
- Deploys: `release_log` last 30 days
- Manual: `changelog_entries` last 30 days where `included_in_campaign_id IS NULL`
- Usage: read from existing analytics events — top 5 / bottom 5 features by event count, plus features deployed in last 30 days with low adoption (flagged "needs attention")

**Frontend pages/components:**
- `src/pages/admin/Updates.tsx` — hub + drafting flow
- `src/pages/admin/UpdatesResults.tsx` — per-campaign analytics
- `src/components/admin/UpdatesChecklist.tsx`, `NewsletterEditor.tsx`, `SubjectPicker.tsx`
- `src/pages/Settings.tsx` — add "Your credits" + "Your referral link" card
- Hook `useReferralCapture` mounted in `App.tsx` to persist `?ref=` to localStorage
- Add Updates link to `AdminTabs.tsx`

**Reuses existing infrastructure:**
- `send-transactional-email` (no new sender)
- `partner_updates` table — auto-publish included items when campaign sends
- Stripe customer + subscription already wired
- Admin auth via existing `has_role`

## What I'll skip unless you ask

- A/B testing beyond the 48h resend
- Multi-segment user lists (only opt-in / opt-out)
- Editing already-sent campaigns
- Auto-publishing release notes from GitHub (manual `release_log` for now; add webhook later)
