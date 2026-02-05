

# Remove Admin from Dropdown and Add Dedicated Admin Access Button

## Overview

This plan removes all admin-related items from the user dropdown menus (both desktop and mobile) and replaces them with a dedicated, prominent admin access button that appears at the top of the main dashboard header. This button will only be visible to admin users and provides a clear, separate entry point to the admin dashboard.

---

## Current State

**Desktop Dropdown (`DashboardLayout.tsx`):**
- Lines 344-363 contain admin section with separator, label, and 4 menu items (Knowledge Base, Campaign Templates, Invite Codes, Analytics)

**Mobile Dropdown (`MobileHeader.tsx`):**
- Lines 45-73 contain admin section with 6 menu items (User Management, Subscriptions, Knowledge Base, Campaign Templates, Invite Codes, Analytics)

---

## Part 1: Remove Admin Items from Dropdowns

### Desktop - DashboardLayout.tsx

Remove the entire admin block (lines 344-363):
```typescript
// REMOVE THIS ENTIRE BLOCK:
{isAdmin && <>
  <DropdownMenuSeparator />
  <DropdownMenuLabel>Admin</DropdownMenuLabel>
  <DropdownMenuItem onClick={() => navigate("/admin/knowledge")}>
    <Shield className="mr-2 h-4 w-4" />
    Knowledge Base
  </DropdownMenuItem>
  ...
</>}
```

### Mobile - MobileHeader.tsx

Remove the entire admin block (lines 45-73):
```typescript
// REMOVE THIS ENTIRE BLOCK:
{isAdmin && (
  <>
    <DropdownMenuLabel className="text-xs text-muted-foreground">Admin</DropdownMenuLabel>
    <DropdownMenuItem onClick={() => navigate("/admin/users")} className="min-h-[44px]">
      ...
    </DropdownMenuItem>
    ...
    <DropdownMenuSeparator />
  </>
)}
```

---

## Part 2: Add Admin Access Button to Header

### Desktop - DashboardLayout.tsx

Add an admin button in the header, positioned before the Library button (around line 304). This creates a clear visual distinction:

```typescript
{/* Admin Dashboard Button - Only visible to admins */}
{isAdmin && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => navigate("/admin/users")}
    className="gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
  >
    <Shield className="h-4 w-4" />
    <span className="hidden sm:inline">Admin</span>
  </Button>
)}
```

Visual placement in header:
```
[Lumi Logo] [Brand Selector]           [Admin] [Library] [New Ad] [Avatar]
```

### Mobile - MobileHeader.tsx

Add the admin button in the mobile header, positioned to the left of the avatar:

```typescript
{/* Admin Button - Only visible to admins */}
{isAdmin && (
  <Button
    variant="outline"
    size="icon"
    onClick={() => navigate("/admin/users")}
    className="h-10 w-10 rounded-full border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
  >
    <Shield className="h-5 w-5" />
  </Button>
)}
```

Visual placement on mobile:
```
[Lumi Logo]                             [Admin 🛡️] [Avatar]
```

---

## Part 3: Design Specifications

### Admin Button Styling

The admin button will have a distinctive amber/gold color scheme to differentiate it from regular actions:

- **Border**: `border-amber-500/50` - subtle amber border
- **Text**: `text-amber-600` (light mode) / `text-amber-400` (dark mode)
- **Hover**: `hover:bg-amber-500/10` - subtle amber background on hover
- **Icon**: Shield icon to indicate admin/protected area

This color choice:
1. Distinguishes from the pink/purple brand palette
2. Conveys "caution/special access" semantically
3. Remains visible but not distracting

---

## Part 4: Files to Modify

| File | Changes |
|------|---------|
| `src/components/DashboardLayout.tsx` | Remove admin dropdown items; Add admin button in header section |
| `src/components/MobileHeader.tsx` | Remove admin dropdown items; Add admin button next to avatar |

---

## Visual Mockups

### Desktop Header (Admin View)
```
┌──────────────────────────────────────────────────────────────────────┐
│ [Lumi Logo]  [Brand ▼]                  [Admin] [Library] [+ New Ad] [👤] │
└──────────────────────────────────────────────────────────────────────┘
                                            ↑
                                      Amber button
                                      Only for admins
```

### Desktop Header (Regular User View)
```
┌──────────────────────────────────────────────────────────────────────┐
│ [Lumi Logo]  [Brand ▼]                          [Library] [+ New Ad] [👤] │
└──────────────────────────────────────────────────────────────────────┘
                                                   No admin button
```

### Mobile Header (Admin View)
```
┌────────────────────────────────────┐
│ [Lumi Logo]              [🛡️] [👤] │
└────────────────────────────────────┘
                            ↑
                      Amber shield icon
```

---

## Implementation Summary

1. **Remove** all admin menu items from the desktop dropdown menu (DashboardLayout.tsx)
2. **Remove** all admin menu items from the mobile dropdown menu (MobileHeader.tsx)
3. **Add** a dedicated admin button with Shield icon in the desktop header (before Library button)
4. **Add** a dedicated admin button with Shield icon in the mobile header (before avatar)
5. Button navigates to `/admin/users` as the default admin landing page
6. Button uses amber color scheme for visual distinction
7. Button only renders when `isAdmin` is true

