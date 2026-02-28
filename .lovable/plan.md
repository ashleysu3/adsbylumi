## Completed: Lumi Actionable Recommendations

### What was built

1. **Edge function `generate-recommendations`** — Analyzes campaign metrics, ad performance, bench availability, and fatigue thresholds to produce structured actionable recommendations (budget changes, pause/resume ads, swap bench creative).

2. **`LumiRecommendations` component** — Displays recommendations with individual "Approve" buttons and an "Approve All" button. Budget changes require double confirmation via an AlertDialog. Completed recommendations are visually marked.

3. **InsightsHome integration** — Overview page fetches recommendations across all campaigns and shows top 4 in compact mode with "Approve All".

4. **CampaignInsightDetail integration** — Full recommendations panel shown below the 3 summary cards, with all recommendations for that campaign.

5. **Weekly digest enhancement** — Added "LUMI'S RECOMMENDATIONS" section with actionable items and a direct link to approve them in the Results dashboard.

### Recommendation types
- **Budget increase/decrease** — Requires double approval (confirmation dialog with current vs. new budget)
- **Pause ad** — One-click approval, pauses underperforming ads via Meta API
- **Resume ad** — One-click approval, resumes strong paused ads
- **Swap creative** — One-click approval, rotates bench creative into fatigued ad slots

### Files created
- `supabase/functions/generate-recommendations/index.ts`
- `src/components/insights/LumiRecommendations.tsx`

### Files edited
- `src/components/insights/InsightsHome.tsx` — Added recommendation fetching + display
- `src/components/insights/CampaignInsightDetail.tsx` — Added full recommendation panel
- `supabase/functions/generate-weekly-report/index.ts` — Added recommendations section to email
