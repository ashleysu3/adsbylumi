

# Fix: "Website URL Required" Error on Campaign Publish

## Root Cause

When Lumi publishes a campaign to Meta, it builds each ad with a destination link resolved from this chain:

```
answers.finalUrl → workspace.offer_url → '' (empty string)
```

The `finalUrl` question is skipped by default in most campaign templates, so it falls through to `workspace.offer_url`. If that column is null or empty on the workspace record, the link becomes an empty string, and Meta rejects the ad with "Required Field Is Missing: The website URL field is required."

This can happen when:
- The offer was created/updated but the workspace's `offer_url` column wasn't synced
- A "Social Growth" or system-generated campaign has no offer URL
- The user added the offer after the workspace was created

Even though the offer itself has a URL and the user sees it populated in the UI, the workspace record may not have it.

## Fix (2 changes)

### 1. Add fallback chain in `build-meta-campaign` edge function

Before building ads, resolve the destination URL with a deeper fallback chain that checks:
1. `answers.finalUrl` (explicit user input)
2. `workspace.offer_url` (workspace-level)
3. Linked offer's URL (query `offers` table by `workspace.offer_id`)
4. Brand's `website_url`

If all are empty, throw a clear error *before* attempting Meta API calls: "No destination URL found. Please add a URL to your offer or enter a landing page URL."

### 2. Add validation guard in `CampaignBuilder.tsx` (client-side)

Before calling publish, check that a destination URL is resolvable. If not, show a toast directing the user to add one — preventing the confusing Meta API error.

## Files

| File | Change |
|------|--------|
| `supabase/functions/build-meta-campaign/index.ts` | Resolve destination URL early with offer + brand fallbacks; fail with clear message if empty |
| `src/pages/CampaignBuilder.tsx` | Pre-publish validation for destination URL |

