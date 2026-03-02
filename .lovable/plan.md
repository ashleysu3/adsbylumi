

## Plan: Clean Up Creative Studio Toolbar & Tab Bar

### Changes

#### 1. Restructure campaign selector — label above dropdown
- Stack "Campaign:" label above the `<Select>` instead of inline
- Use a vertical flex layout: label on top, dropdown below
- Removes the cramped horizontal spacing

#### 2. Remove "Build Campaign" from top toolbar
- The primary action button in the top-right currently shows "Build Campaign" on the `build` tab — remove it from the toolbar entirely for the `build` tab
- Instead, keep it only at the bottom of the Creation/build tab content (inside the production checklist area)
- Other tabs (Angles → "Generate Creative", Concepts → "Next Concept"/"Continue to Ad Copy", Copy → "Continue to Build") keep their top-right actions since they're navigation-focused
- Mobile floating action also skips "Build Campaign" — it'll be inline in the build tab

#### 3. Make the tab bar visually distinct
- Currently `bg-muted/50` blends into the page background
- Add a visible border (`border`), slightly stronger background (`bg-muted`), and a subtle shadow (`shadow-sm`) so it reads as a clear navigation element
- This makes it obvious these are interactive tabs users need to toggle between

#### 4. Add "Build Campaign" button at bottom of Creation tab
- After the production checklist content in the `build` TabsContent, add the Build Campaign button as a prominent full-width or right-aligned CTA
- Only enabled when production items exist

### Files Modified
- `src/pages/CreativeStudio.tsx` — ~20 lines changed

