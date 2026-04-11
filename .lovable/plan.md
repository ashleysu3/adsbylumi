

# Admin-Managed Creative Toolkit with Live/Coming Soon Toggle

## Overview
Add a new "Creative Toolkit" section to the Admin Settings page that lets you:
1. Toggle the toolkit between **Live** and **Coming Soon** (the blurred overlay)
2. Manage template packs, B-roll sources, music sources, production tools, and marketplace packs — all from the admin dashboard, stored in the database

## How it works

### 1. Database: `site_settings` row for toolkit config
Use the existing `site_settings` table (same pattern as the announcement banner). Store a key called `creative_toolkit_config` with a JSON value:

```json
{
  "live": false,
  "templates": [ { "name": "...", "category": "...", "formats": [...], "description": "...", "canvaUrl": "..." } ],
  "broll_sources": [ { "name": "...", "badge": "...", "description": "...", "url": "...", "buttonLabel": "..." } ],
  "music_sources": [ ... ],
  "production_tools": [ ... ],
  "marketplace_packs": [ ... ],
  "shot_lists": [ { "title": "...", "shots": ["..."] } ]
}
```

### 2. Admin Settings page — new "Creative Toolkit" card
**File:** `src/pages/admin/Settings.tsx`

Add a second card below the Announcement Banner card with:
- **Live toggle** (Switch) — controls `live` boolean
- **Tabs** for each content section: Templates, B-Roll Sources, Music & Tools, Marketplace, Shot Lists
- Each tab shows an editable list of items with Add/Edit/Delete buttons
- Simple inline form for each item type (name, description, URL, category, formats, price, etc.)
- Save button that upserts to `site_settings` with key `creative_toolkit_config`

### 3. Creative Toolkit page reads from database
**File:** `src/pages/CreativeToolkit.tsx`

- On mount, fetch `site_settings` where `key = 'creative_toolkit_config'`
- If `live` is `false`, show the Coming Soon overlay (current behavior)
- If `live` is `true`, hide the overlay and render content from the database data

### 4. Update tab components to accept data as props
**Files:** `src/components/creative-toolkit/TemplatesTab.tsx`, `BRollTab.tsx`, `MusicToolsTab.tsx`, `MarketplaceTab.tsx`

- Add optional props for the data arrays (templates, sources, tools, etc.)
- If props are provided, use them; otherwise fall back to the hardcoded defaults (keeps backward compatibility during transition)

### 5. Admin tab navigation
**File:** `src/components/AdminTabs.tsx`

No change needed — the Creative Toolkit config lives inside the existing Settings tab, not a new tab.

## Files to modify

| File | Change |
|------|--------|
| `src/pages/admin/Settings.tsx` | Add Creative Toolkit management card with live toggle + content editors |
| `src/pages/CreativeToolkit.tsx` | Fetch config from DB; conditionally show/hide Coming Soon overlay |
| `src/components/creative-toolkit/TemplatesTab.tsx` | Accept optional `templates` prop |
| `src/components/creative-toolkit/BRollTab.tsx` | Accept optional `brollSources`, `shotLists` props |
| `src/components/creative-toolkit/MusicToolsTab.tsx` | Accept optional `musicSources`, `productionTools` props |
| `src/components/creative-toolkit/MarketplaceTab.tsx` | Accept optional `packs` prop |

No database migration needed — `site_settings` table already exists and accepts arbitrary JSON values.

