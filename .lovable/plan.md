

## Fix Weekly Reports and Auto-Optimizations

### Problems Identified

1. **`schedule-digests` has no cron job** — the edge function exists but nothing triggers it. The existing `send-weekly-reports` cron (jobid 1 & 4) is an older system that runs independently.

2. **`run-optimization-report` requires user auth** — when `schedule-digests` calls it via HTTP with the anon key, it returns 401. The fallback creates an empty stub report with no real data. This means digest emails contain no actual performance insights.

3. **No auto-optimization execution** — the optimization report generates recommendations (scale budget, pause ads, refresh creative) but nothing acts on them. There's no mechanism to auto-apply or queue these for user approval.

### Plan

**1. Make `run-optimization-report` work in cron context (service-role mode)**

Modify `supabase/functions/run-optimization-report/index.ts` to accept a `serviceRoleMode` flag. When called with a service-role key and a `brandId` (no user JWT), skip the user auth check and use service-role privileges to read the brand's Meta token directly from the DB. This lets `schedule-digests` generate real reports.

- Add a check: if Authorization header contains the service-role key, skip `getUser()` and set `userId` from the brand's `user_id` field
- Keep existing user-auth path for interactive (dashboard) calls

**2. Add cron job for `schedule-digests`**

Create a pg_cron job that calls `schedule-digests` every hour. The function already handles timezone-aware day/time matching internally, so hourly polling ensures it fires at the right local time for each user.

**3. Create auto-optimization edge function**

Create `supabase/functions/apply-optimizations/index.ts` that:
- Fetches the latest optimization report for a brand
- For each recommendation, checks the user's preference (auto vs manual)
- If auto-approved: executes the action via Meta API (pause ad, scale budget)
- If manual: stores as a pending action in a new `pending_optimizations` table for user approval
- Logs all actions taken

**4. Add `pending_optimizations` table**

Store queued recommendations that need user approval (or were auto-applied):
- `id`, `brand_id`, `workspace_id`, `report_id`, `recommendation_type`, `action_description`, `status` (pending/approved/rejected/applied), `auto_applied`, `created_at`, `resolved_at`

**5. Add auto-optimize preference to digest settings**

Add `auto_optimize` boolean to `digest_settings` (default false). When true, `apply-optimizations` auto-executes safe actions (pause budget hogs, scale green campaigns). When false, actions are queued as pending for the user to approve in the dashboard.

**6. Add pending optimizations UI to Data page**

In `src/pages/Data.tsx`, show a banner/card when there are pending optimization actions. Each action has Approve/Reject buttons. Auto-applied actions show as "Applied by Lumi" with an undo option.

**7. Wire `schedule-digests` to call `apply-optimizations` after report generation**

After the digest sends, if auto-optimize is enabled or there are pending actions, call the optimization function.

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/run-optimization-report/index.ts` | Add service-role mode for cron context |
| `supabase/functions/schedule-digests/index.ts` | Call run-optimization-report with service-role key; call apply-optimizations |
| `supabase/functions/apply-optimizations/index.ts` | New — execute or queue optimization actions |
| `supabase/config.toml` | Add `apply-optimizations` config |
| `src/pages/Data.tsx` | Add pending optimizations card with approve/reject UI |
| DB migration | Create `pending_optimizations` table; add `auto_optimize` column to `digest_settings` |
| Cron job (SQL insert) | Schedule `schedule-digests` hourly |

### Technical Details

**Service-role detection in `run-optimization-report`:**
```
const isServiceRole = token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (isServiceRole) {
  // Skip getUser, use brandId to look up user_id from brands table
} else {
  // Existing user auth flow
}
```

**Meta API actions for auto-optimization:**
- Pause ad: `POST /{ad-id}?status=PAUSED`
- Scale budget: `POST /{campaign-id}?daily_budget={new_budget}`
- These require `ads_management` permission (already required for campaign building)

**Cron schedule:** `0 * * * *` (every hour, schedule-digests handles timezone matching internally)

