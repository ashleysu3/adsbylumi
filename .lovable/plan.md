

## Ad Action History & Cross-Campaign Cause-Effect Analysis

### Problem
Today, `creative_rotation_log` only tracks creative swaps (pause/activate ads). There's no unified log of ALL ad actions (budget changes, audience edits, status toggles), and the optimization engine doesn't reference past actions when diagnosing performance shifts across campaigns.

### What We'll Build

**1. Unified Ad Actions Log Table**

New `ad_action_log` table to capture every meaningful action taken on any campaign:

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| brand_id | uuid | FK to brands |
| workspace_id | uuid | FK to campaign_workspaces |
| action_type | text | `paused_ad`, `activated_ad`, `budget_change`, `audience_change`, `creative_swap`, `campaign_paused`, `campaign_activated` |
| action_detail | jsonb | Specifics (old/new budget, ad ID, etc.) |
| source | text | `user`, `lumi_auto`, `lumi_approved` |
| meta_entity_id | text | The Meta ad/campaign/adset ID affected |
| created_at | timestamptz | When it happened |

RLS: Users can read/insert for their own brands.

**2. Log Actions From All Touchpoints**

Update these edge functions to insert into `ad_action_log`:
- `rotate-creative` — already logs to `creative_rotation_log`, add to new table too
- `apply-optimizations` — budget changes, pauses
- `check-campaign-status` — ad pause/activate toggles from the dashboard

Update frontend in `Data.tsx` where users approve/dismiss pending optimizations.

**3. Cross-Campaign Cause-Effect in Optimization Reports**

Update `run-optimization-report` to:
- Query `ad_action_log` for actions taken in the 7 days before the report period
- Pass this "recent actions" context to the diagnostic engine
- Add a new recommendation type: `cross_campaign_impact` — e.g., "You paused your Instagram traffic campaign 5 days ago. Your lead gen campaign's CPL increased 40% since then — consider reactivating top-of-funnel activity."
- Compare current metrics vs. the previous report period to detect performance shifts correlated with actions

**4. Action Timeline UI**

Add an "Action History" section to the Results page (`Data.tsx`):
- Chronological timeline of actions with icons per type
- Each entry shows: date, action description, which campaign, who triggered it (user vs LUMI)
- Highlight entries where LUMI detected a correlated performance change

### Files Changed

| File | Change |
|------|--------|
| **New migration** | Create `ad_action_log` table with RLS |
| `supabase/functions/rotate-creative/index.ts` | Insert into `ad_action_log` |
| `supabase/functions/apply-optimizations/index.ts` | Insert into `ad_action_log` |
| `supabase/functions/check-campaign-status/index.ts` | Insert into `ad_action_log` |
| `supabase/functions/run-optimization-report/index.ts` | Query recent actions, add cross-campaign correlation logic |
| `src/pages/Data.tsx` | Add Action History timeline section |
| `src/pages/Data.tsx` | Log user-approved optimizations to `ad_action_log` |

### Note
Your second request ("I also want to make sure that LUMI is doing checks on t...") was cut off. Please finish that thought and I'll incorporate it into this plan.

