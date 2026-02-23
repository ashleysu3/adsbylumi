

# Post-Connection Ad Data Analysis Prompt

## Overview

After a user connects their Meta account during onboarding (Step 5), the system will automatically check for existing ad data from the last 90 days. If data is found, a dialog pops up asking if the user wants Lumi to analyze their past performance, suggest improvements, and auto-populate offers from any landing page URLs found in their ads.

## How It Works

```text
User connects Meta account (Step 5)
        |
        v
  Campaign sync completes
        |
        v
  Call analyze-past-creatives
  for the connected account
        |
   Has data? 
   Yes /    \ No
     /        \
    v          v
  Show popup   Continue to
  "Lumi found  finish normally
   X ads from
   the last 90
   days..."
     |
     v
  User clicks "Yes, analyze"
     |
     v
  Show analysis results:
  - Top performing formats
  - Key patterns
  - Recommendations
  - Detected offer URLs
     |
     v
  "Import these as offers?" button
  -> Creates offers from ad URLs
     |
     v
  Finish onboarding
```

## Technical Changes

### 1. New Component: `src/components/PostConnectionAnalysisModal.tsx`

A dialog modal that:
- Accepts `brandId` and `open`/`onClose` props
- On mount (when open), calls the existing `analyze-past-creatives` edge function
- Shows a loading state: "Lumi is scanning your last 90 days of ad data..."
- If `hasData: true`:
  - Displays summary, top formats, key patterns, and recommendations
  - Fetches ad-level data to extract unique destination URLs from the ads
  - Shows a list of detected landing page URLs with checkboxes
  - "Import as Offers" button creates offer records for selected URLs using `extract-offer-info`
- If `hasData: false`:
  - Shows a friendly message: "No recent ad data found -- that's okay! Lumi will use best practices to get you started."
  - Auto-closes or user dismisses

### 2. Update Edge Function: `supabase/functions/analyze-past-creatives/index.ts`

- Add a new field to the Meta API request: `ad_name, effective_object_story_spec` or simpler -- fetch `website_url` from adcreatives
- After the existing analysis, also return a `detectedUrls` array of unique destination/landing page URLs found across the ads
- This gives the modal the URLs needed to suggest offer imports

### 3. Update: `src/pages/Onboarding.tsx`

- After `MetaAccountConnect`'s `onUpdate` fires (Meta connected successfully):
  - Instead of immediately calling `handleFinishOnboarding`, set a flag `showPostConnectionAnalysis = true`
  - Render the `PostConnectionAnalysisModal` when flag is true
  - When the modal closes, proceed to `handleFinishOnboarding`

### 4. Update: `src/components/MetaAccountConnect.tsx`

- After `handleSaveConnection` completes successfully, emit a callback with the sync results so the parent knows campaigns were found
- Add an optional `onConnectionComplete` prop that passes `{ syncedCount, metaAccountId }` -- the Onboarding page uses this to decide whether to show the analysis modal

## Files to Create
- `src/components/PostConnectionAnalysisModal.tsx`

## Files to Modify
- `src/pages/Onboarding.tsx` -- add analysis modal trigger after Meta connection
- `supabase/functions/analyze-past-creatives/index.ts` -- add destination URL extraction to response
- `src/components/MetaAccountConnect.tsx` -- add optional `onConnectionComplete` callback with sync metadata

