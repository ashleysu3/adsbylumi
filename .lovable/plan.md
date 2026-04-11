

# Admin Dashboard Cleanup & Navigation Overhaul

## Problem
The admin dashboard has 16 flat tabs that wrap awkwardly, the Creative Toolkit editor is buried inside Settings, Invite Codes is no longer needed, and finding things is unintuitive.

## Plan

### 1. Replace flat tab bar with grouped sidebar-style navigation
**File: `src/components/AdminTabs.tsx`**

Replace the single row of 16 wrapping tab triggers with a categorized layout using collapsible groups:

| Group | Tabs |
|-------|------|
| **Users & Access** | Users, Team, Subscriptions |
| **Billing** | Stripe, Cancellations, Disputes |
| **Content** | Knowledge, Templates, Creative Toolkit (new — promoted from Settings) |
| **Support** | Bug Reports, Reviews, Email Logs |
| **System** | Meta Debug, Analytics, Settings |

Remove **Invite Codes** entirely from the tab list.

### 2. Remove Invite Codes page
- **`src/App.tsx`**: Remove the route for `/admin/invite-codes` and its import
- **`src/pages/admin/InviteCodes.tsx`**: Delete the file

### 3. Promote Creative Toolkit to its own admin tab/page
- **`src/pages/admin/CreativeToolkit.tsx`** (new): Create a dedicated admin page that renders `<CreativeToolkitManager />` inside `DashboardLayout` + `AdminTabs`, instead of it being a card buried at the bottom of Settings
- **`src/pages/admin/Settings.tsx`**: Remove the `<CreativeToolkitManager />` import and rendering — Settings goes back to just the Announcement Banner
- **`src/App.tsx`**: Add route `/admin/creative-toolkit` pointing to the new page

### 4. Improve Creative Toolkit editability
**File: `src/components/admin/CreativeToolkitManager.tsx`**

- Make it a full-page layout instead of a card (remove wrapping `<Card>`)
- Add inline "Duplicate" button on each item for faster content creation
- Add drag-to-reorder visual hint (already has `GripVertical` imported but unused)
- Show item count badges on each tab
- Add a "Reset to Defaults" option per section

### Technical Details
- The grouped navigation will use a vertical sidebar-within-content pattern (a left column of grouped links + right content area), or alternatively accordion-grouped horizontal tabs — whichever fits the existing `DashboardLayout` better. I'll use the accordion approach to keep it consistent with the current horizontal layout but with clear group headers.
- No database changes needed.
- No new dependencies.

### Files to modify
| File | Action |
|------|--------|
| `src/components/AdminTabs.tsx` | Reorganize into grouped categories, remove Invite Codes |
| `src/App.tsx` | Remove invite-codes route, add creative-toolkit route |
| `src/pages/admin/InviteCodes.tsx` | Delete |
| `src/pages/admin/CreativeToolkit.tsx` | Create (new admin page) |
| `src/pages/admin/Settings.tsx` | Remove CreativeToolkitManager rendering |
| `src/components/admin/CreativeToolkitManager.tsx` | Full-page layout, duplicate button, usability improvements |

