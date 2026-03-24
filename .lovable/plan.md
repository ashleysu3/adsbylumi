

## Self-Serve Performance Reports with Approve Buttons & Educational Tooltips

### What Exists Today
- The `generate-client-report` edge function already supports a `mode: 'self-serve'` parameter that generates reports with "LUMI Recommends" and "Approve These Changes" sections instead of agency language.
- However, the `ClientReportModal` UI **blocks non-agency users** with a lock screen (lines 388-403). Non-agency users cannot access reports at all.
- The `ReportSectionRenderer` renders markdown but has no interactive elements (approve buttons) or educational tooltips.

### Plan

**1. Unlock reports for all users**

In `ClientReportModal.tsx`:
- Remove the agency gate (lock screen for non-agency users)
- Pass `mode: 'self-serve'` to `generate-client-report` when the user is not on the agency plan
- Hide agency-only features (Slack delivery, auto-send schedule) for non-agency users — this already works
- Show campaign selection and generate button for all authenticated users

**2. Add "Approve" buttons to report action items**

In `ReportSectionRenderer.tsx`:
- Detect the "Approve These Changes" section by title match
- Parse checklist items (`- [ ] Approve ...`) in that section
- Render each as a card with an "Approve" button instead of a plain checkbox
- On click, insert a `pending_optimizations` row with `status: 'approved'` and call `apply-optimizations` edge function
- Show a confirmation toast and update the button to "Approved ✅"
- Pass `brandId` as a prop to `ReportSectionRenderer` so it can make DB calls

**3. Add glossary tooltips to ad terminology**

In `ReportSectionRenderer.tsx`:
- After inline formatting is parsed, scan text for known glossary terms (CPL, CTR, ROAS, CPC, CPP, CPM, Frequency, Reach, Impressions)
- Wrap first occurrence of each term with `GlossaryTermInline` from existing `GlossaryTooltip.tsx`
- This gives hover tooltips with plain-English definitions from the existing `ads-glossary.ts`

**4. Add a "💡 Try This" section rendering**

The AI prompt already generates creative ideas. Ensure the renderer gives this section a distinctive card style (like the action section styling) so it stands out visually.

### Files Changed

| File | Change |
|------|--------|
| `src/components/insights/ClientReportModal.tsx` | Remove agency gate; pass `mode` param; show generate button for all users |
| `src/components/insights/ReportSectionRenderer.tsx` | Add approve buttons in "Approve These Changes" section; add glossary tooltips to ad terms; style "Try This" section |

### Technical Notes
- The `pending_optimizations` table already exists with the right schema for storing approved actions
- The `ads-glossary.ts` already has all common terms defined
- `GlossaryTermInline` already renders dotted-underline hover tooltips
- No database changes needed

