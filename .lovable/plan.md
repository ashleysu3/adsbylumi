

## Plan: Simplify Campaign Review Screen

### Problem
The review screen repeats information already shown in the configure step (offer details, budget, schedule, campaign settings) and adds complex sections (pixel preflight, creative readiness summaries, ad previews, bench toggle) that overwhelm the average user.

### Approach
Reduce the review to only **actionable decisions and confirmations** — things the user hasn't already seen or needs to explicitly confirm before publishing. Move detailed breakdowns behind a collapsible "See full details" section.

### Changes to `src/components/CampaignReview.tsx`

1. **Keep at top level** (always visible):
   - Meta Connection warning (critical blocker)
   - Already Published warning (critical blocker)
   - Missing requirements alert (critical blocker)
   - **Simplified summary card**: Just a compact 1-line-per-item list:
     - Offer name
     - Budget: $X/day
     - Schedule: Start date → End/Continuous
     - Creatives: X ready
   - **Destination toggle** (Save to Bench vs Publish)
   - **Launch Status toggle** (Active vs Paused)
   - **Action buttons** (Back / Publish)

2. **Move behind a collapsible "See full details"**:
   - Offer details grid (name, price, landing page)
   - Campaign Settings grid (name, Advantage+, placements, optimization)
   - Pixel Preflight Check
   - Creative concepts list with readiness badges
   - Incomplete concepts list
   - Ad Previews section
   - PreBuildCopySummary

3. **Remove entirely**:
   - The readiness summary grid (Ready/With Assets/Total) — redundant with the simplified count above

This keeps the review screen to roughly one viewport height for the common case, with full details available on demand.

