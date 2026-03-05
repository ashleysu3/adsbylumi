

## Plan: Merge Strategy + Campaign Structure into One Step

### Current State
The wizard has 3 steps after the entry choice:
- **Step 1**: Choose offer
- **Step 2**: Recommended strategy (with "Want to try a different strategy?" collapsible)
- **Step 3**: Campaign structure preview (shows structure details, "What happens next?", and advanced build option)

Clicking "Continue" on Step 3 triggers `handleGenerateAndNavigate()` which generates angles and navigates to Creative Studio.

### Changes

**Merge Step 3 into Step 2** — make the campaign structure an optional collapsible inside the strategy recommendation card, and reduce `totalSteps` from 3 to 2.

1. **`totalSteps`**: Change from `3` to `2`

2. **Step titles/subtitles**: Remove case 3, update case 2 to "Recommended strategy" / "Lumi picked the best approach for your offer"

3. **`handleNext`**: Change the trigger from `currentStep === 3` to `currentStep === 2` for calling `handleGenerateAndNavigate()`

4. **Step 2 UI** — restructure to:
   - Keep the Lumi recommendation card as-is (strategy name, description, objective, use case)
   - **Add a collapsible inside the recommendation card**: "See campaign structure" — shows `template.campaign_structure` text
   - Replace "Want to try a different strategy?" with **"See all strategies (advanced)"** — same collapsible behavior, just relabeled
   - Move the "What happens next?" info box from old Step 3 into Step 2 (below the recommendation card)
   - Move the "Already have finished creative?" advanced build collapsible from old Step 3 into Step 2

5. **Remove Step 3 block entirely** (lines ~1060-1196)

6. **`nextLabel`**: Update from `currentStep === 3 ? "Generate Angles"` to `currentStep === 2 ? "Generate Angles"`

7. **Saved progress references**: Update any `totalSteps` display logic (already uses the variable, so just the value change handles it)

