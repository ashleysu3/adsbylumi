

## Plan: Pixel Verification on Landing Page + Install Instructions

### What We're Adding

When the QA check runs, after verifying the landing page URL is reachable, we also check whether the Meta Pixel is installed on that page. If it's not detected, we show the user their pixel code and instructions to install it.

### Changes

#### 1. Landing page check now includes pixel detection — `supabase/functions/qa-preflight-check/index.ts`

- Update `checkLandingPage` to also accept `brand` data (needs `meta_pixel_id`, `meta_access_token` or the pixel ID).
- After confirming the page is reachable, fetch the page HTML (GET instead of HEAD) and scan for the pixel base code (`fbq('init', 'PIXEL_ID')` and `connect.facebook.net/en_US/fbevents.js`).
- If pixel is found and matches the brand's `meta_pixel_id`: status stays `passed`, message notes "Pixel active".
- If pixel is found but doesn't match: `warning` — "Pixel found but doesn't match your ad account".
- If no pixel found: `warning` — "Meta Pixel not detected on your landing page". Include `pixelId` and `pixelNotInstalled: true` in the result so the client can render install instructions.

#### 2. Show pixel install code in QA UI — `src/components/QACheckScreen.tsx`

- Update `renderLandingPageExpanded` to check for `pixelNotInstalled` flag on the check result.
- When pixel is missing, render a section below the URL with:
  - A warning message: "Your Meta Pixel isn't installed on this page yet"
  - The pixel base code snippet (using the brand's `meta_pixel_id`) in a copyable code block
  - Brief instructions: "Paste this in the `<head>` of your landing page" with a copy button
  - A collapsible "Platform-specific guides" section reusing simplified platform hints (Shopify, WordPress, Kajabi, manual)
- Add the `pixelNotInstalled` and `pixelId` fields to the `CheckResult` interface.

#### 3. Pass brand data to landing page check — `supabase/functions/qa-preflight-check/index.ts`

- Update the `checkLandingPage` call to pass `brand` so it has access to `meta_pixel_id`.

### Files Modified
- `supabase/functions/qa-preflight-check/index.ts` — landing page pixel scan, pass brand
- `src/components/QACheckScreen.tsx` — pixel install UI in landing page expanded section

