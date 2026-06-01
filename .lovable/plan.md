## Goal

Make the **Partner Codes** page the single hub for everything about a partner — application, affiliate stats, portal config, comp toggle, trial code. The detail dialog becomes the one place you go to review, approve, configure, and manage a partner.

## What changes

### 1. Database link
Add `partner_application_id` (nullable, FK → `partner_applications.id`) to `partner_access_tokens`, plus `rewardful_affiliate_id` (text) so the dialog can pull live commissions/conversions. When the admin approves an application from anywhere, both fields get populated on the new/updated partner row.

### 2. Partner Codes page (`src/pages/admin/Partners.tsx`)
- Loads partner applications and Rewardful affiliate data alongside partner codes (one call to `admin-get-affiliates`, same source the Affiliates page already uses).
- New section above the codes list:
  - **Pending applications** (count + list with Open buttons) — clicking opens the unified dialog in "new from application" mode, pre-filled with name/email/trial code, with the application context visible inside.
  - **Approved applications without a portal yet** — same one-click open.
- Each existing partner card shows a small "Has application" / "X conversions" / "$Y earned" badge when applicable.

### 3. Unified dialog
Existing edit dialog gains tabs at the top:
- **Overview** (existing fields — name, code, photo, welcome message, trial length, referral link, comp toggle, link account, perks/strategies/resources, active switch).
- **Application** — audience description, promotion plan, share plan, applied date, admin notes, and (if status is pending) **Approve** + **Decline** buttons. Approve runs the existing `create-affiliate` + `send-partner-approval` flow, then writes `partner_application_id` and `rewardful_affiliate_id` onto the partner record so they stay linked.
- **Affiliate** — Rewardful stats (referral link, leads, conversions, earned, status) pulled from the same payload, plus an "Open in Rewardful" link.

### 4. Affiliates page (`src/pages/admin/Affiliates.tsx`)
- "Open Application" button on the applications tab now navigates to `/admin/partners?app={id}`, which auto-opens the unified dialog there.
- The old `PartnerApplicationDrawer` stays available but is no longer the primary entry point.

### 5. Linkage on existing approvals
When the Affiliates page approval flow runs (already there), it now also writes the new `partner_application_id` + `rewardful_affiliate_id` onto the partner_access_tokens row it touches/creates so future opens land in the unified view.

## Out of scope
- No changes to the public partner portal, application form, or email template.
- No change to how affiliate commissions are tracked in Rewardful.

## Technical notes
- Migration adds two nullable columns; no data backfill required (older approvals continue working — the dialog just won't show an Application tab when the FK is empty, and falls back to matching by email if `rewardful_affiliate_id` is missing).
- Approve action inside the dialog reuses `supabase.functions.invoke('create-affiliate')` and `send-partner-approval` so behavior matches the Affiliates page exactly.
- Deep-link via `?app={uuid}` is read in a `useEffect` on Partners page; if the application is already linked to a partner, opens that partner; otherwise opens a pre-filled new-partner dialog.
