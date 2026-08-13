# Studio spacing cleanup + "Import my running ads"

Two things: tighten the layout of The Studio, and turn importing existing Meta ads into a real, always-available flow that asks LUMI the few questions it needs to monitor them well.

## 1. Studio spacing and hierarchy

Current issues on `/studio`:
- Every block sits in the same vertical rhythm, so the LIVE empty-state card, the "Continue your ad?" banner, and the IN PROGRESS header all read as siblings instead of a section and its contents.
- The "Continue your ad?" resume banner floats far from the IN PROGRESS header it belongs to.
- The drafts card opens with a tall, mostly empty header row (Combine / New campaign / Archived) before any draft appears.
- Three competing create buttons on one screen: "Create a new ad", "New campaign", and the empty-state button.

Changes:
- Group each section header with its content in a single bordered container so LIVE and IN PROGRESS read as two panels, with a larger gap between panels than inside them.
- Move the resume banner directly under the IN PROGRESS header, flush with the section.
- Slim the drafts card header: drop the duplicate "New campaign" button (the page header CTA covers it), keep Combine and Archived as small right-aligned controls on the same row as the section header.
- Reduce the empty LIVE state's vertical padding so it doesn't take as much space as a full section.

## 2. Import existing Meta ads

Today import only appears as a dismissible banner when LUMI happens to detect unlinked active Meta campaigns, and it imports campaigns with no context about what they're supposed to achieve — so monitoring can't judge them.

Changes:
- Add a permanent **Import ads from Meta** action in the LIVE section header (and in the empty state), so it's always reachable, not just when the banner shows.
- If Meta isn't connected yet, the action routes into the existing Meta connect flow first.
- Extend the import modal into two steps:
  1. **Pick campaigns** — existing list, with already-imported ones marked.
  2. **Tell LUMI what "good" looks like** — asked once per imported campaign (with sensible defaults prefilled from the campaign's Meta objective and spend):
     - What is this campaign for? (leads / sales / calls / traffic / awareness)
     - Where does it send people? (landing page URL — prefilled from the ad's link when available)
     - What's a good result? (target cost per lead / target ROAS / target cost per purchase — one field based on the goal)
     - Funnel stage (cold / warm / retargeting) — prefilled from objective
     - Monthly or daily budget confirmation
- On save, store these as campaign goals alongside the imported workspace so the performance engine grades them the same way it grades LUMI-built campaigns (status, benchmarks, weekly report, recommended next steps).
- After import, sync performance immediately so the campaigns show real numbers rather than an empty card.

## Technical notes

- Files: `src/pages/Studio.tsx`, `src/components/CampaignsList.tsx`, `src/components/insights/MetaImportBridgeBanner.tsx`, `src/components/insights/ImportCampaignsModal.tsx`.
- Import continues to use the existing `fetch-meta-campaigns` and `sync-meta-campaigns` edge functions; no new function is needed.
- Goal answers are written to the existing `campaign_goals` table keyed to the created `campaign_workspaces` row, so evaluation/status logic works unchanged.
- Imported workspaces stay flagged as Meta-sourced so the builder doesn't try to walk the user back through creative steps they already completed outside LUMI.
