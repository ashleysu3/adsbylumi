

## Plan: Simplify Lumi Recommendations Layout

The current card packs too many elements per row — icon, title, campaign badge, confidence badge, budget badge, and action button all compete for attention. For overwhelmed users, this creates visual noise.

### Redesign Approach

**File:** `src/components/insights/LumiRecommendations.tsx`

Restructure each recommendation card into a clean two-line layout:

1. **Line 1**: Icon + title + action button (right-aligned). Remove the confidence badge entirely — it adds cognitive load without helping the user decide. Remove the "Budget" badge — the budget confirmation dialog already handles that safety net.

2. **Line 2**: Campaign name as small muted text (not a badge) below the title. This gives context without visual weight.

3. **Remove** the `impact` line and `description` line in non-compact mode — they repeat the title and add clutter. The title alone ("Strong performance — scale up") is self-explanatory.

Result: Each recommendation becomes a single clean row with one clear action, instead of a badge-heavy block.

### Technical Details

- Remove `confidence` Badge render (lines 315-324)
- Remove `requiresDoubleApproval` Budget Badge render (lines 325-329)
- Convert `campaignName` from a Badge to plain `text-xs text-muted-foreground` on a second line
- Remove the `description` and `impact` paragraphs (lines 332-339) — keep the compact layout always
- Keep all execution logic, approve-all, and budget confirmation dialog unchanged

