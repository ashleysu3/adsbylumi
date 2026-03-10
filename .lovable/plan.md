

## Plan: Add Local & Event Targeting Strategies to the Create Wizard

### Problem
Three location-based campaign templates already exist in the database (`local-nearby`, `local-regional`, `event-location`) and the campaign builder already handles location/radius UI. However, there is no way for users to access these strategies from the `/create` page — they are invisible.

### What Changes

**1. Add system offer IDs for the three local strategies**

In `src/pages/Create.tsx`, add three new system offer constants alongside the existing social growth ones:

```
LOCAL_NEARBY_OFFER_ID = "system-local-nearby"
LOCAL_REGIONAL_OFFER_ID = "system-local-regional"  
EVENT_LOCATION_OFFER_ID = "system-event-location"
```

Add these to `SYSTEM_OFFER_IDS`.

**2. Add the options to Step 1 (offer selection)**

Between the social growth options and the "or promote an offer" divider, add a second divider ("or grow locally") followed by three new `StepOption` entries:

- **Event & Location Targeting** (MapPin icon) — "Get in front of people at conferences, trade shows, or high-traffic locations"
- **Local Business — Nearby** (MapPin icon) — "Attract nearby customers to your storefront or location"  
- **Local Business — Regional** (MapPin icon) — "Reach customers across your service area"

**3. Handle selection → skip to strategy step automatically**

When a user selects a local strategy, it should:
- Auto-match the corresponding campaign template by slug (`event-location`, `local-nearby`, `local-regional`)
- Set `selectedTemplateId` to the matched template
- Skip directly to Step 2 (strategy recommendation) since the template is already determined
- The strategy recommendation step already works — it shows the selected template with structure details

**4. Wire the flow through to workspace creation**

The existing `handleGenerateAndNavigate` flow creates a strategy + workspace and navigates to Creative Studio. For local strategies, the workspace needs to:
- Store the template's `strategy_template` JSON (which already contains `location_type`, `default_radius`, etc.)
- The `CampaignBuilderForm` already reads `location_type` from `strategy_template` and shows address/radius inputs

**5. Add educational context for the Event strategy**

For the event-location option, after selection on Step 2, show an educational Lumi card explaining the two-phase approach:
- Phase 1: "Awareness ads at the event location to get people to interact with your content"
- Phase 2: "Later, retarget those people with your offer ads (lead magnet or purchase)"
- Include a note: "Make sure you also have an offer campaign set up so you can retarget these people"

### What Does NOT Change
- `CampaignBuilderForm.tsx` — already handles location targeting UI
- Campaign templates in DB — already configured with `location_type`, radius settings
- Edge functions — no changes needed
- Creative Studio flow — works as-is since these are standard templates

### Technical Details

The key insight is that local strategies follow the same offer-less pattern as social growth, but instead of showing the Instagram post picker, they proceed directly through the standard angle generation → Creative Studio flow. The `strategy_template` JSON on each template already carries `location_type: "radius"` or `location_type: "places"`, which the builder form reads to show location inputs.

The event-location template uses `location_type: "places"` with a default 5-mile radius, while the two local-business templates use `location_type: "radius"` with 10 and 25 mile defaults respectively.

### Files to Edit
- `src/pages/Create.tsx` — add system offer IDs, Step 1 options, auto-template-matching logic, and educational card for event strategy

