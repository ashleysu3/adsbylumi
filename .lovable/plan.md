## Goal

1. Let admins **comp a partner's Lumi membership** with a single toggle on the partner record.
2. Give partners a **dedicated Partner Portal** they reach from a persistent banner at the top of every Lumi screen, with everything they need to promote Lumi.

---

## 1. Link partners to user accounts + comp toggle

To both comp memberships and show the banner only to partners, each partner record needs to know which Lumi user is the partner.

**Migration on `partner_access_tokens`:**

- `partner_user_id uuid` — the user account that belongs to this partner (nullable; set by admin via email lookup).
- `partner_email text` — convenience field shown in admin.
- `membership_comped boolean default false` — when true, subscription checks treat them as a paid Agency-tier user.
- `comped_at timestamptz`, `comped_by uuid` — audit.

**Admin Partners page (`/admin/partners`):**

- New "Partner account" section with:
  - Email input → "Link account" button (resolves to `auth.users` via existing admin email lookup pattern; stores `partner_user_id`).
  - Shows linked account email + "Unlink".
  - Toggle: **"Comp Lumi membership"** (disabled until account is linked). Saves `membership_comped`, `comped_at`, `comped_by`.

**Subscription gating:**

- Extend `SubscriptionContext` (and the server-side check used by edge functions) to treat a user as fully active when a row in `partner_access_tokens` matches `partner_user_id = auth.uid()` AND `membership_comped = true`. They get Agency-tier limits while comped.

---

## 2. Partner Portal page

New route `**/partner-portal**` (auth-gated, only accessible to linked partners).

**Sections (all driven by fields already on `partner_access_tokens` plus a few new ones):**

1. **Hero** — partner photo + name + "Welcome back, {name}".
2. **Your referral toolkit**
  - Big copy-to-clipboard card for their `referral_link`.
  - Their unique `partner_trial_code` (with copy button) + the trial length they're offering.
  - "Share preview" — link to `/?code=ASHLEY` so they can see what their audience sees.
3. **Resources for sharing** (new jsonb `share_resources` on partner row, admin-editable list of `{ title, description, url, type }` — swipe copy, graphics, demo videos, email templates).
4. **What's new in Lumi** — pulled from existing `site_settings` / changelog data if available; otherwise a new `partner_updates` admin-managed list (title, body, link, published_at). Shows latest 5.
5. **Get support & grow with us**
  - "Book a 1:1 call with Ashley" → calendar link (admin-configurable global setting).
  - "Join office hours" → `/office-hours` link.
  - "Request a joint webinar / community training" → opens a simple form that emails Ashley (reuses existing Resend setup).
  - "Email Ashley directly" → `mailto:` with prefilled subject (configurable global setting).
6. **Your impact** (lightweight) — display the Rewardful-tracked stats if easy; otherwise just a "View earnings on Rewardful" button using the referral link's `?via=` slug.

**Persistent banner:**

- New `PartnerPortalBanner` component rendered inside `DashboardLayout` (above `SubscriptionBanner`), shown only when the logged-in user is linked to a partner row.
- Copy: "You're a Lumi Partner — open your Partner Portal" + button → `/partner-portal`.
- Dismissible per-session (localStorage), but reappears on next login.

---

## 3. Global settings used by the portal

Stored in existing `site_settings` table (one row, key `partner_portal_config`):

- `andrew_calendar_url`
- `andrew_email`
- `webinar_request_recipient`
- `default_share_resources` (used as fallback if a partner has none of their own)

Admin manages these inside the existing `/admin/settings` page (new "Partner Portal" tab).

---

## Technical notes

- New edge function `partner-webinar-request` — validates auth + partner status, sends Resend email to Andrew.
- Reuse `partner-assets` storage bucket for any uploaded resources.
- `get_partner_welcome` RPC unchanged; add a new RPC `get_my_partner_portal()` that returns the full portal payload for `auth.uid()` (joins partner row + global settings + updates).
- All new tables/columns get GRANTs + RLS.
- No changes to public sales / onboarding flow.

---

## Files

**New:**

- `supabase/migrations/<ts>_partner_portal.sql`
- `supabase/functions/partner-webinar-request/index.ts`
- `src/pages/PartnerPortal.tsx`
- `src/components/PartnerPortalBanner.tsx`
- `src/components/admin/PartnerPortalSettings.tsx`

**Edited:**

- `src/pages/admin/Partners.tsx` — link account + comp toggle + share resources repeater + partner updates repeater
- `src/pages/admin/Settings.tsx` — new Partner Portal tab
- `src/App.tsx` — `/partner-portal` route
- `src/components/DashboardLayout.tsx` + `MobileHeader.tsx` — render `PartnerPortalBanner`
- `src/contexts/SubscriptionContext.tsx` — honor `membership_comped`