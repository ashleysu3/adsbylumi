

# Restructure Creative Studio: Add Dedicated "Ad Copy" Tab

## Overview

This plan restructures the Creative Studio from a 3-tab flow to a 4-tab linear progression that separates copy editing from the build/upload phase:

**Current Flow (3 tabs):**
1. Angles → Select angles, generate creative
2. Copy & Creative → View concepts, add to checklist, copy editing is in Build
3. Build → Upload assets + edit copy (combined)

**New Flow (4 tabs):**
1. Angles → Select angles, generate creative
2. Creative Concepts → View concepts, add to checklist
3. Ad Copy → Generate/edit headlines, descriptions, primary copy per angle
4. Build → Upload creative files, final publish

---

## Part 1: Tab Structure Changes

### Update `CreativeStudio.tsx`

**New tab configuration:**
```typescript
type WorkflowTab = "angles" | "concepts" | "copy" | "build";

const workflowTabs = [
  { id: "angles" as const, label: "Angles", icon: Target },
  { id: "concepts" as const, label: "Creative Concepts", icon: Lightbulb },  // Rename from copy_creative
  { id: "copy" as const, label: "Ad Copy", icon: FileText },                 // NEW TAB
  { id: "build" as const, label: "Build", icon: Rocket },
];
```

### Tab Content Changes

| Tab | Button at Bottom | Next Action |
|-----|------------------|-------------|
| Angles | "Generate Creative" | Goes to Concepts tab |
| Concepts | "Continue to Ad Copy" | Goes to Copy tab |
| Copy | "Continue to Build" | Goes to Build tab |
| Build | "Build Campaign" | Navigates to Campaign Builder |

---

## Part 2: Creative Concepts Tab (Renamed from `copy_creative`)

**Changes:**
- Rename from "Copy & Creative" to "Creative Concepts"
- Focus purely on browsing and selecting concepts
- Remove copy-related UI
- Change CTA button from "Continue to Build" to "Continue to Ad Copy"

```typescript
<TabsContent value="concepts">
  {/* Angle selector pills */}
  {/* Grid of creative concept cards */}
  {/* Add to Checklist buttons */}
  
  <div className="flex justify-end">
    <Button 
      onClick={() => setActiveTab("copy")} 
      disabled={productionItems.length === 0}
      className="gap-2"
    >
      Continue to Ad Copy
      <ArrowRight className="h-4 w-4" />
    </Button>
  </div>
</TabsContent>
```

---

## Part 3: New Ad Copy Tab

**Purpose:** Dedicated space for generating and editing the ad copy (headlines, descriptions, primary copy) that will be used across all selected creatives.

**Layout:**
```text
┌─────────────────────────────────────────────────────────────┐
│ 📝 Ad Copy                                                  │
│ "Write compelling copy for your ads"                        │
├─────────────────────────────────────────────────────────────┤
│ [Angle 1] [Angle 2] [Angle 3]   ← Angle tabs                │
├─────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐  │
│ │ [Generate Copy] [Generate All]                          │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ▾ Headlines (3)                                             │
│   ┌─────────────────────────────────────┐                   │
│   │ "Unlock Your Brand's Full Potential" │ [x]              │
│   └─────────────────────────────────────┘                   │
│   [+ Add Headline]                                          │
│                                                             │
│ ▸ Descriptions (3)                                          │
│ ▸ Primary Copy (3)                                          │
│                                                             │
│ ℹ️ Why the same copy for each angle? Meta's algorithm...    │
├─────────────────────────────────────────────────────────────┤
│                               [Save Copy] [Continue to Build]│
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**
Lift the `AngleCopyEditor` component out of `ProductionManager.tsx` and render it as a full-width component in the new Copy tab.

```typescript
<TabsContent value="copy">
  {productionItems.length === 0 ? (
    <Card>
      <CardContent className="pt-6 text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Select Concepts First</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Add creative concepts to your checklist before writing copy.
        </p>
        <Button onClick={() => setActiveTab("concepts")} variant="outline">
          Go to Creative Concepts
        </Button>
      </CardContent>
    </Card>
  ) : (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ad Copy</h2>
          <p className="text-sm text-muted-foreground">
            Write headlines, descriptions, and primary copy for your ads
          </p>
        </div>
        <AutoSaveIndicator status={copySaveStatus} />
      </div>
      
      <AngleCopyEditor
        angles={availableAngles}
        selectedAngleIds={selectedAngleIds}
        angleCopy={angleCopy}
        brandInfo={workspace?.brands}
        offerData={{ name: workspace?.offer_name, ... }}
        audiencePsychology={workspace?.brands?.audience_psychology}
        onCopyChange={handleCopyChange}
        onSave={handleSaveCopy}
        productionItemCount={productionItems.length}
      />
      
      <div className="flex justify-end">
        <Button 
          onClick={() => setActiveTab("build")} 
          className="gap-2"
        >
          Continue to Build
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )}
</TabsContent>
```

---

## Part 4: Update Build Tab

**Changes:**
- Remove the `AngleCopyEditor` from the right column
- Make the Production Checklist full-width
- Focus purely on asset upload and campaign building

**Before (current layout):**
```text
┌─────────────────────┬─────────────────┐
│ Production Checklist│ Copy Editor     │
│ (3/5 width)         │ (2/5 width)     │
└─────────────────────┴─────────────────┘
```

**After (new layout):**
```text
┌─────────────────────────────────────────┐
│ Production Checklist (full width)       │
│ - Upload creative files for each concept│
│ - Preview ads                           │
│ - Build Campaign button                 │
└─────────────────────────────────────────┘
```

**Update `ProductionManager.tsx`:**
1. Remove the 5-column grid layout
2. Remove the `AngleCopyEditor` component and related props
3. Make the Production Checklist full-width
4. Keep all upload, preview, ranking, and export functionality

---

## Part 5: State Management Updates

### Move Copy State Up to CreativeStudio

Copy-related state will be managed at the CreativeStudio level and passed to both the Copy tab and the Build tab (for ad previews):

```typescript
// In CreativeStudio.tsx
const [angleCopy, setAngleCopy] = useState<Record<string, AngleCopyData>>({});
const [copySaveStatus, setCopySaveStatus] = useState<SaveStatus>("idle");

