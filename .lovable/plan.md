
# Agency Mode + Production Checklist Export

## Overview

This plan implements two major features:

1. **Agency Mode Toggle** - Admin-enabled multi-brand management for agencies
2. **Google Sheets Export** - Share production checklists with clients for approvals

---

## Feature 1: Agency Mode

### Current State

- Users currently have a 1:1 relationship with brands (Dashboard fetches first brand only)
- Subscription tiers exist (`starter`, `growth`, `agency_pro`) with `agency` having unlimited brands
- `LumiContext` already has `brandId`/`setBrandId` infrastructure
- No admin toggle exists to enable agency mode for specific users
- No brand switcher dropdown exists

### Solution Architecture

```text
+-------------------+     Admin toggles     +-------------------+
|   Admin Users     | ------------------->  |   profiles table  |
|   Dashboard       |                       |   is_agency_user  |
+-------------------+                       +-------------------+
                                                     |
                                                     v
+-------------------+     Brand Selector    +-------------------+
|   Agency User     | <-------------------  |   DashboardLayout |
|   (any page)      |                       |   header dropdown |
+-------------------+                       +-------------------+
```

### Database Changes

Add new column to `profiles` table:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `is_agency_user` | boolean | false | Enables multi-brand mode |

### Files to Create/Modify

| File | Changes |
|------|---------|
| `src/pages/admin/Users.tsx` | Add "Agency Mode" toggle in user details panel |
| `supabase/functions/admin-user-management/index.ts` | Add `toggle_agency_mode` action |
| `src/components/DashboardLayout.tsx` | Add brand selector dropdown for agency users |
| `src/components/BrandSelector.tsx` (new) | Dropdown component for switching brands |
| `src/contexts/BrandContext.tsx` (new) | Manage active brand state across app |
| `src/pages/Dashboard.tsx` | Fetch all brands for agency users, support switching |
| `src/pages/Onboarding.tsx` | Allow agency users to add additional brands |

### UI/UX Flow

**Admin Dashboard (User Management)**
- New toggle switch in user details: "Enable Agency Mode"
- Badge shows "Agency" next to user name when enabled

**Agency User Experience**
- Brand selector dropdown in top header (next to user avatar)
- Shows current brand name + chevron
- Dropdown lists all brands with "Add New Brand" button
- Switching brands reloads dashboard context
- All campaign workspaces, offers, insights filtered by selected brand

**Brand Isolation Rules**
- Each brand maintains separate:
  - Offers
  - Audience psychology
  - Campaign workspaces
  - Meta ad account connection
  - Creative assets
- AI context is scoped to active brand only

---

## Feature 2: Google Sheets Export for Production Checklist

### Current State

- Production checklist exists in `CreativeChecklistCard.tsx` and `ProductionManager.tsx`
- Contains: hooks, scripts, text overlays, creative direction, psychology notes
- Only "Copy Script" button exists for individual items
- No bulk export or shareable format

### Solution Architecture

```text
+-------------------+     Generate CSV     +-------------------+
|   Build Tab       | ------------------->  |   Download as     |
|   Export Button   |                       |   .csv file       |
+-------------------+                       +-------------------+
         |
         |         Alternative
         v
+-------------------+     Create Sheet     +-------------------+
|   Google Sheets   | ------------------->  |   Returns public  |
|   API (optional)  |                       |   share link      |
+-------------------+                       +-------------------+
```

### Implementation Approach

**Option A: CSV Export (Recommended - No API Key Required)**
- Generate CSV/Excel-compatible file from production items
- Download directly to user's device
- User can upload to Google Sheets, share with client

**Option B: Google Sheets API (Future Enhancement)**
- Requires user to connect Google account
- Creates sheet directly in their Drive
- More seamless but adds OAuth complexity

### Export Data Structure

```text
| Format | Hook | Script | Text Overlays | Visual Direction | Why It Works |
|--------|------|--------|---------------|------------------|--------------|
| Talking Head | "—and that's when..." | Line 1\nLine 2... | "Hook: 0-3s"... | At desk, coffee | Pattern interrupt... |
| B-Roll | "Show the before..." | N/A | "Transition: 3-5s" | Wide shot, close-up | Contrast builds... |
```

### Files to Create/Modify

| File | Changes |
|------|---------|
| `src/components/creative/ProductionManager.tsx` | Add "Export Checklist" button |
| `src/lib/export-production-checklist.ts` (new) | CSV generation logic |
| `src/components/creative/ExportChecklistModal.tsx` (new) | Preview + download dialog |

### Export Features

**Client-Friendly Format**
- Removes technical jargon
- Includes recording instructions for talking heads
- Separate sections for:
  - Talking Head Scripts (with line-by-line breakdown)
  - B-Roll Shot List
  - Graphic Briefs
  - Ad Copy for Review

**Export Options Modal**
- Checkboxes to include/exclude:
  - Scripts
  - Psychology notes
  - Creative direction
  - Ad copy
- "Download CSV" button
- "Copy Link" for shareable preview (future)

---

## Technical Implementation Details

### Database Migration

```sql
-- Add agency mode to profiles
ALTER TABLE public.profiles 
ADD COLUMN is_agency_user boolean DEFAULT false;

-- Index for efficient filtering
CREATE INDEX idx_profiles_agency ON public.profiles(is_agency_user) WHERE is_agency_user = true;
```

### Brand Context Provider

```typescript
interface BrandContextType {
  brands: Brand[];
  activeBrand: Brand | null;
  setActiveBrand: (brand: Brand) => void;
  isAgencyUser: boolean;
  loading: boolean;
}
```

### CSV Export Function

```typescript
function exportProductionChecklist(items: ProductionItem[], options: ExportOptions): string {
  // Headers
  const headers = ['Format', 'Hook', 'Script', 'Text Overlays', 'Visual Direction'];
  if (options.includePsychology) headers.push('Why It Works');
  
  // Rows
  const rows = items.map(item => [
    formatLabels[item.format],
    item.hook,
    item.script_lines?.join('\n') || '',
    item.text_overlays?.map(t => `${t.type}: ${t.text} (${t.timing})`).join('\n') || '',
    item.visual_hook || item.guidance,
    options.includePsychology ? item.why_this_works : ''
  ]);
  
  return [headers, ...rows].map(row => row.map(escapeCSV).join(',')).join('\n');
}
```

---

## Implementation Order

### Phase 1: Agency Mode (Higher Complexity)
1. Database migration for `is_agency_user`
2. Admin user management toggle
3. Brand context provider
4. Brand selector component
5. Update DashboardLayout with brand switcher
6. Update Dashboard to fetch multiple brands
7. Add "Add New Brand" flow for agency users

### Phase 2: Export Functionality (Lower Complexity)
1. Create export utility function
2. Create ExportChecklistModal component
3. Add export button to ProductionManager
4. Test CSV downloads

---

## Security Considerations

- Agency mode toggle is admin-only (audit logged)
- Brand data remains isolated by RLS policies
- Export contains no sensitive data (Meta tokens, etc.)
- CSV generation happens client-side (no server storage)

---

## Benefits

**For Agency Users**
- Manage multiple clients from one Lumi account
- Keep AI context separated per brand
- Simplified billing (one subscription)

**For Client Collaboration**
- Share production checklists without Lumi access
- Get script approvals before recording
- Hand off graphic briefs to creative teams
- Professional, branded export format
