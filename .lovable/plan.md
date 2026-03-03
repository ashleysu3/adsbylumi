

## Plan: Campaign Selection + Deep LUMI Recommendations in Client Reports

### What Changes

**1. Frontend — Campaign selector in ClientReportModal**

Before showing "Generate Report," add a campaign selection step:
- Pass `campaigns` array from `InsightsHome` into `ClientReportModal` as a new prop
- Show a checklist of all campaigns (name + status badge) with checkboxes, all selected by default
- User can uncheck campaigns they don't want in the report
- Send `selectedWorkspaceIds` array to the edge function
- Update `InsightsHome` to pass its `campaigns` prop through to the modal

**2. Edge function — Filter by selected campaigns + richer AI prompt**

In `generate-client-report/index.ts`:
- Accept `selectedWorkspaceIds` in the request body
- Filter fetched workspaces to only those in the selected list
- Validate every selected campaign appears in the output (post-generation check)
- Overhaul the AI prompt to demand specific, actionable recommendations per campaign:

The new prompt rules will include:
- For each campaign, LUMI must provide a **specific diagnosis** (what's happening and why) and a **concrete next step** (not "we'll look into it")
- Decision tree logic baked into the prompt:
  - **Meeting goal** → "This is performing well. We recommend scaling budget by 20% to capture more volume at this efficient cost."
  - **Slightly above goal (10-30%)** → "CPL has risen from $X to $Y. The likely cause is [creative fatigue / audience saturation / seasonal shift]. Our next step is [specific action: swap in new creative variant / broaden targeting / adjust budget]. We expect this to bring CPL back under goal within 3-5 days."
  - **Significantly above goal or 0 conversions** → "This campaign hasn't converted yet. This is normal in the first 3-7 days as Meta's algorithm optimizes delivery. We're monitoring [specific metrics like CTR and CPC] which are [healthy/concerning]. If we don't see conversions by [date], we will [specific fallback action]."
  - **Paused/off** → "We turned this off because [reason]. The replacement plan is [what's next]."
- Include a "confidence frame" in the system prompt: "Write as a strategist who has managed millions in ad spend. Be direct about what's working and what isn't. When recommending patience, explain the specific signals you're watching and the timeline. Never say 'we'll look into it' — always state what you're doing and why."
- Reference previous week's recommendations and whether they were followed/effective

**3. Post-generation validation**

After AI generates the report, check that every selected campaign name appears in the output. If any are missing, append a note or regenerate.

### Files to Modify

1. **`src/components/insights/ClientReportModal.tsx`** — Add campaign selection step with checkboxes, pass selected IDs to edge function
2. **`src/components/insights/InsightsHome.tsx`** — Pass `campaigns` prop to `ClientReportModal`
3. **`supabase/functions/generate-client-report/index.ts`** — Accept `selectedWorkspaceIds`, filter campaigns, upgrade prompt with decision-tree recommendations and confidence framing

### Technical Details

Campaign selector UI flow:
1. Modal opens → shows campaign checklist (all checked by default) + "Generate Report" button
2. User unchecks any they want excluded
3. Click generate → sends `selectedWorkspaceIds` to edge function
4. Edge function filters to only those campaigns, builds richer prompt, validates output coverage

Prompt upgrades focus on three things:
- **Specificity**: Every recommendation names the exact creative, metric, or action
- **Confidence**: Language conveys expertise and a clear plan, not uncertainty
- **Accountability**: References last week's recommendations and reports on their outcome

