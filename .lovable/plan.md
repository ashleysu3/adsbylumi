

# Slack Notifications for New Users, Bug Reports, and Daily Digest

## Overview

This plan connects your app to Slack so you get real-time notifications when someone signs up or reports a bug, plus a daily morning digest that recaps yesterday's most active user, new signups, bug reports, and potential friction points.

## What You Will Get

1. **Instant notification** in a Slack channel when a new user signs up (name + email)
2. **Instant notification** in a Slack channel when a bug is reported (user email, page, description)
3. **Daily morning digest** (8 AM UTC) summarizing:
   - New users from the previous day
   - Bug reports from the previous day
   - Most active user (by number of campaign workspaces created/updated)
   - Potential friction points (users who signed up but never created a brand, users who started onboarding but never connected Meta, etc.)

## Setup Step (Before Code Changes)

The Slack connector needs to be connected to this project. You will be prompted to connect your Slack workspace and select the channels where notifications should go. You can use a single channel (e.g., `#lumi-alerts`) or separate channels for different notification types.

---

## Technical Details

### Step 1: Connect Slack

Use the Slack connector to link a Slack workspace to this project. This provides `SLACK_API_KEY` and `LOVABLE_API_KEY` as environment variables for the backend functions.

### Step 2: Create Edge Function `slack-notify`

**File:** `supabase/functions/slack-notify/index.ts`

A single utility edge function that accepts a JSON body with `channel`, `text`, and optional `blocks` (for rich formatting), and posts a message to Slack via the connector gateway (`https://connector-gateway.lovable.dev/slack/api/chat.postMessage`).

This function uses `LOVABLE_API_KEY` and `SLACK_API_KEY` headers as required by the gateway pattern. It is called internally by other functions (no user-facing).

### Step 3: Update `send-bug-report` Edge Function

**File:** `supabase/functions/send-bug-report/index.ts`

After successfully storing the bug report and sending the email, add a call to the `slack-notify` function (via `fetch` to the function URL) with a formatted Slack message containing:
- Reporter email
- Page where the bug occurred
- Bug description snippet
- Link to admin bug reports page

### Step 4: Create Edge Function `slack-new-user`

**File:** `supabase/functions/slack-new-user/index.ts`

A lightweight function that posts a "New user signed up" message to Slack. It receives `email` and `full_name` in the body.

### Step 5: Update `handle_new_user` Database Function

**Via migration:** After inserting the profile and user role, use `pg_net` to call the `slack-new-user` edge function with the new user's email and name. This ensures every signup triggers a Slack notification automatically at the database level.

```text
auth.users INSERT
      |
      v
  handle_new_user() trigger
      |
      v
  Insert profile + role (existing)
      |
      v
  net.http_post -> slack-new-user edge function
      |
      v
  Slack message: "New user: name (email)"
```

### Step 6: Create Edge Function `slack-daily-digest`

**File:** `supabase/functions/slack-daily-digest/index.ts`

A scheduled function (called daily via pg_cron at 8 AM UTC) that:

1. Queries `profiles` for users created in the last 24 hours (new signups)
2. Queries `bug_reports` for reports created in the last 24 hours
3. Queries `campaign_workspaces` to find the most active user (most workspace creates/updates in the last 24 hours), joined with `brands` and `profiles` to get the user's name/email
4. Detects friction points:
   - Users with a profile but no brand (signed up but didn't complete onboarding)
   - Users with a brand but no `meta_account_id` (skipped Meta connection)
   - Users with a brand but zero offers (never created an offer)
   - Users with offers but zero campaign workspaces (never started creative)
5. Formats all of this into a rich Slack message with sections and posts it via the gateway

### Step 7: Schedule the Daily Digest via pg_cron

Use a SQL insert (not migration) to schedule `slack-daily-digest` to run daily at 8 AM UTC:

```text
cron.schedule('slack-daily-digest', '0 8 * * *', ...)
```

### Files to Create
- `supabase/functions/slack-notify/index.ts` -- shared Slack posting utility
- `supabase/functions/slack-new-user/index.ts` -- new user notification
- `supabase/functions/slack-daily-digest/index.ts` -- daily morning recap

### Files to Modify
- `supabase/functions/send-bug-report/index.ts` -- add Slack notification after bug is stored

### Database Changes
- Migration to update `handle_new_user()` to call `slack-new-user` via `pg_net`
- Enable `pg_net` extension if not already enabled
- pg_cron schedule for the daily digest (via SQL insert, not migration)

