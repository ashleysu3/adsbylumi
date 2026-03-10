

## Plan: Improve Client Report Quality & Add Interactive Features

### Changes

#### 1. Simplify Status Key (ReportSectionRenderer)
- Keep only ✅ (on track) and ⚠️ (needs attention) in the legend
- Remove 👀 and ❌ from legend parsing — map 👀 → ⚠️ and ❌ → ⚠️ in the renderer
- Remove the `ReportLegendBar` rendering entirely from `ClientReportModal.tsx`

#### 2. Unknown Objective/Goal Popups (ClientReportModal)
- After report generation, scan `campaignSummaries` (returned from edge function) for campaigns with `objective === 'unknown'` or `userGoal === null`
- Show a dialog/popover prompting the user to fill in missing objectives and goals before displaying the report
- Save responses: objectives → `campaign_workspaces.final_answers`, goals → `campaign_goals` table

**Edge function change**: Return `campaignSummaries` alongside `report` in the response so the frontend knows which campaigns have missing data.

#### 3. Simplify Language in AI Prompt (Edge Function)
Update the system prompt and format rules:
- Replace "Objective" with "Campaign Goal"
- Replace "Primary KPI" with "Key Metric"
- Replace jargon like "CPL", "CTR", "CPC" with plain labels on first use: "Cost Per Lead (CPL)", "Click-Through Rate", etc.
- Add instruction: "Write as if explaining to a business owner, not a marketer. Avoid acronyms without definitions. Use plain, confident language."

#### 4. Add "Agency Action Items" Section (Edge Function Prompt)
Add to the prompt format:
```
### 📋 Agency Action Items
[List every commitment with a date. E.g. "Swap creative for Campaign X by March 14"]
```
The AI will extract any promise with a date and list them as actionable tasks.

#### 5. Add "What We Need From You" Section (Edge Function Prompt)
Add to the prompt format:
```
### 🤝 What We Need From You
[List items needing client approval — budget changes, creative approvals, access requests. Keep it short and clear.]
```
Instruct the AI: "Any budget increase/decrease recommendation MUST appear here as a client approval item."

#### 6. Additional Improvements
- **Week-over-week deltas**: Instruct AI to show "+X%" or "-X%" comparisons when previous report data exists
- **Executive summary first**: Move the strategic summary to the TOP of the report instead of bottom, so busy clients see the headline immediately
- **Color-coded metric values in renderer**: Green for metrics meeting goals, amber for close, red for far off — enhance `parseInlineFormatting` to detect goal comparisons

---

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-client-report/index.ts` | Rewrite prompt: plain language, add Agency Action Items + What We Need From You sections, return campaignSummaries, executive summary first |
| `src/components/insights/ReportSectionRenderer.tsx` | Remove 👀/❌ from legend, simplify to ✅/⚠️ only, remove legend bar |
| `src/components/insights/ClientReportModal.tsx` | Remove legend bar, add missing-data popup for unknown objectives/goals, handle new response shape |

