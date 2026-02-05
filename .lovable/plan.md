
# Enhanced Admin Portal with Robust Knowledge Management & Announcement Banner

## Overview

This plan adds two major capabilities to the admin portal:

1. **Expanded Knowledge Management** - More categories, better organization, search, priority ordering, and rich media support
2. **Global Announcement Banner** - Admin-controlled site-wide banner with customizable text, colors, and toggle on/off functionality

---

## Part 1: Enhanced Knowledge Management System

### Current Categories (7)
```
ad_planner, creative_department, hooks, copy_formulas, 
visual_guidelines, psychology, meta_best_practices
```

### Expanded Categories (13+)
Add support for the content types you mentioned:

| Category | Description |
|----------|-------------|
| `best_practices` | General best practices for ads, funnels, and strategy |
| `hook_ideas` | Proven hooks and attention-grabbers |
| `strategies` | Campaign strategies, funnel approaches |
| `trends` | Current trends in paid social and content |
| `examples` | Real ad examples, swipe files |
| `creative_templates` | Template structures for scripts, carousels, etc. |
| `psychology` | Psychological triggers and buyer behavior |
| `copy_formulas` | Copywriting frameworks (PAS, AIDA, etc.) |
| `visual_guidelines` | Design and visual best practices |
| `meta_best_practices` | Meta/Facebook specific guidance |
| `hooks` | Hook library with categorizations |
| `ad_planner` | Planning and strategy context |
| `creative_department` | Production and creative direction |

### New Knowledge Document Fields

Extend the `knowledge_documents` table:

```sql
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS 
  priority INTEGER DEFAULT 0,
  subcategory TEXT,
  source_url TEXT,
  content_format TEXT DEFAULT 'text', -- 'text', 'markdown', 'list'
  usage_count INTEGER DEFAULT 0;
```

### Enhanced Knowledge Page Features

1. **Search & Filter**
   - Full-text search across title, content, and tags
   - Filter by category, active status, and date range

2. **Priority Ordering**
   - Drag-and-drop or manual priority setting
   - Higher priority = used first by AI

3. **Subcategories**
   - e.g., Under "hooks": video_hooks, static_hooks, dm_hooks

4. **Preview & Format**
   - Markdown preview mode
   - List format for hook collections

5. **Usage Tracking**
   - Show which documents are most used by AI
   - Help identify valuable vs. stale content

### Updated Knowledge.tsx UI

```text
┌─────────────────────────────────────────────────────────────────┐
│ 📚 Knowledge Base                    [Search...] [Bulk Upload] │
│ "Lumi's brain for generating ads"         [+ Add Knowledge]    │
├─────────────────────────────────────────────────────────────────┤
│ Categories:                                                     │
│ [All] [Best Practices] [Hooks] [Strategies] [Trends] [Examples]│
│ [Templates] [Psychology] [Copy] [Visual] [Meta] [+ More ▼]     │
├─────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────┐          │
│ │ ⭐ PAS Copywriting Formula           v2 │ Active │          │
│ │ Copy Formulas • copywriting, conversion          │          │
│ │ ────────────────────────────────────────         │          │
│ │ Problem → Agitate → Solution...                  │          │
│ │                                                  │          │
│ │ Used 47 times • Updated Dec 4                    │          │
│ │                      [Priority: 1] [Edit] [Delete]│          │
│ └───────────────────────────────────────────────────┘          │
│                                                                 │
│ ┌───────────────────────────────────────────────────┐          │
│ │ Visual Hook Patterns                   v1 │ Active │          │
│ │ Hooks • video, engagement                        │          │
│ └───────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Global Announcement Banner System

### New Database Table: `site_settings`

Create a table to store site-wide configuration:

```sql
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage settings
CREATE POLICY "Admins can manage site settings"
  ON site_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Everyone can read settings
CREATE POLICY "Anyone can read site settings"
  ON site_settings FOR SELECT TO authenticated
  USING (true);
