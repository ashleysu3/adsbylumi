

## Plan: Improve Client Report Modal — Formatting, Scrolling, Gating, Slack + Scheduling

### Problem Summary
1. Report text looks messy / poorly formatted inside the modal
2. Can't scroll through the full report
3. No subscription gating — should be agency-only
4. No Slack integration for pushing reports to client channels
5. No scheduling with auto-send vs approval toggle

---

### 1. Fix Report Formatting (ReportSectionRenderer)

**File: `src/components/insights/ReportSectionRenderer.tsx`**

Enhance the renderer to handle markdown-style formatting the AI returns:
- Parse `**bold**` → `<strong>`
- Parse `---` horizontal rules → `<hr>`
- Parse bullet lines (`- ` or `• `) into styled list items with proper indentation
- Parse metric lines (e.g., `CPL: $4.20`) into a key-value layout with the value highlighted
- Add spacing between campaign sections
- Style emoji status indicators (🟢🟡🔴) with subtle background badges

### 2. Fix Scrolling in Report Modal

**File: `src/components/insights/ClientReportModal.tsx`**

The `ScrollArea` is already present (line 208) but may not expand properly. Fix:
- Add explicit `overflow-y-auto` and a `max-h` constraint on the report body container
- Ensure the `flex-1 min-h-0` pattern works by verifying parent has a fixed height (`max-h-[90vh]` is set but the inner flex layout needs `overflow-hidden` on the outer container)

### 3. Gate to Agency Tier

**File: `src/components/insights/ClientReportModal.tsx`**

- Import `useSubscription` from `SubscriptionContext`
- When `tier !== 'agency'`, show an upgrade prompt inside the modal instead of the campaign selector/generate button
- Keep the modal openable so users can see what the feature looks like, but disable generation

### 4. Slack Channel Integration + Scheduling

**File: `src/components/insights/ClientReportModal.tsx`**

Add a new "Delivery Settings" section below the report display:
- **Slack Channel**: Text input for a Slack channel name/ID, stored in `digest_settings` (the table already has columns for this — will add a `slack_channel_id` and `report_auto_send` column)
- **Schedule**: Reuse the existing `send_days` pattern from `digest_settings`
- **Auto-send toggle**: A switch between "Auto-send" (report generates and sends automatically) vs "Review first" (report generates, user gets notified to approve before sending)
- Store these settings in `digest_settings` table with new columns

**Database migration** — add columns to `digest_settings`:
```sql
ALTER TABLE public.digest_settings 
  ADD COLUMN IF NOT EXISTS slack_channel_id text,
  ADD COLUMN IF NOT EXISTS report_auto_send boolean DEFAULT false;
```

**Edge function**: Extend `send-optimization-digest/index.ts` to also post to Slack when `slack_channel_id` is set, using the existing Slack connector gateway. When `report_auto_send` is false, skip sending and instead just mark the report as "pending_approval" for the user to review.

### 5. Delivery Settings UI in Modal Footer

After a report is generated, show a collapsible "Delivery Settings" panel:
- Slack channel input (with a "Test" button to send a preview)
- Schedule day picker (reuse existing pattern)
- Toggle: "Auto-send to client" vs "Review before sending"
- Save button that upserts to `digest_settings`

---

### Files to Edit

| File | Change |
|------|--------|
| `src/components/insights/ReportSectionRenderer.tsx` | Better formatting: markdown parsing, styled lists, metric highlights |
| `src/components/insights/ClientReportModal.tsx` | Fix scroll, add agency gate, add delivery settings UI |
| `supabase/functions/send-optimization-digest/index.ts` | Add Slack posting + auto-send vs approval logic |
| Database migration | Add `slack_channel_id`, `report_auto_send` to `digest_settings` |

