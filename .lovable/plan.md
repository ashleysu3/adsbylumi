# The Lab + My Creatives — Plan

Two new surfaces inside Creative, plus a persisted draft store. Nothing auto-publishes.

## 1. New `creatives` table (drafts library)

Migration creates `public.creatives`:

- `id uuid pk`
- `brand_id uuid` (FK brands, indexed)
- `user_id uuid` (owner, for RLS)
- `type text` — one of: `hook`, `primary_copy`, `headline`, `description`, `caption`, `cta`, `angle`, `concept`, `broll_idea`, `broll_clip`, `graphic`, `trend`
- `title text`
- `content jsonb` — flexible payload (text, asset urls, structured concept, etc.)
- `asset_url text` (nullable — for graphics / b-roll clips)
- `thumb_url text` (nullable)
- `source text` — `lab` | `guided_flow` | `lead_fit_feedback` | `trend_translator`
- `source_ref jsonb` — pointers back to workspace/tool params for "Edit/iterate"
- `status text` — `unused` (default) | `used`
- `used_in jsonb` — `{ campaign_id, ad_id, used_at }` when promoted
- `tags text[]`
- `created_at`, `updated_at`

GRANTs to `authenticated` + `service_role`. RLS: owner via `user_id = auth.uid()` OR admin. Updated_at trigger.

## 2. Creative Studio — add "The Lab" mode

`src/pages/CreativeStudio.tsx` gets a top-level mode toggle:
- **Guided flow** (current 4-step Angles → Concepts → Copy → Produce)
- **The Lab** (new — free-play tools grid)

The Lab is a tools dashboard. Each tile opens a standalone tool that:
- Reads brand brain via existing `BrandContext` / knowledge base loaders
- Does NOT require prior steps
- Has a "Save to My Creatives" action on every output (auto-saves on generate too)

Tools (each = a small component under `src/components/lab/`):

- `LabAngles.tsx` — generate angles for current brand/offer
- `LabConcepts.tsx` — generate ad concepts (graphic / carousel / b-roll / talking head)
- `LabCopy.tsx` — tabbed: Hooks · Primary text · Captions · CTAs · Headlines · Descriptions
- `LabBRoll.tsx` — ideas + generation (reuse existing b-roll generator)
- `LabGraphics.tsx` — graphic/image generation (reuse existing image gen + templates)
- `LabTrendTranslator.tsx` — move existing `TrendTranslator` page contents here as a tool

Add `TheLab.tsx` container with a tool picker. Keep `/trends` route working but render a "moved to The Lab" redirect card linking to `/creative?mode=lab&tool=trends`.

## 3. My Creatives library page

Repurpose `src/components/creative/MyCreativeLibrary.tsx` to read from the new `creatives` table (primary source), and keep current workspace-derived items as a secondary "From campaigns" tab for back-compat. Add filters: type, status (unused/used), source, search.

Each card gets an actions menu:
- **Edit / iterate** — reopens the matching Lab tool with `source_ref` payload prefilled
- **Add to an existing campaign** — opens existing `PromoteExistingPostDialog` / reuses `add-creative-to-campaign` flow. Ad created PAUSED, requires user confirm before going live. On success, mark creative `status='used'` + populate `used_in`.
- **Use in a new ad** — hands the creative into the guided 4-step flow (`/creative?mode=guided&seed=<creative_id>`)
- Copy / Delete

## 4. Save-on-generate everywhere

All Lab tools and guided-flow generators write to `creatives` immediately on generate (status `unused`). Add a small `saveCreative()` helper in `src/lib/creatives.ts`.

## 5. Lead-fit feedback fix

`LeadQualityCheck.tsx` (and the ad-fit-review function path): re-aimed copy/concepts are saved to `creatives` with `source='lead_fit_feedback'`. Replace any "we updated your ad" / auto-publish wording with:

> Saved in My Creatives — review and add to your campaign when ready. Nothing changes in your live ad until you do.

Remove buttons that imply auto-push to live; replace with "Open in My Creatives".

## 6. Routing / nav

- `/creative` keeps current behavior; query `?mode=lab` opens The Lab
- Add "My Creatives" nav link (already exists as Library — confirm and surface)
- Sidebar: add "The Lab" sub-item under Creative

## 7. Out of scope

- No billing changes
- No Meta API execution changes (reuses existing paused-first promote flow)
- No deletion of guided flow

## Technical notes

- Edge functions stay the same; only client writes drafts to `creatives`
- `BrandContext` already provides `activeBrand` — all tools scope by `brand_id`
- Existing components reused: `PromoteExistingPostDialog`, `ImportCampaignsModal`, `add-creative-to-campaign`, b-roll generator, image gen, `TrendTranslator`
- Library card actions wired through a single `CreativeActionsMenu` component
