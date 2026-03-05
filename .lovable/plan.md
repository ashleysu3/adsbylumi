

## Plan: Fix QA Check — Spelling, Landing Page, and Event Tracking

### Issues Found

1. **Spelling check finds no copy**: The edge function looks for `creativeJson.angleCopy` (camelCase), but the actual workspace data stores it as `creative_json.angle_copy` (snake_case). This means zero copy items are collected, resulting in the "No copy to check" warning.

2. **Landing page display**: Currently shows the URL inline as a truncated message. Needs to be on its own line below the title with an "Open" button to view in a new tab.

3. **Event Tracking check**: Listed in `INITIAL_CHECKS` on the client but **no corresponding check exists** in the edge function. It never resolves. Need to add a real check that confirms the conversion event (Lead, Purchase, etc.) and provides a simple way to add it if missing.

---

### Changes

#### 1. Fix spelling check — `supabase/functions/qa-preflight-check/index.ts`
- In `checkSpellingGrammar`, change `creativeJson?.angleCopy` to `creativeJson?.angleCopy || creativeJson?.angle_copy` so it reads the actual data key.
- Also check `creativeJson?.copy_selections` to pull selected copy variations.

#### 2. Add Event Tracking check — `supabase/functions/qa-preflight-check/index.ts`
- Accept `template` and `brand` data in the request body.
- New `checkEventTracking()` function that:
  - Determines the required event from the template's `optimization_event` or objective (Sales → Purchase, Leads → Lead).
  - Checks if `brand.meta_pixel_id` exists.
  - Checks if `brand.meta_pixel_events` has the required event verified.
  - Returns passed/warning/failed with the required event name.
- Include a `requiredEvent` and `pixelId` field in the result so the client can render setup help.

#### 3. Redesign landing page display — `src/components/QACheckScreen.tsx`
- For the `landing_page` check: render the URL on a new line below the title (not inline as the message), with an "Open in new tab" button.
- For the `tracking` check: when it returns a warning/failed, show the required event and a simple inline guide (copy-paste code snippet for the event, like `fbq('track', 'Lead')`).

#### 4. Pass template data to QA — `src/components/QACheckScreen.tsx`
- Add `workspace.campaign_templates` (already fetched via the join) to the edge function body so the tracking check can read the template's optimization event.

---

### Files Modified
- `supabase/functions/qa-preflight-check/index.ts` — fix angleCopy key, add tracking check
- `src/components/QACheckScreen.tsx` — landing page redesign, tracking UI, pass template data

