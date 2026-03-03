

## Plan: Ensure 100% Accurate Meta Data on the Results Dashboard

### Problem Diagnosis

Three root causes are creating inaccurate budget and metric data:

1. **Stale local budget takes priority over Meta's real budget.** The app reads `campaign_builder_answers.budget` (whatever the user typed during campaign setup) and shows that first. Meta's actual budget only overrides it _after_ a successful sync — and even then, the logic says `campaign.dailyBudget || metaDailyBudget`, meaning the stale local value always wins if it exists.

2. **Ad set-level budgets are ignored.** Meta campaigns using ABO (Ad Set Budget Optimization) have budgets on each ad set, not the campaign. The current code only reads `daily_budget` at the campaign level, which returns `null` for ABO campaigns. This makes budgets show as missing or $0.

3. **No data integrity validation.** Metrics from Meta are trusted blindly. If the API returns partial data, stale cached data, or unexpected formats, the app passes it straight through to the UI.

### Plan

#### 1. Fix budget accuracy in the edge function (`fetch-meta-performance/index.ts`)
- When fetching campaign status, also request ad set budgets: query `/{campaignId}/adsets?fields=daily_budget,lifetime_budget,status`
- If campaign-level `daily_budget` is null, sum the active ad set budgets
- Return both `dailyBudget` and `budgetLevel` ('campaign' or 'adset') so the UI can label it correctly
- All budget values converted from cents to dollars consistently

#### 2. Always prefer Meta's budget over local data (`Data.tsx`)
- Flip the priority: `metaDailyBudget || campaign.dailyBudget` instead of the current `campaign.dailyBudget || metaDailyBudget`
- On initial campaign load (before sync), do NOT show a budget at all rather than showing a potentially stale local value — only show budget once Meta confirms it

#### 3. Fix budget handling in sync-meta-campaigns (`sync-meta-campaigns/index.ts`)
- Convert `daily_budget` from cents to dollars (currently stored raw)
- Also fetch ad set budgets for ABO campaigns during import

#### 4. Add metric integrity checks
- In `fetch-meta-performance`, validate that key numeric fields (`spend`, `impressions`, `ctr`, `cpc`) are actual numbers before returning them
- If any metric is `NaN` or negative, set it to `null` with a flag so the UI shows "Data unavailable" instead of $0.00
- Add a `dataIntegrity` field to the response: `{ verified: true, source: 'meta_api', fetchedAt: timestamp }`

#### 5. Add "Last synced" indicator on campaign cards (`InsightsHome.tsx`)
- Show when data was last pulled from Meta so users know if they're seeing real-time or cached data
- If data is older than 1 hour, show a subtle "Stale data" warning

### Technical Details

**Edge function changes** (`fetch-meta-performance/index.ts`):
- Add ad set budget aggregation query
- Add numeric validation layer before returning metrics
- Add `dataIntegrity` metadata to response

**Frontend changes** (`Data.tsx`):
- Reverse budget priority to always prefer Meta source
- Don't render budget until Meta sync completes
- Pass `lastSyncedAt` to campaign cards

**Frontend changes** (`InsightsHome.tsx`):
- Show "last synced" timestamp on each card
- Handle `null` budgets gracefully (show "—" not "$0")

**Edge function changes** (`sync-meta-campaigns/index.ts`):
- Convert budget from cents to dollars during import
- Fetch ad set budgets for imported campaigns

### Files to Change
- `supabase/functions/fetch-meta-performance/index.ts`
- `supabase/functions/sync-meta-campaigns/index.ts`
- `src/pages/Data.tsx`
- `src/components/insights/InsightsHome.tsx`

