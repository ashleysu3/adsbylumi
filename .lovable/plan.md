
# Add Meta Connection as a Dedicated Page in User Dropdown

## Overview

This plan moves Meta Connection from being hidden inside Settings → Connections tab to being a standalone, easily accessible page directly under "My Brand" in the user dropdown menu.

---

## Current Navigation Structure

```
User Dropdown:
├── My Brand (/dashboard)
├── Concept Library (/content-library)
├── Settings (/settings)
│   └── [Connections tab] → Manage → /settings/meta
└── Ads Glossary (/glossary)
```

## Proposed Navigation Structure

```
User Dropdown:
├── My Brand (/dashboard)
├── Meta Connection (/meta-settings)  ← NEW direct link
├── Concept Library (/content-library)
├── Settings (/settings)
└── Ads Glossary (/glossary)
```

---

## Part 1: Update User Dropdown Menus

### Desktop Dropdown (DashboardLayout.tsx)

Add "Meta Connection" menu item directly below "My Brand":

```typescript
<DropdownMenuItem onClick={() => navigate("/dashboard")}>
  <Building2 className="mr-2 h-4 w-4" />
  My Brand
</DropdownMenuItem>
<DropdownMenuItem onClick={() => navigate("/meta-settings")}>
  <Link2 className="mr-2 h-4 w-4" />
  Meta Connection
</DropdownMenuItem>
```

### Mobile Dropdown (MobileHeader.tsx)

Same addition for mobile users:

```typescript
<DropdownMenuItem onClick={() => navigate("/dashboard")} className="min-h-[44px]">
  <Building2 className="mr-3 h-4 w-4" />
  My Brand
</DropdownMenuItem>
<DropdownMenuItem onClick={() => navigate("/meta-settings")} className="min-h-[44px]">
  <Link2 className="mr-3 h-4 w-4" />
  Meta Connection
</DropdownMenuItem>
```

---

## Part 2: Update Route and Back Navigation

### Update App.tsx Route

Change the route from `/settings/meta` to `/meta-settings` for easier discovery:

```typescript
// OLD
<Route path="/settings/meta" element={<MetaSettings />} />

// NEW - Keep both for backward compatibility
<Route path="/meta-settings" element={<MetaSettings />} />
<Route path="/settings/meta" element={<Navigate to="/meta-settings" replace />} />
```

### Update MetaSettings.tsx Back Navigation

Change the back button to navigate to `/dashboard` (My Brand) instead of `/settings`:

```typescript
<Button 
  variant="ghost" 
  size="icon" 
  onClick={() => navigate('/dashboard')}  // Changed from '/settings'
>
  <ArrowLeft className="h-5 w-5" />
</Button>
```

---

## Part 3: Update Settings Page Reference

### Update Settings.tsx Connections Tab

Update the button in the Connections tab to use the new route:

```typescript
<Button onClick={() => navigate('/meta-settings')} variant="outline" className="gap-2">
  {metaConnected ? 'Manage' : 'Connect'}
  <ExternalLink className="h-4 w-4" />
</Button>
```

---

## Part 4: Update Lumi Navigation Helper

### Update lumi-chat Edge Function

Add the new Meta Connection page to Lumi's app structure knowledge:

```typescript
APP STRUCTURE:
...
• Meta Connection (/meta-settings) - Connect and manage your Meta (Facebook/Instagram) ad account
...
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/DashboardLayout.tsx` | Add "Meta Connection" dropdown item with Link2 icon |
| `src/components/MobileHeader.tsx` | Add "Meta Connection" dropdown item with Link2 icon |
| `src/App.tsx` | Add new route `/meta-settings`, redirect old route |
| `src/pages/MetaSettings.tsx` | Update back button to go to `/dashboard` |
| `src/pages/Settings.tsx` | Update Connections tab button to use `/meta-settings` |
| `supabase/functions/lumi-chat/index.ts` | Add Meta Connection to app structure in system prompt |

---

## Menu Ordering

The final dropdown order will be:

**Desktop:**
1. Home
2. (Admin items if admin)
3. My Brand
4. **Meta Connection** ← New
5. Concept Library
6. Settings
7. Ads Glossary
8. Show Walkthrough
9. Sign Out

**Mobile:**
1. (Admin items if admin)
2. My Brand
3. **Meta Connection** ← New
4. Concept Library
5. Settings
6. Ads Glossary
7. Show Walkthrough (if available)
8. Sign Out

---

## Visual Design

The new menu item will use the `Link2` icon (chain link) which is already associated with connections throughout the app. It will appear in the same style as other menu items, maintaining visual consistency.

---

## Implementation Summary

1. **Add dropdown menu item** in both desktop and mobile headers
2. **Create new primary route** at `/meta-settings`
3. **Add redirect** from old `/settings/meta` path
4. **Update back navigation** in MetaSettings to go to My Brand dashboard
5. **Update Lumi** so it knows about the new page location
