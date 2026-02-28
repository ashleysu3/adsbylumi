## Advanced Upload Build — Plan

### What It Does

A new "Advanced Build" flow that lets you upload finished creative assets (videos/images) in bulk, have Lumi auto-generate up to 5 copy variations per asset (primary text, headline, description), and push each asset into its own ad set on Meta. You can enter this flow from two places:

1. **After Step 3 of the Create wizard** (strategy already selected) — as an alternative to "Create My Ad" which goes to Creative Studio
2. **From an existing campaign workspace** on the Campaigns page — strategy already determined

If you provide your own copy, Lumi uses it. If you don't, Lumi writes copy based on the offer data and infers angles from the uploaded creative filenames/types and information from the offer URL, audience psychology and information.

### Technical Approach

#### 1. New page: `src/pages/AdvancedBuild.tsx`

- Route: `/advanced-build?workspace={id}`
- Multi-step flow:
  - **Step 1 — Upload**: Drag-drop bulk uploader for videos/images (reuse patterns from `BulkUploader.tsx`). Each asset gets a thumbnail preview.
  - **Step 2 — Copy**: For each asset, show a card. User can either: (a) paste their own headline/primary/description, or (b) click "Let Lumi Write It" to auto-generate 5 variations per field. User picks which variation to use per asset.
  - **Step 3 — Review & Publish**: Summary of all ad sets (1 asset = 1 ad set, up to 5 copy combos). Confirm and push to Meta.

#### 2. New edge function: `supabase/functions/generate-advanced-copy/index.ts`

- Accepts: offer data, brand voice, uploaded asset metadata (filename, type, any user notes)
- Returns: 5 variations each of primary_text, headline, description per asset
- Uses Lovable AI (gemini-3-flash-preview) with brand context and offer psychology

#### 3. Entry point A: Create wizard (Step 3)

- Add an "Advanced Build" button alongside the existing "Create My Ad" button on Step 3 of `/create`
- On click: creates workspace + strategy (same as current flow), then navigates to `/advanced-build?workspace={id}`

#### 4. Entry point B: Existing campaigns

- Add "Advanced Upload" option in the campaign card dropdown menu in `CampaignsList.tsx`
- Navigates to `/advanced-build?workspace={id}` for that existing workspace

#### 5. Upload to Meta

- Extend `build-meta-campaign` or create a new `build-advanced-campaign` edge function that:
  - Uploads each creative asset to Meta via the existing `upload-creative-to-meta` function
  - Creates one ad set per asset
  - Inserts up to 5 ad variations per ad set (different copy combos)

#### 6. Storage

- Upload creative files to the existing `creative-assets` storage bucket
- Save advanced build state to `campaign_workspaces.campaign_builder_answers` as `{ advancedBuild: true, assets: [...], copyVariations: {...} }`

#### 7. Route registration

- Add `/advanced-build` route in `App.tsx`

### Files to Create

- `src/pages/AdvancedBuild.tsx` — main page
- `supabase/functions/generate-advanced-copy/index.ts` — AI copy generation

### Files to Edit

- `src/App.tsx` — add route
- `src/pages/Create.tsx` — add "Advanced Build" button on Step 3
- `src/components/CampaignsList.tsx` — add "Advanced Upload" dropdown option
- `supabase/config.toml` — register new edge function