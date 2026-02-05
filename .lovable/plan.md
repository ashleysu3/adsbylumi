

# Smart Resume: Remember User's Last Position in Creative Studio

## Overview

When users return to a campaign workspace that already has angles and/or creative concepts generated, the system should automatically navigate them to the appropriate tab based on their progress instead of always defaulting to the "angles" tab. This prevents unnecessary regeneration and respects the user's previous work.

---

## Current Behavior

| State | Current Behavior | Problem |
|-------|------------------|---------|
| Has angles, no concepts | Shows "angles" tab | User must manually re-select angles |
| Has concepts, no copy | Shows "angles" tab | User sees completed work, must click to concepts |
| Has copy, no builds | Shows "angles" tab | User is 3 tabs away from their actual progress |
| Has production items | Shows "angles" tab | User has to navigate through entire flow again |

---

## Proposed Behavior

The Creative Studio should determine the appropriate starting tab based on existing workspace data:

| Workspace State | Auto-Navigate To |
|-----------------|------------------|
| No angles | `angles` tab (generate first) |
| Has angles, no gridData (concepts) | `angles` tab (select angles & generate) |
| Has gridData, no production items | `concepts` tab (add to checklist) |
| Has production items, no copy | `copy` tab (generate/edit copy) |
| Has production items with copy | `build` tab (upload & finalize) |

---

## Part 1: Update loadWorkspace Function

### File: `src/pages/CreativeStudio.tsx`

Modify the `loadWorkspace` function to intelligently set `activeTab` based on the loaded data.

**Current code (lines 266-304):**
```typescript
const loadWorkspace = async (id: string) => {
  // ... loads data ...
  setAvailableAngles(loadedAngles);
  setSelectedAngleIds(validSelectedIds);
  setGridData(validGridData);
  setActiveAngleId(validSelectedIds[0] || "");
  // ... loads production items and copy ...
};
```

**Updated logic to add after loading all data:**
```typescript
const loadWorkspace = async (id: string) => {
  // ... existing loading logic ...
  
  // Smart tab selection based on progress
  const hasAngles = loadedAngles.length > 0;
  const hasGridData = validGridData.length > 0;
  const hasProductionItems = loadedProductionItems.length > 0;
  const hasCopy = c?.angle_copy && Object.keys(c.angle_copy).length > 0;
  
  let targetTab: WorkflowTab = "angles";
  
  if (hasProductionItems && hasCopy) {
    // User has copy written - go to build
    targetTab = "build";
  } else if (hasProductionItems) {
    // User has selected concepts but no copy - go to copy
    targetTab = "copy";
  } else if (hasGridData) {
    // User has concepts generated but none selected - go to concepts
    targetTab = "concepts";
  }
  // else: no concepts yet, stay on angles (default)
  
  setActiveTab(targetTab);
};
```

---

## Part 2: Save Last Active Tab to Workspace

To provide even more precise resumption, save the user's last active tab to the workspace.

**Add to creative_json structure:**
```typescript
{
  angles: [...],
  gridData: [...],
  selectedAngleIds: [...],
  angle_copy: {...},
  lastActiveTab: "concepts" | "copy" | "build"  // NEW
}
```

**Update saveCreativeState calls to include tab:**
```typescript
// When user changes tabs, save it
useEffect(() => {
  if (workspace && activeTab !== "angles") {
    saveCreativeState({ lastActiveTab: activeTab });
  }
}, [activeTab, workspace]);
```

**Use saved tab if available:**
```typescript
const loadWorkspace = async (id: string) => {
  // ... load data ...
  
  // Check for explicitly saved last tab first
  const savedTab = c?.lastActiveTab;
  if (savedTab && isValidTabForState(savedTab, { hasAngles, hasGridData, hasProductionItems, hasCopy })) {
    setActiveTab(savedTab);
  } else {
    // Fall back to smart detection
    // ... existing logic ...
  }
};
```

---

## Part 3: Tab Validation Helper

Ensure the saved tab is still valid for the current data state.

```typescript
const isValidTabForState = (
  tab: WorkflowTab,
  state: { hasAngles: boolean; hasGridData: boolean; hasProductionItems: boolean; hasCopy: boolean }
): boolean => {
  switch (tab) {
    case "angles":
      return true; // Always valid
    case "concepts":
      return state.hasGridData; // Only valid if concepts exist
    case "copy":
      return state.hasProductionItems; // Only valid if items selected
    case "build":
      return state.hasProductionItems; // Only valid if items selected
    default:
      return false;
  }
};
```

---

## Part 4: Regeneration Controls

Keep regeneration accessible but don't force it:

| Tab | Regenerate Button | Behavior |
|-----|-------------------|----------|
| Angles | "Regenerate Angles" | Clears concepts, copy, production items; confirms with user |
| Concepts | "Regenerate Creative" | Clears concepts but keeps angles selected |
| Copy | "Regenerate Copy" | Regenerates copy for current angle |

**Add confirmation dialog for destructive regeneration:**
```typescript
const handleRegenerateAngles = async () => {
  // If user has downstream progress, show confirmation
  if (gridData.length > 0 || productionItems.length > 0) {
    const confirmed = window.confirm(
      "Regenerating angles will clear your existing concepts and production checklist. Continue?"
    );
    if (!confirmed) return;
  }
  await generateAngles();
};
```

---

## Part 5: Files to Modify

