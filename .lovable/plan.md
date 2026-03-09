

## Streamline Ad Performance Page

Three issues to fix:

### 1. Remove "Refresh Ad Results" from header
Remove the button at line 903-909. Move a subtle "Sync latest from Meta" link to the bottom of the page, after all content, so it's available but not prominent.

### 2. Fix report preview scroll
The `DialogContent` has `max-h-[85vh] overflow-y-auto` but Radix Dialog's content structure can block scroll. The fix is to split the dialog into a fixed header/footer with a scrollable body div in between, using `overflow-y-auto` on just the body section and removing `overflow-y-auto` from `DialogContent`.

### 3. Consolidate report buttons
Currently there are two buttons: "Run Report" and "Preview Report". Merge them into a single **"Generate Report"** button that:
- Runs the report (calls `run-optimization-report`)
- Opens the preview dialog when done (already does this)
- If a recent report already exists (loaded on page mount), the button label changes to **"View Report"** and just opens the preview without re-running. A small "Refresh" icon inside the dialog lets them re-run if needed.

This means: one button in the header, not two. The dialog itself gets a "Refresh Report" action so users can re-run from within the preview.

### Files changed
- `src/pages/Data.tsx` — all three changes in one file

