

## Fix Campaign Click Behavior for Live Campaigns

**Problem:** Clicking a live campaign opens a heavy side drawer (CampaignDetailDrawer) with tabs, goals config, and other complexity. Users really only need two actions: update creative or see results.

**Solution:** Replace the drawer open for live campaigns with a simple action dialog offering two clear choices.

### Changes

**File: `src/components/CampaignsList.tsx`**

1. Add a new state for a "campaign action" dialog:
   - `actionDialogCampaign: Campaign | null`

2. Update `handleArrowClick`: when a campaign is live (not draft/in-progress), instead of opening the detail drawer, set `actionDialogCampaign` to show the action dialog.

3. Add a clean `Dialog` with two prominent action cards:
   - **"Update Creative"** — icon: `PenTool` or `RefreshCw`, navigates to `/creative-studio?workspace={id}`
   - **"See Results"** — icon: `BarChart2`, navigates to `/performance`

   Layout: two side-by-side cards, each clickable, with icon + label + short description. Clean, minimal, no tabs or complex UI.

   ```
   ┌──────────────────────────────────────────┐
   │  What would you like to do?              │
   │  [Campaign Name]                         │
   │                                          │
   │  ┌─────────────┐  ┌─────────────┐       │
   │  │ 🎨          │  │ 📊          │       │
   │  │ Update      │  │ See         │       │
   │  │ Creative    │  │ Results     │       │
   │  │             │  │             │       │
   │  │ Add or swap │  │ View        │       │
   │  │ ad creative │  │ performance │       │
   │  └─────────────┘  └─────────────┘       │
   └──────────────────────────────────────────┘
   ```

4. Keep the existing detail drawer available via the three-dot dropdown menu (MoreVertical) for edge cases, but the primary click path becomes the simple two-option dialog.

**No other files changed.** The CampaignDetailDrawer stays intact — it's just no longer the default click target for live campaigns.