| File | Changes |
|------|---------|
| `src/pages/CreativeStudio.tsx` | Update `loadWorkspace` to set smart `activeTab`; Save `lastActiveTab` on tab change; Add `isValidTabForState` helper; Add confirmation for destructive regeneration |

---

## Technical Details

### Updated loadWorkspace Function

**File:** `src/pages/CreativeStudio.tsx`

**Location:** Lines 266-305 (loadWorkspace function)

**Changes:**

1. After loading all state (`loadedAngles`, `validGridData`, `loadedProductionItems`, `angleCopy`), determine the appropriate tab:

```typescript
const loadWorkspace = async (id: string) => {
  setSelectedWorkspaceId(id);
  setSearchParams(p => { p.set("workspace", id); return p; }, { replace: true });
  try {
    const { data } = await supabase.from("campaign_workspaces").select("*, brands(*)").eq("id", id).single();
    setWorkspace(data);
    const c = data?.creative_json as Record<string, any> | null;
    const loadedAngles = c?.angles || [];
    const loadedAngleIds = new Set(loadedAngles.map((a: any) => a.id));
    
    const storedSelectedIds = c?.selectedAngleIds || [];
    const validSelectedIds = storedSelectedIds.filter((id: string) => loadedAngleIds.has(id));
    
    const loadedGridData = c?.gridData || [];
    const validGridData = loadedGridData.filter((cell: any) => loadedAngleIds.has(cell.angleId));
    
    setAvailableAngles(loadedAngles);
    setSelectedAngleIds(validSelectedIds);
    setGridData(validGridData);
    setActiveAngleId(validSelectedIds[0] || "");

    const loadedProductionItems = ((data?.production_items as any[]) || []).map((pi: any) => {
      const normalized = normalizeScriptLines(pi?.script_lines);
      return normalized ? { ...pi, script_lines: normalized } : pi;
    });
    setProductionItems(loadedProductionItems);

    if (c?.angle_copy) {
      setAngleCopy(c.angle_copy);
    }
    
    // ========== NEW: Smart tab selection ==========
    const hasAngles = loadedAngles.length > 0;
    const hasGridData = validGridData.length > 0;
    const hasProductionItems = loadedProductionItems.length > 0;
    const hasCopy = c?.angle_copy && Object.keys(c.angle_copy).some(
      id => c.angle_copy[id]?.headlines?.length > 0 || 
            c.angle_copy[id]?.descriptions?.length > 0 ||
            c.angle_copy[id]?.primary_copy?.length > 0
    );
    
    // Check for saved tab first
    const savedTab = c?.lastActiveTab as WorkflowTab | undefined;
    let targetTab: WorkflowTab = "angles";
    
    if (savedTab) {
      // Validate saved tab is still appropriate
      const tabIsValid = 
        savedTab === "angles" ||
        (savedTab === "concepts" && hasGridData) ||
        (savedTab === "copy" && hasProductionItems) ||
        (savedTab === "build" && hasProductionItems);
      
      if (tabIsValid) {
        targetTab = savedTab;
      }
    }
    
    // If no valid saved tab, use smart detection
    if (targetTab === "angles" && !savedTab) {
      if (hasProductionItems && hasCopy) {
        targetTab = "build";
      } else if (hasProductionItems) {
        targetTab = "copy";
      } else if (hasGridData) {
        targetTab = "concepts";
      }
    }
    
    setActiveTab(targetTab);
    // ========== END NEW ==========
    
    if (validSelectedIds.length !== storedSelectedIds.length || validGridData.length !== loadedGridData.length) {
      console.warn('Cleaned up stale angle references from workspace');
    }
  } catch (e) { console.error(e); }
};
```

2. Add useEffect to save last active tab when it changes:

```typescript
// Save last active tab to workspace
useEffect(() => {
  if (workspace && activeTab && activeTab !== "angles") {
    const cur = (workspace.creative_json || {}) as Record<string, any>;
    // Only save if different from current stored value
    if (cur.lastActiveTab !== activeTab) {
      supabase
        .from("campaign_workspaces")
        .update({ 
          creative_json: { ...cur, lastActiveTab: activeTab },
          updated_at: new Date().toISOString()
        })
        .eq("id", workspace.id)
        .then(() => {
          // Update local workspace state
          setWorkspace((prev: any) => ({
            ...prev,
            creative_json: { ...prev?.creative_json, lastActiveTab: activeTab }
          }));
        });
    }
  }
}, [activeTab, workspace?.id]);
```

3. Add confirmation before regenerating angles if downstream work exists:

```typescript
const generateAngles = async () => {
  if (!workspace?.strategy_json) { toast.error("Complete strategy first"); return; }
  
  // Confirmation if downstream work exists
  if (gridData.length > 0 || productionItems.length > 0) {
    const confirmed = window.confirm(
      "Regenerating angles will clear your existing concepts and production checklist. Continue?"
    );
    if (!confirmed) return;
  }
  
  setGenerating(true); 
  setGeneratingPhase("angles");
  // ... rest of existing logic
};
```

---

## Summary

This update ensures users are automatically taken to the most relevant point in their creative workflow when returning to a workspace:

1. **Smart detection** - Analyzes existing data to determine the furthest progress point
2. **Tab persistence** - Saves and restores the user's last active tab
3. **Validation** - Ensures the restored tab is still valid for the current data state
4. **Confirmation guards** - Warns before destructive regeneration that would clear downstream work

Users returning to a workspace with existing work will see their progress immediately instead of having to navigate through tabs manually.

