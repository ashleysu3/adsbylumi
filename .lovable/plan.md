
# Fix Campaign Wizard: Remove Creative Template Requirement

## Problem Identified

The "Create My Ad" button on Step 3 triggers `handleComplete` which validates that a creative template has been selected. But according to the streamlined 3-step workflow (documented in project memory), clicking that button should:
1. Generate creative angles
2. Create the workspace
3. Navigate directly to Creative Studio where the creative process begins

## Root Cause

In `MobileStepWizard.tsx`, when `isLastStep = true`, the button calls `onComplete` instead of `onNext`:
```typescript
// Line 161 of MobileStepWizard.tsx
onClick={isLastStep ? onComplete : onNext}
```

The `handleComplete` function (lines 452-532) still has OLD validation:
```typescript
if (!selectedAngle || selectedCreativeTemplates.length === 0) {
  toast.error("Please select at least one creative template");
  return;
}
```

But the NEW flow is in `handleNext` → `handleGenerateAndNavigate()` which correctly creates the workspace and navigates to Creative Studio.

## Technical Solution

### File: `src/pages/Create.tsx`

**Option A (Recommended): Replace `handleComplete` logic with the new flow**

Replace the entire `handleComplete` function to call `handleGenerateAndNavigate()`:

```typescript
const handleComplete = async () => {
  // The new streamlined flow: generate angles and navigate to Creative Studio
  await handleGenerateAndNavigate();
};
```

This is the cleanest fix because:
- It keeps `totalSteps = 3` (matching the 3-step UI)
- The button correctly shows "Create My Ad" on the last step (via `completeLabel`)
- But now it runs the correct new workflow

**Alternative approach:** Remove the redundant `handleComplete` entirely and pass `handleGenerateAndNavigate` directly:

```typescript
// Around line 742
onComplete={handleGenerateAndNavigate}
```

### Additional Cleanup

Since the old `handleComplete` function duplicates a lot of code that's already in `handleGenerateAndNavigate`, we can delete the redundant code from lines 452-532 and just make `handleComplete` call the new flow.

## Summary of Changes

| File | Change |
|------|--------|
| `src/pages/Create.tsx` | Replace `handleComplete` body with call to `handleGenerateAndNavigate()` |

## Expected Behavior After Fix

1. User selects offer (Step 1) → proceeds
2. User sees recommended strategy (Step 2) → proceeds  
3. User sees campaign structure (Step 3) → clicks "Create My Ad"
4. System generates psychology-driven creative angles
5. System creates workspace with angles
6. User is redirected to Creative Studio to continue the creative process

No more "Please select at least one creative template" error.