```

### Announcement Banner Data Structure

```typescript
interface AnnouncementBanner {
  enabled: boolean;
  text: string;
  linkText?: string;
  linkUrl?: string;
  style: 'brand' | 'info' | 'warning' | 'success' | 'custom';
  customColors?: {
    background: string;  // HSL or hex
    text: string;
    linkText?: string;
  };
  dismissible: boolean;
  expiresAt?: string;  // ISO date string
}
```

### New Component: `GlobalAnnouncementBanner.tsx`

```typescript
// Renders at the very top of the app (above header)
// Fetches from site_settings where key = 'announcement_banner'
// Supports dismissal (localStorage for non-auth, user preference for auth)
// Matches brand styling with gradient options
```

### Banner Styles (Brand-Matching)

| Style | Background | Text |
|-------|------------|------|
| `brand` | `bg-gradient-lumi` (orange→pink→purple) | White |
| `info` | `bg-lumi-blue-1/20` | `text-blue-600` |
| `warning` | `bg-amber-500/10` | `text-amber-600` |
| `success` | `bg-emerald-500/10` | `text-emerald-600` |
| `custom` | Admin-defined | Admin-defined |

### Admin Banner Management UI

Add a new admin page or section: `/admin/settings` or add to existing admin tabs

```text
┌─────────────────────────────────────────────────────────────────┐
│ 📢 Announcement Banner                           [Toggle: ON]  │
├─────────────────────────────────────────────────────────────────┤
│ Message:                                                        │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 🎉 New feature: Smart Creative Studio is live! Check it out ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Link (optional):                                                │
│ Text: [Learn more    ]  URL: [/creative-studio    ]             │
│                                                                 │
│ Style:                                                          │
│ (●) Brand Gradient  ( ) Info Blue  ( ) Warning  ( ) Success     │
│ ( ) Custom Colors                                               │
│                                                                 │
│ ☑ Allow users to dismiss                                        │
│ ☐ Set expiration date: [____________]                           │
│                                                                 │
│ Preview:                                                        │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ ◆ 🎉 New feature: Smart Creative Studio is live! Learn more ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                                              [Save Banner]      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Files to Create

| File | Purpose |
|------|---------|
| `src/components/GlobalAnnouncementBanner.tsx` | The site-wide banner component |
| `src/pages/admin/Settings.tsx` | New admin page for site-wide settings including banner |

---

## Part 4: Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/Knowledge.tsx` | Add search, expanded categories, priority ordering, subcategories, usage stats |
| `src/components/AdminTabs.tsx` | Add new "Settings" tab for banner management |
| `src/App.tsx` | Add `<GlobalAnnouncementBanner />` above `<ImpersonationBanner />` |

---

## Part 5: Database Migration

```sql
-- 1. Add new columns to knowledge_documents
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS 
  priority INTEGER DEFAULT 0;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS 
  subcategory TEXT;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS 
  source_url TEXT;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS 
  usage_count INTEGER DEFAULT 0;

-- 2. Create site_settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage site settings"
  ON site_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read site settings"
  ON site_settings FOR SELECT TO authenticated
  USING (true);

-- 3. Insert default banner setting
INSERT INTO site_settings (key, value) VALUES (
  'announcement_banner',
  '{"enabled": false, "text": "", "style": "brand", "dismissible": true}'::jsonb
) ON CONFLICT (key) DO NOTHING;
```

---

## Part 6: GlobalAnnouncementBanner Component

```typescript
// Key features:
// - Fetches from site_settings on mount
// - Caches in localStorage to reduce queries
// - Subscribes to realtime updates for instant changes
// - Tracks dismissal per user
// - Gradient animation for brand style
// - Optional link button
// - Dismissible X button (if enabled)
```

---

## Part 7: Implementation Order

1. **Database migration** - Add columns to knowledge_documents, create site_settings table
2. **Update Knowledge.tsx** - Add expanded categories, search, priority
3. **Create GlobalAnnouncementBanner.tsx** - The banner component
4. **Create admin/Settings.tsx** - Banner management UI
5. **Update AdminTabs.tsx** - Add Settings tab
6. **Update App.tsx** - Render GlobalAnnouncementBanner

---

## Part 8: Expanded Categories List

```typescript
const categories = [
  { value: "best_practices", label: "Best Practices" },
  { value: "hook_ideas", label: "Hook Ideas" },
  { value: "strategies", label: "Strategies" },
  { value: "trends", label: "Trends" },
  { value: "examples", label: "Examples & Swipes" },
  { value: "creative_templates", label: "Creative Templates" },
  { value: "psychology", label: "Psychology Triggers" },
  { value: "copy_formulas", label: "Copy Formulas" },
  { value: "visual_guidelines", label: "Visual Guidelines" },
  { value: "meta_best_practices", label: "Meta Best Practices" },
  { value: "hooks", label: "Hooks Library" },
  { value: "ad_planner", label: "Ad Planner" },
  { value: "creative_department", label: "Creative Department" },
];
```

---

## Technical Summary

### New Tables
- `site_settings` - Key-value store for site-wide configuration

### New Columns
- `knowledge_documents.priority` - Order importance for AI usage
- `knowledge_documents.subcategory` - Sub-classification
- `knowledge_documents.source_url` - Optional reference link
- `knowledge_documents.usage_count` - Track AI usage

### New Components
- `GlobalAnnouncementBanner` - Site-wide announcement display
- `admin/Settings` - Admin page for managing site settings and banner

### Updated Components
- `AdminTabs` - Add Settings tab
- `Knowledge` - Enhanced with search, more categories, priority

