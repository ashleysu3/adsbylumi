

## Smart Location Targeting Prompt for Non-Local Campaigns

### What This Does

When a user creates a campaign with a standard strategy (not already a local strategy), the system checks if their business appears to be location-dependent. If so, it shows a prompt asking if they want to limit their ad delivery to a specific area — with a relevant example based on their industry. If they say yes, the location input (address + radius) appears inline.

### Detection Logic

Check the brand's `industry`, `name`, `value_proposition`, and `target_audience` fields against location-sensitive keywords:

- **Service providers**: therapist, salon, spa, gym, fitness, yoga, chiropractor, dentist, doctor, clinic, plumber, electrician, contractor, landscaper, mechanic, realtor, photographer
- **Brick & mortar**: restaurant, cafe, bakery, bar, shop, store, boutique, studio, gallery, florist
- **Professional services**: attorney, lawyer, accountant, veterinarian, tutor

If matched, show a Lumi-branded prompt card with a contextual example.

### Changes

**`src/components/CampaignBuilderForm.tsx`** (~50 lines added):

1. Add a `detectLocationBusiness()` helper that scans `workspace.brands` fields for location-sensitive keywords
2. When `usesLocationTargeting` is false but the business appears local, show a card:
   - Lumi icon + "Does your business serve a specific area?"
   - Contextual example: e.g., "For example, a therapist in Austin might only want their ads shown within 25 miles"
   - Toggle: "Yes, limit my ad area" → reveals the same address + radius inputs already used for local strategies
3. When toggled on, pass `locationTargeting` in the answers just like local strategies do

**`src/components/MobileCampaignBuilder.tsx`** (~40 lines added):

Same detection + prompt for mobile flow, placed on the Review step (step 2) above "Best practices applied".

### No edge function or DB changes needed

The `locationTargeting` field already flows through `campaign_builder_answers` → `build-meta-campaign` edge function. The existing plumbing handles it.

### Example UX

```text
┌─────────────────────────────────────┐
│ 📍 Does your business serve a      │
│    specific area?                   │
│                                     │
│ "For example, a therapist in       │
│  Austin might only want ads shown  │
│  within 25 miles of their office." │
│                                     │
│ [Toggle: Limit my ad area]         │
│                                     │
│ (if toggled on:)                   │
│ [Enter your business address    ]  │
│ Radius: ===●========= 15 miles    │
└─────────────────────────────────────┘
```

