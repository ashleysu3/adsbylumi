

# Weekly Email Report Scheduling & User Preferences

## Overview
This plan implements automatic scheduling of performance reports with user-configurable frequency (off/daily/weekly) and verifies the email system works end-to-end.

## Technical Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Report Scheduling Flow                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    Daily @ 8am UTC    ┌────────────────────┐ │
│  │   pg_cron    │ ──────────────────────▶│ send-weekly-reports│ │
│  │  scheduler   │                        │   edge function    │ │
│  └──────────────┘                        └─────────┬──────────┘ │
│                                                    │             │
│                                    ┌───────────────▼────────────┐│
│                                    │  For each brand:           ││
│                                    │  1. Check report_frequency ││
│                                    │  2. Check last_report_sent ││
│                                    │  3. Send if due            ││
│                                    └───────────────┬────────────┘│
│                                                    │             │
│                         ┌──────────────────────────▼───────────┐ │
│                         │           Resend API                 │ │
│                         │    (sends branded HTML email)        │ │
│                         └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## What You'll Get

1. **User Preference Control**: Users can choose "Off", "Daily", or "Weekly" from Settings → Notifications
2. **Automatic Scheduling**: Reports send automatically without manual intervention
3. **Smart Deduplication**: System tracks when last report was sent to avoid duplicates
4. **Verification Test**: Ability to manually trigger and verify the email flow

---

## Part 1: Database Changes

### Add report tracking columns to brands table

**Migration SQL:**
```sql
-- Add report_frequency field to notification_preferences JSON
-- No schema change needed - notification_preferences already supports JSON
-- However, we'll document the expected structure:
-- {
--   "report_frequency": "off" | "daily" | "weekly",
--   "critical_alerts": boolean,
--   "performance_drops": boolean,
--   "last_report_sent_at": ISO timestamp string
-- }

-- Enable required extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

---

## Part 2: Update Settings UI

### File: `src/pages/Settings.tsx`

**Changes:**
1. Replace `weekly_digest: boolean` with `report_frequency: 'off' | 'daily' | 'weekly'`
2. Add Select dropdown instead of Switch toggle
3. Add migration logic for users with old `weekly_digest` boolean

**Updated Interface:**
```typescript
interface NotificationPrefs {
  report_frequency: 'off' | 'daily' | 'weekly';  // NEW: Replaces weekly_digest
  critical_alerts: boolean;
  performance_drops: boolean;
  last_report_sent_at?: string;  // NEW: Track last send time
}
```

**UI Change (Notifications Tab):**
- Replace the "Weekly Performance Digest" Switch with a Select dropdown:
  - **Off** - No automated reports
  - **Daily** - Receive a daily performance summary
  - **Weekly** - Receive a weekly performance summary (Mondays)

---

## Part 3: Update Edge Function

### File: `supabase/functions/send-weekly-reports/index.ts`

**Current Behavior:** Sends to all users with published workspaces
**New Behavior:** 
1. Check user's `report_frequency` preference
2. Skip if "off"
3. For "weekly": Only send on Mondays, skip if sent within 7 days
4. For "daily": Skip if already sent today
5. Update `last_report_sent_at` after successful send

**Key Logic Changes:**
```typescript
// Fetch notification_preferences from brands table
const prefs = brand.notification_preferences || { report_frequency: 'weekly' };

// Skip if reports turned off
if (prefs.report_frequency === 'off') {
  continue;
}

// Check timing based on frequency
const today = new Date();
const lastSent = prefs.last_report_sent_at ? new Date(prefs.last_report_sent_at) : null;

if (prefs.report_frequency === 'weekly') {
  // Only send on Mondays (day 1)
  if (today.getUTCDay() !== 1) continue;
  // Skip if sent within last 7 days
  if (lastSent && (today.getTime() - lastSent.getTime()) < 7 * 24 * 60 * 60 * 1000) continue;
}

if (prefs.report_frequency === 'daily') {
  // Skip if already sent today
  if (lastSent && lastSent.toDateString() === today.toDateString()) continue;
}

// After successful send, update last_report_sent_at
```

**Also fix the import:**
```typescript
// Change from:
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// To:
import { createClient } from 'npm:@supabase/supabase-js@2';
```

---

## Part 4: Schedule the Cron Job

**SQL to execute (via Run SQL tool):**
```sql
-- Schedule send-weekly-reports to run daily at 8:00 AM UTC
-- The function internally handles daily/weekly logic
SELECT cron.schedule(
  'send-performance-reports',
  '0 8 * * *',  -- Every day at 8:00 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://sqwjbndgighjtifijgws.supabase.co/functions/v1/send-weekly-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## Part 5: Verification & Testing

### Test 1: Manual Trigger
- Call the edge function directly via `supabase--curl_edge_functions`
- Verify it returns success with sent/skipped counts

### Test 2: Check Email Delivery
- Confirm Resend API key is configured (already in secrets)
- Check that the `from` email domain is verified in Resend

### Test 3: End-to-End
- Set a test user to "daily" frequency
- Trigger the function
- Verify email arrives

---

## Summary of Files Changed

| File | Change Type | Description |
|------|------------|-------------|
| `src/pages/Settings.tsx` | Modify | Replace weekly_digest boolean with report_frequency dropdown |
| `supabase/functions/send-weekly-reports/index.ts` | Modify | Add frequency logic, fix imports, update last_sent tracking |
| Database | SQL | Enable pg_cron + pg_net, schedule daily job |

## After Implementation

1. **Users can control frequency** from Settings → Notifications
2. **Reports send automatically** - no user action required
3. **Weekly reports** arrive on Monday mornings (8 AM UTC)
4. **Daily reports** arrive every morning (8 AM UTC)
5. **Email includes**: Spend, reach, conversions, what's working, what needs attention, AI recommendations

