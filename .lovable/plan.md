

## Plan: Clean Up Results Page Header

The screenshot shows the Results page header area is cluttered — the Simple/Detailed toggle, Import button, and Meta Connected badge are all crammed together, making it visually noisy and potentially confusing.

### Changes

**File:** `src/pages/Data.tsx` (lines 696–767)

Reorganize the header into a cleaner two-row layout:

1. **Top row**: "Results" title + subtitle on the left, Simple/Detailed toggle on the right — clean and minimal
2. **Second row (subtle)**: Meta status badge on the left, Import button on the right — smaller, secondary visual weight, only shown when relevant
3. Remove the orange-bordered "Import from Ads Manager" appearance by using a more subdued ghost/text style button
4. Make the Meta Connected badge smaller and less prominent (it's a status indicator, not a call-to-action)

This separates the primary control (detail level) from secondary status/actions, reducing visual clutter and giving each element breathing room.

### Technical Details

- All changes in `src/pages/Data.tsx` lines 696–767
- Restructure the flex container into two distinct rows with appropriate spacing
- Move the Meta badge and Import button into a secondary row with smaller text and subdued styling
- No logic changes — purely layout and visual hierarchy

