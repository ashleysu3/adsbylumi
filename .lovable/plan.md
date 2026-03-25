

## Agency Ads Manager Improvements: Auto-Status, Reports, Ad Literacy Levels, and Bug Fixes

### Problems to Fix

1. **Health status is manually set** — should auto-derive from latest performance reports
2. **Reports tab shows all reports as a flat list** — should be dropdown per client, one per week max
3. **Reports should match DFY report format** with white-label support and approve actions flowing to Approve tab
4. **Review tab bug**: changing client doesn't update campaigns (ReviewForm initializes campaigns on mount but doesn't re-initialize when `campaigns` prop changes)
5. **No client ad literacy level** — need per-client setting that adjusts report language complexity
6. **Campaign notes (from agency_clients) not fed into report generation**

### Plan

**1. Auto-assign health status from performance data**

In `AdsManager.tsx` during `loadData`, after enriching campaigns, compute an aggregate health status per client based on campaign goal statuses (green/amber/red from `performance_report_latest`). Write this back to `agency_clients.health_status` automatically. Override the manually-set client edit to be read-only or advisory.

**2. Add `ad_literacy_level` column to `agency_clients`**

New migration adding:
- `ad_literacy_level text default 'beginner'` — values: `beginner`, `intermediate`, `advanced`

Add a selector in the client edit dialog. Pass this value to `generate-client-report` so the AI prompt adjusts language complexity:
- **Beginner**: "Explain everything like they've never run ads. Use analogies. Avoid all acronyms."
- **Intermediate**: "They understand basics (CTR, CPL) but spell out less common terms."
- **Advanced**: "Use standard ad terminology freely."

**3. Fix Review tab campaign switching bug**

In `ReviewForm.tsx`, the `metrics` state is initialized from `campaigns` in `useState` but never updates when `campaigns` prop changes. Add a `useEffect` that resets `metrics` and `ads` when `campaigns` changes (use `brandId` as the dependency key).

**4. Restructure Reports tab as dropdown per client**

Replace flat list with:
- Client selector dropdown at the top
- Show reports for selected client only, sorted newest first
- Limit to one report per week (show latest per week group)
- Add "Generate Report" button that calls `generate-client-report` with `mode: 'agency'`
- Add manual date range picker for on-demand report pulls
- Pass `ad_literacy_level` from the client to the report generation

**5. White-label reports**

When generating reports for the Reports tab, check `agency_branding` for the brand. If `white_label_reports` is true, pass branding data (company name, colors) to the report so "LUMI" references are replaced with the agency's name.

**6. Approve actions flow to Approve tab**

When a report contains "What We Need From You" or "Agency Action Items", parse those checklist items and create `pending_optimizations` entries with `status: 'pending'`. These appear in the existing Approve tab for review/execution.

**7. Feed campaign notes into report generation**

In `generate-client-report`, fetch `agency_clients.notes` for the brand and include in the AI prompt as "AGENCY NOTES (internal context — consider tone and priorities): {notes}". This lets notes like "client is stressed about this one" influence the report tone.

### Database Changes

Migration: Add `ad_literacy_level` to `agency_clients`:
```sql
ALTER TABLE public.agency_clients 
ADD COLUMN ad_literacy_level text NOT NULL DEFAULT 'beginner';
```

### Files Changed

| File | Change |
|------|--------|
| `src/pages/AdsManager.tsx` | Auto-compute health status; restructure Reports tab with client dropdown + date picker + generate button; pass literacy level |
| `src/components/ads-manager/ReviewForm.tsx` | Add useEffect to reset state when campaigns/brandId changes |
| `src/components/ads-manager/ReportDraftPreview.tsx` | Support white-label branding display |
| `supabase/functions/generate-client-report/index.ts` | Accept `adLiteracyLevel` param; fetch agency notes; adjust prompt language by literacy; include notes context |
| Database migration | Add `ad_literacy_level` column to `agency_clients` |

