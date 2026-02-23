

# "Lumi Sets It Up For You" — Automatic Event Tracking via Meta Custom Conversions

## The Insight

Meta's Custom Conversions API lets you create URL-based conversion rules directly — no code, no pixel events, no snippets. The user just provides their thank-you or confirmation page URL (e.g., `example.com/thank-you`), and we call the Meta API to create a Custom Conversion rule that says: "When someone visits this URL, count it as a Lead (or Purchase)."

**Zero code for the user. Zero pixel knowledge required. Lumi handles it.**

## How It Works for the User

When Lumi detects that the required event isn't firing on their page (the current "fail" state), instead of showing code snippets and platform guides, the primary option becomes:

```text
+----------------------------------------------+
|  We couldn't detect a "Lead" event            |
|  on this page — but Lumi can fix that.        |
|                                               |
|  Just tell us: what's the page people see     |
|  AFTER they sign up?                          |
|                                               |
|  [https://example.com/thank-you         ]     |
|                                               |
|  [Set up tracking for me]                     |
|                                               |
|  "We'll tell Meta to count anyone who         |
|   lands on this page as a Lead."              |
|                                               |
|  ── or ──                                     |
|  [I want to do it myself v]  (collapses to    |
|   show existing platform guides + code)       |
+----------------------------------------------+
```

One button click. Done.

## What Happens Behind the Scenes

1. User enters their confirmation/thank-you page URL
2. Frontend calls a new edge function `create-custom-conversion`
3. The edge function calls Meta's API:
   ```
   POST /act_{ad_account_id}/customconversions
   ```
   With parameters:
   - `name`: "LUMI - Lead - example.com/thank-you"
   - `event_type`: "LEAD" or "PURCHASE"
   - `rule`: URL contains the thank-you page path
4. Meta returns a Custom Conversion ID
5. We store this ID on the `campaign_workspaces` row and mark `tracking_verified = true`
6. The campaign builder uses this Custom Conversion ID when building the campaign (as `custom_conversion_id` in the promoted_object)

## What Changes

### 1. New Edge Function: `create-custom-conversion`
- Accepts: `brandId`, `confirmationUrl`, `eventType` ("LEAD" or "PURCHASE"), `workspaceId`
- Authenticates user, verifies brand ownership
- Fetches Meta access token from vault
- Calls `POST /act_{ad_account_id}/customconversions` with a URL-contains rule
- Saves the custom conversion ID to `campaign_workspaces.custom_conversion_id`
- Sets `tracking_verified = true`
- Returns success with the custom conversion name

### 2. Database: Add column to `campaign_workspaces`
- `custom_conversion_id` (text, nullable) — stores the Meta Custom Conversion ID created by Lumi

### 3. Updated `EventSetupAssistant.tsx`
- **Primary path (new)**: "Let Lumi set it up" — input for confirmation URL + one-click button
- **Secondary path (existing)**: "I want to do it myself" — collapsible section with the platform guides and code snippets (moved to a less prominent position)
- After successful creation, shows green success state with the custom conversion name
- Loading state while creating: "Setting up your tracking..."

### 4. Updated `build-meta-campaign` Edge Function
- When building the campaign, check if `workspace.custom_conversion_id` exists
- If it does, use it in the `promoted_object` of the ad set instead of relying on pixel events:
  ```json
  { "custom_conversion_id": "123456", "pixel_id": "789" }
  ```
- This ensures the campaign optimizes for the URL-based conversion rule Lumi created

### 5. Config
- Add `create-custom-conversion` to `supabase/config.toml` with `verify_jwt = true`

## Flow for Each New Campaign

1. User picks "Leads" or "Sales" as objective
2. User adds their offer URL
3. EventSetupAssistant auto-checks for existing events
4. If events found: green checkmark, done
5. If events NOT found: "Lumi can set this up for you" prompt
6. User enters their thank-you/confirmation URL
7. One click: Lumi creates the Custom Conversion via Meta API
8. Green checkmark, `tracking_verified = true`, campaign is ready to build

## Technical Details

### Edge Function: `create-custom-conversion`

```text
Input:
  brandId: string
  workspaceId: string
  confirmationUrl: string
  eventType: "LEAD" | "PURCHASE"

Steps:
  1. Auth check (manual JWT validation)
  2. Fetch brand -> verify ownership
  3. Get meta_account_id + access token from vault
  4. Get pixel_id from ad account
  5. POST to Meta API:
     /act_{account_id}/customconversions
     name = "LUMI // {eventType} - {url_path}"
     event_type = eventType
     pixel_id = pixel_id
     rule = {"url":{"i_contains": confirmationUrl path}}
  6. Save custom_conversion_id to campaign_workspaces
  7. Set tracking_verified = true
  8. Return { success, customConversionId, name }
```

### EventSetupAssistant Changes
- New state: `'creating'` added to status union
- New state: `confirmationUrl` input field
- New handler: `createCustomConversion()` that calls the edge function
- Existing platform guides and code snippet moved into an "I want to do it myself" collapsible section
- Success state shows: "Lumi set up tracking for you — Meta will count visits to [url] as a [Lead/Purchase]"

### Build Campaign Changes
- In `build-meta-campaign/index.ts`, after fetching the pixel, also check `workspace.custom_conversion_id`
- If present, add to the `promoted_object`:
  ```
  custom_conversion_id: workspace.custom_conversion_id
  ```

