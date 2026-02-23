
# Auto-Verify Tracking From Live Performance Data

## The Problem
The `tracking_verified` flag is only set to `true` when a user explicitly uses the "Let Lumi set it up" flow. But campaigns set up outside of Lumi (e.g., directly in Ads Manager) already have working tracking — you can see conversion values coming in. The app still shows "Tracking not verified" because it doesn't check the actual data.

## The Fix
**If conversions are coming in, tracking is verified. Period.**

We add a simple inference layer: when metrics are loaded for each campaign, if the campaign is reporting leads or purchases (depending on objective), we treat tracking as verified — and silently update the database flag so the badge never shows again.

### What Changes

**`src/components/insights/InsightsHome.tsx`**
- After metrics are loaded for each campaign, check if conversions exist based on objective:
  - Lead campaigns: if `metrics.leads > 0`, tracking is working
  - Purchase/Sales campaigns: if `metrics.purchases > 0`, tracking is working
- If conversions are detected but `trackingVerified` is `false`:
  - Hide the "Tracking not verified" badge immediately (local state)
  - Fire a background Supabase update to set `tracking_verified = true` on that workspace so it never shows again

**`src/pages/Data.tsx`**
- After `fetchAllMetrics` completes, run a quick pass over campaigns: for any campaign where metrics show conversions but `trackingVerified` is still `false`, update the database in the background

### Logic (added after metrics load)

```text
For each campaign with metrics:
  objective is "leads" or similar  -> check metrics.leads > 0
  objective is "sales"/"purchase"  -> check metrics.purchases > 0

  If conversions > 0 AND trackingVerified === false:
    1. Update local state to trackingVerified = true
    2. Background: UPDATE campaign_workspaces 
       SET tracking_verified = true 
       WHERE id = campaign.id
```

### Why This Works
- No user action required — it's fully automatic
- Existing campaigns with working tracking get cleared immediately on next page load
- New campaigns still go through the Event Setup Assistant during build
- The database flag gets permanently updated so it's a one-time fix per campaign
- Zero false positives: if Meta is reporting conversions, the event is firing

### Files Modified
1. **`src/pages/Data.tsx`** — Add a `autoVerifyTracking` function that runs after metrics are fetched, checks for conversion data, and updates both local state and the database
2. **`src/components/insights/InsightsHome.tsx`** — Update the badge logic to also consider live metrics as proof of tracking (belt-and-suspenders with the Data.tsx fix)
