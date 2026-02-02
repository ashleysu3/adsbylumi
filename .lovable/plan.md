

# Add Full Script Details to Production Checklist Panel

## Problem
The Production Checklist Panel currently shows only a minimal summary (hook + guidance + angle badge) for each item. For talking head creatives, users need immediate access to:
- Line-by-line script they can read to camera
- Written hook (text overlay for the screen)
- Visual hook options (where/how to record)
- Caption reminder

The full details exist in `ProductionWorkflow.tsx` (the modal), but users need this information visible directly in the checklist panel without opening each item individually.

## Solution
Enhance `ProductionChecklistPanel.tsx` to show an expandable detailed view for each item, especially for talking head format, that includes:
1. Line-by-line script with "Copy Script" button
2. Written hook (on-screen text)
3. Visual hook options (selectable settings)
4. Caption reminder alert
5. Delivery style tip

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/creative/ProductionChecklistPanel.tsx` | Add expandable script/hook section for talking head items |

## Implementation Details

### ProductionChecklistPanel.tsx Changes

Add an expandable section within each checklist item that shows (for talking_head format):

1. **Three-Hook System Display**
   - Verbal Hook card (blue)
   - Written Hook card (purple) 
   - Visual Hook card (green)

2. **Visual Hook Options**
   - Show 2-3 selectable setting alternatives as badges

3. **Line-by-Line Script**
   - Numbered script lines
   - "Copy Script" button for teleprompter use

4. **Text Overlays**
   - Color-coded by type (hook, transition, cta)
   - Timing indicators

5. **Caption Reminder**
   - Amber warning box about 85% watching without sound

6. **Delivery Style Tip**
   - Italic helper text for how to deliver

### UI Pattern
- Add expand/collapse chevron to each item
- When expanded, show full talking head production guide
- Keep the collapsed view minimal (current behavior)
- Add a "Copy Script" button visible even when collapsed for talking_head items

### Technical Approach

```tsx
// Add expand state
const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

// Toggle expand
const toggleExpand = (id: string) => {
  setExpandedItems(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
};

// In the render, for each item:
{item.format === "talking_head" && expandedItems.has(item.id) && (
  <div className="mt-3 pt-3 border-t space-y-3">
    {/* Three-Hook System */}
    {/* Script Lines */}
    {/* Text Overlays */}
    {/* Caption Reminder */}
  </div>
)}
```

## Visual Layout (Expanded State)

```text
+------------------------------------------+
| [x] "—and that's when I realized..."     |
|     [Pattern Interrupt] [Talking Head]   |
|     Authority Angle                      |
|                                          |
|  [Copy Script] [Expand v]  [Trash]       |
+------------------------------------------+
| 🗣️ VERBAL HOOK                          |
| "—and that's when I realized..."         |
|                                          |
| ✍️ WRITTEN HOOK (On Screen)              |
| "The moment everything changed"          |
|                                          |
| 👁️ VISUAL HOOK OPTIONS                   |
| [At desk] [Walking to car] [With coffee] |
|                                          |
| 📜 YOUR SCRIPT                           |
| 1. —and that's when I realized...        |
| 2. I'd been doing the same thing...      |
| 3. Working harder, not smarter.          |
| 4. (pause) Here's what I realized...     |
| 5. The problem wasn't my effort.         |
| 6. Once I switched to [method], clicked. |
|                                          |
| 📝 TEXT OVERLAYS                         |
| [HOOK] "The moment everything changed"   |
|        ⏱️ 0-3s                            |
| [CTA]  "The ONE thing I changed →"       |
|        ⏱️ 15-18s                          |
|                                          |
| 🔇 85% watch without sound — add captions|
+------------------------------------------+
```

## User Experience
- For talking head items, users see an expand button
- Clicking expand reveals full production guide
- "Copy Script" button works even when collapsed
- All the information they need to record is in one place
- No need to open a separate modal for basic production tasks

