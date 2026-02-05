

# Fix Campaign Data Accuracy: Live Ads & Date Range Filtering

## Problem Summary

The user reports that campaigns aren't showing accurate data. There are **two distinct issues**:

1. **Live Ads Only**: The system should only display data for campaigns/ads that are currently **ACTIVE** in Meta, not paused or archived campaigns
2. **Date Range Accuracy**: Results must strictly correspond to the selected time period

---

## Root Cause Analysis

### Issue 1: Not Filtering by Live Status at Meta API Level

**Current Behavior:**
- The `fetch-meta-performance` function fetches insights for any campaign that has a `meta_campaign_ids.campaignId`, regardless of whether that campaign is currently ACTIVE, PAUSED, or ARCHIVED in Meta
- The account-level `fetch-account-overview` uses `level=account` which aggregates ALL campaigns including paused ones

**Problem:**
- Paused/archived campaigns may still have metrics from before they were paused, which get displayed
- No real-time status check is performed against Meta's current campaign status

### Issue 2: Date Range is Correct but Status May Be Stale

The date range filtering is actually working correctly in the edge functions. However:
- Campaign status (`meta_campaign_status`) is only updated during `sync-meta-campaigns`
- If a user pauses a campaign in Meta Ads Manager directly, our database still shows it as "active"

---

## Technical Solution

### Part 1: Fetch Real-Time Campaign Status from Meta

**File: `supabase/functions/fetch-meta-performance/index.ts`**

Before fetching insights, query the campaign's current status from Meta API:

```typescript
// NEW: Fetch campaign status first to verify it's active
const statusUrl = `https://graph.facebook.com/v18.0/${campaignId}?fields=status,effective_status&access_token=${metaAccessToken}`;
const statusResponse = await fetch(statusUrl);
const statusData = await statusResponse.json();

if (statusData.error) {
  throw new Error(`Meta API error: ${statusData.error.message}`);
}

// Only proceed if campaign is active
const effectiveStatus = statusData.effective_status || statusData.status;
if (effectiveStatus !== 'ACTIVE') {
  return new Response(
    JSON.stringify({
      success: true,
      metrics: null,
      status: effectiveStatus,
      message: `Campaign is ${effectiveStatus}, not ACTIVE`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}
```

### Part 2: Update Account Overview to Filter Active Only

**File: `supabase/functions/fetch-account-overview/index.ts`**

Add filtering parameter to only include active campaigns:

```typescript
// Change from level=account (aggregates all) to filtering by status
const insightsUrl = `https://graph.facebook.com/v18.0/${brand.meta_account_id}/insights?${timeRange}&fields=spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type,purchase_roas&level=account&filtering=[{"field":"campaign.delivery_info","operator":"IN","value":["active"]}]&access_token=${metaAccessToken}`;
```

### Part 3: Handle Inactive Campaigns in Frontend

**File: `src/pages/Data.tsx`**

Update `fetchAllMetrics` to handle campaigns that are no longer active:

```typescript
const { data, error } = await supabase.functions.invoke('fetch-meta-performance', {
  body: { ... },
});

// NEW: Check if campaign is not active
if (data?.status && data.status !== 'ACTIVE') {
  // Update local status to match Meta
  return {
    ...campaign,
    metrics: null,
    status: data.status.toLowerCase(), // e.g., 'paused', 'archived'
  };
}
```

### Part 4: Real-Time Status Sync 

**File: `supabase/functions/fetch-meta-performance/index.ts`**

After fetching status, update the workspace if status changed:

```typescript
// Update workspace status if it changed
const newStatus = effectiveStatus.toLowerCase();
if (workspace.meta_campaign_status !== newStatus) {
  await supabase
    .from('campaign_workspaces')
    .update({ meta_campaign_status: newStatus })
    .eq('id', workspaceId);
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/fetch-meta-performance/index.ts` | Add real-time status check before fetching insights; return null metrics for non-ACTIVE campaigns; sync status back to DB |
| `supabase/functions/fetch-account-overview/index.ts` | Add filtering parameter to only aggregate ACTIVE campaigns |
| `src/pages/Data.tsx` | Handle non-active campaign responses; update local campaign status |

---

## Expected Behavior After Fix

1. **Only ACTIVE campaigns show metrics** - Paused/archived campaigns will show "Paused" or "Archived" status with no metrics displayed
2. **Account overview only counts active ads** - Spend, impressions, etc. will only include currently-running campaigns
3. **Real-time status sync** - If user pauses a campaign in Meta Ads Manager, it will reflect immediately when they refresh the Results dashboard
4. **Date range is accurate** - Already working, but now metrics will only come from campaigns that were actually active during that period

---

## Edge Cases Handled

- **Campaign paused mid-period**: If a campaign was active for 3 days of a 7-day period, Meta will return metrics only for those 3 active days
- **All campaigns paused**: Dashboard will show "No active campaigns" message
- **Newly paused campaigns**: Status will update on first data fetch, preventing stale "active" status from persisting

