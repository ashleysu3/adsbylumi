

## Consolidate Weekly Email: One Email, All Campaigns + Creative Fatigue Actions

### Problem Today
The `send-weekly-reports` function sends **one email per campaign/workspace**. A user with 5 campaigns gets 5 separate emails. The user wants ONE consolidated email per brand showing all campaigns at a high level, plus creative refresh suggestions for any fatigued campaigns.

### Plan

**1. Restructure `send-weekly-reports` to group by user/brand**

Instead of looping through workspaces and sending one email each, group all workspaces by `brand.user_id` first, then build a single consolidated email per user containing all their campaigns.

**2. Redesign the email template to show all campaigns in one view**

Each campaign gets a compact row showing:
- Status emoji (green/yellow/red)
- Campaign name
- Total spend for the period
- Primary KPI result vs goal (e.g., "CPL: $4.82 / Goal: < $6.00")
- A one-line status note

At the top: aggregate totals (total spend across all campaigns, how many on track vs needing attention).

**3. Add creative fatigue detection + actionable suggestions**

For each campaign, check `frequency` from the latest performance snapshot:
- If frequency >= 3.5, flag it as fatigued
- Generate a short, specific creative suggestion based on what's performing (high CTR = "try a new variation of your best hook", high ROAS = "film a testimonial version")
- Include a "Refresh Creative →" button linking directly to `/creative-studio?workspace={id}&refreshCreative=true`

This section appears as a distinct "🔄 Creative Refresh Needed" block in the email, only for campaigns with fatigue.

**4. Keep the existing frequency controls**

Daily/weekly toggle, last-sent-at deduplication, and notification preferences all remain unchanged. The only difference is the email content is now consolidated.

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/send-weekly-reports/index.ts` | Group workspaces by user, build single consolidated email with all campaigns, add fatigue detection and creative suggestions per campaign |

### Technical Notes
- The `send-optimization-digest` function (used by the agency digest system) remains untouched — it serves a different flow
- Performance data already includes `frequency` in the metrics snapshot, so no new data fetching is needed
- Creative suggestion logic mirrors what already exists in `generate-weekly-report` and `generate-client-report` ("Try This" sections)
- Deep links use the published domain: `https://adsbylumi.com/creative-studio?workspace={id}&refreshCreative=true`

