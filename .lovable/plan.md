

## Simplify Campaign Goal Display

### Problem
The current goal row shows a variance badge with numbers like `-$0.24 (-90%)` which is confusing for non-expert users. Too much data, not enough meaning.

### Approach: Status dot + plain-language hover tooltip

Replace the numeric variance badge with a simple **colored status dot** next to the goal value. The dot communicates performance at a glance (green = great, amber = watch, red = needs attention). On hover, a friendly tooltip explains what's happening in plain language:

- **Green dot + hover**: "Your ads are beating your goal of $0.27 — great job! 🎉"
- **Amber dot + hover**: "Your ads are close to your goal of $0.27. Keep an eye on it."
- **Red dot + hover**: "Your ads aren't meeting your goal of $0.27. Check Lumi's recommendations for next steps."
- **No data**: No dot, just the goal badge

This removes the confusing percentages and absolute differences entirely. The goal value stays visible as a badge, and the edit button remains.

### Layout (before → after)

```text
BEFORE:  ⊕ Cost Per Click Goal:  [$0.27 (Lumi's rec)]  [-$0.24 (-90%)]  ✏ Edit
AFTER:   ⊕ Cost Per Click Goal:  🟢 [$0.27 (Lumi's rec)]  ✏ Edit
                                  ↑ hover for friendly message
```

### Changes

**`src/components/insights/CampaignGoalRow.tsx`**
- Remove the variance badge entirely
- Add a small colored dot (using existing `getLumiKPIStatus` logic) before the goal badge
- Wrap the dot in a `<Tooltip>` with a warm, plain-language message based on status
- Keep the goal badge and edit popover as-is
- Import `Tooltip` components

### Files to edit
- `src/components/insights/CampaignGoalRow.tsx`

