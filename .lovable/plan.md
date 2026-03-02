

## Plan: Remove the Giant LumiChat Drawer

The `LumiChat` component is an 85vh bottom drawer that auto-opens in several places, blocking the user's view of the page they just navigated to. It doesn't add enough value to justify taking over the screen. The app already has a smaller, more contextual `LumiAssistant` component (the floating chat widget in the sidebar/corner) that handles the same chat functionality without being intrusive.

### Changes

#### 1. Remove LumiChat from Creative page
**File:** `src/pages/Creative.tsx`

- Remove the `LumiChat` import
- Remove the `showLumiChat` state and its `useEffect` trigger (lines 57, 140-144)
- Remove both `LumiChat` render blocks (lines 1276-1308 for add-creative mode, lines 1311-1346 for angle-feedback mode)
- Keep the angle feedback conversation insights logic — move it to save automatically after angle generation instead of requiring a chat interaction

#### 2. Remove LumiChat from Campaigns page
**File:** `src/pages/Campaigns.tsx`

- Remove the `LumiChat` import
- Remove `showLumiGuidance` state and the `LumiChat` render block (lines 105-122)

#### 3. Remove the LumiChat component file
**File:** `src/components/LumiChat.tsx`

- Delete or empty this file since it will no longer be used anywhere

The existing `LumiAssistant` (the small floating chat widget) remains available on every page for users who want to ask questions — it just won't auto-open and block the entire screen.

