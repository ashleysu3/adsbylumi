# Admin: Send Test Weekly Ad Report

Give admins a way to send a real (not sample) weekly ad report for any user/brand, to any email address, for a chosen time window. Uses the exact same engine + email template the live cron uses — just bypasses the "is it Monday / already sent" gating and lets you override the recipient.

## What gets built

### 1. New admin page: `/admin/test-reports`
- Linked from `AdminTabs`.
- Form fields:
  - **Brand** — searchable select of all brands (shows brand name + owner email).
  - **Send to** — email input (defaults to the brand owner's email; admin can override).
  - **Time window** — preset buttons: Last 7 days (default), Last 14 days, Last 30 days.
  - **Send Test Report** button.
- After send: shows status (sent / skipped / error), how many campaigns had data in the window, and any error detail.

### 2. Extend `supabase/functions/send-weekly-reports`
Add an `adminTestMode` branch (admin-authenticated, similar shape to existing `testMode`):

```ts
// body: { adminTestMode: true, brandId, recipientEmail, daysWindow }
```

Branch behavior:
- Verify caller is an admin (`has_role(auth.uid(), 'admin')`) using a user-context client.
- Load just the one brand + its workspaces (reuses the existing select).
- Skip frequency / Monday / last_sent gating.
- For each workspace, filter `performance_history` snapshots to `now() - daysWindow .. now()`; sum spend/reach/impressions over that window to decide "had delivery in the period." Skip campaigns with no delivery (matches live rule).
- Run the same `generate-recommendations` invoke per workspace (same engine → same cardDisplay + topRecs).
- Build email with the **existing** `buildBigPictureEmail` / `buildQuietWeekEmail`, prefix subject with `[TEST]` and the window label.
- Send via Resend to `recipientEmail` (override; never to the brand owner unless they typed it).
- Do **not** update `last_report_sent_at` (so a test send never blocks the real Monday send).
- Return `{ ok, campaignCount, status }`.

Cron path and existing `testMode` (sample) branch are unchanged.

### 3. Route + nav
- Register `/admin/test-reports` in `src/App.tsx` (admin-protected like other admin routes).
- Add a tab to `AdminTabs` ("Test Reports").

## Out of scope
- Pulling fresh Meta data on demand for arbitrary ranges (would require Meta API roundtrips per brand). We use what's already in `performance_history`, which is what the live email uses.
- Bulk-sending to many brands at once.
- Custom from/subject — same template, same `reports@adsbylumi.com` sender.

## Technical notes
- Admin check uses the two-client pattern: anon client with the user's `Authorization` to verify role, service-role client for the data fetch + send.
- Reuses `buildBigPictureEmail`, `buildQuietWeekEmail`, `CampaignRow`, `statusColors` — no template duplication.
- Frontend uses `supabase.functions.invoke('send-weekly-reports', { body: { adminTestMode: true, ... } })`, which auto-attaches the admin's auth token.
- After file edits I'll deploy `send-weekly-reports`.