const handleCopyChange = (angleId: string, copy: AngleCopyData) => {
  setAngleCopy(prev => ({ ...prev, [angleId]: copy }));
};

const handleSaveCopy = async () => {
  // Save to workspace.creative_json.angle_copy
};

// Load from workspace on mount
useEffect(() => {
  if (workspace?.creative_json?.angle_copy) {
    setAngleCopy(workspace.creative_json.angle_copy);
  }
}, [workspace]);
```

---

## Part 6: Update Idle Help Messages

Update `getIdleHelpMessage()` for the new tab structure:

```typescript
const getIdleHelpMessage = (
  activeTab: WorkflowTab,
  ...
) => {
  if (activeTab === "angles") { ... }
  
  if (activeTab === "concepts") {
    if (gridData.length === 0) {
      return "Head to the Angles tab to generate your creative concepts first.";
    }
    if (productionItems.length === 0) {
      return "Browse the concepts and click 'Add to Checklist' on the ones you want to produce.";
    }
    return `You have ${productionItems.length} concepts selected. Continue to Ad Copy to write your headlines and descriptions.`;
  }
  
  if (activeTab === "copy") {
    if (productionItems.length === 0) {
      return "Select creative concepts first, then come here to write your ad copy.";
    }
    if (!hasAnyCopy) {
      return "Click 'Generate Copy' to create headlines, descriptions, and primary copy for your ads.";
    }
    return "Looking good! Review your copy and continue to Build when ready.";
  }
  
  if (activeTab === "build") {
    if (productionItems.length < 3) {
      return `Add ${3 - productionItems.length} more concepts to unlock campaign building.`;
    }
    if (!hasAtLeastOneUpload) {
      return "Upload your video or image files to each creative concept.";
    }
    return "Your creatives are ready! Click 'Build Campaign' to publish.";
  }
};
```

---

## Part 7: Files to Modify

| File | Changes |
|------|---------|
| `src/pages/CreativeStudio.tsx` | Add "copy" tab, rename "copy_creative" to "concepts", move copy state up, update navigation buttons |
| `src/components/creative/ProductionManager.tsx` | Remove `AngleCopyEditor`, remove copy-related props, make checklist full-width |
| `src/components/creative/AngleCopyEditor.tsx` | Minor styling updates for full-width usage (currently designed for sidebar) |

---

## Part 8: Implementation Summary

1. **Update tab definition** - Change from 3 tabs to 4 tabs with new type
2. **Rename "Copy & Creative"** - Now "Creative Concepts", focused on concept selection only
3. **Add new "Ad Copy" tab** - Contains `AngleCopyEditor` as main content
4. **Update "Build" tab** - Remove copy editor, make checklist full-width
5. **Update navigation flow** - Concepts → "Continue to Ad Copy" → Copy → "Continue to Build"
6. **Lift state** - Move `angleCopy` state to `CreativeStudio.tsx`
7. **Update help messages** - Context-aware messages for 4-tab flow

