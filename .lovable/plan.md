

# Pre-Launch QA Check System

## Overview

This plan adds a dedicated QA check stage between the "Review" step and "Publishing" step in the Campaign Builder. When the user clicks "Publish", they'll first see a full-page QA loading screen that runs through multiple checks with animated progress, building confidence that their campaign is thoroughly validated. Any issues found will be displayed with actionable fixes before proceeding.

---

## User Flow

```text
Review Step → Click "Publish to Meta" → QA Check Screen (Loading) → Results Screen → Fix Issues OR Proceed to Publish
```

---

## Part 1: New QA Check Component

### File: `src/components/QACheckScreen.tsx`

A dedicated full-page component that:
1. Shows animated progress through each check
2. Displays check status (pending, running, passed, failed, warning)
3. Shows final results with fix options
4. Allows user to proceed or go back to fix issues

### Check Categories

| Check | What It Does | Icon |
|-------|--------------|------|
| **Spelling & Grammar** | AI-powered scan of all headlines, descriptions, and primary copy | `SpellCheck` |
| **Creative Text** | Scan uploaded images for text overlay issues (future: OCR) | `Image` |
| **Landing Page** | HEAD request to verify URL is reachable | `Link` |
| **Budget** | Validate budget is set and within reasonable range | `DollarSign` |
| **Schedule** | Confirm start date is in the future, end date (if set) is after start | `Calendar` |
| **Meta Connection** | Verify ad account and page are connected | `Link2` |

### Visual Design

- Full-page overlay (similar to LumiThinking but with checklist)
- Each check shows as a row with:
  - Icon
  - Check name
  - Status indicator (spinner → checkmark/warning/X)
  - Details (collapsed, expandable on click)
- Overall progress bar at top
- When complete: summary card with pass/fail/warning counts

---

## Part 2: Edge Function for QA Checks

### File: `supabase/functions/qa-preflight-check/index.ts`

Performs server-side validation:

1. **Spelling/Grammar Check**: Use AI to scan all copy variations for issues
2. **URL Reachability**: HEAD request with timeout
3. **Date Validation**: Verify dates are logical
4. **Budget Validation**: Confirm amount is set and reasonable

Returns structured response:
```typescript
{
  success: true,
  checks: [
    {
      id: 'spelling',
      name: 'Spelling & Grammar',
      status: 'passed' | 'warning' | 'failed',
      issues: [
        { field: 'headline_1', text: 'Orignal', suggestion: 'Original', location: 'Angle: Authority' }
      ]
    },
    // ... more checks
  ],
  summary: {
    passed: 4,
    warnings: 1,
    failed: 0
  }
}
```

---

## Part 3: QA Screen UI States

### State 1: Running Checks (Animated Loading)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 67%                   │
│                                                             │
│   ✓ Meta Connection          Connected                     │
│   ✓ Budget                   $25/day verified              │
│   ◐ Landing Page             Checking...                   │
│   ○ Schedule                 Pending                       │
│   ○ Spelling & Grammar       Pending                       │
│                                                             │
│   "Running pre-flight checks..."                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### State 2: Results - All Passed

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ✅ All Checks Passed                                      │
│                                                             │
│   Your campaign is ready to go live.                       │
│                                                             │
│   ✓ Meta Connection                                        │
│   ✓ Budget ($25/day)                                       │
│   ✓ Landing Page (200 OK)                                  │
│   ✓ Schedule (Jan 15 - Continuous)                         │
│   ✓ Spelling & Grammar (12 items checked)                  │
│                                                             │
│   [Back to Review]              [Publish Now →]            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### State 3: Results - Issues Found

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ⚠️ 2 Issues Found                                         │
│                                                             │
│   Review and fix these before publishing:                  │
│                                                             │
│   ⚠ Spelling & Grammar                                     │
│     └─ "Orignal" → "Original" in headline                  │
│       [Fix Now]                                            │
│                                                             │
│   ✗ Landing Page                                           │
│     └─ Page returned 404 error                             │
│       [Check URL]                                          │
│                                                             │
│   ✓ Meta Connection                                        │
│   ✓ Budget                                                 │
│   ✓ Schedule                                               │
│                                                             │
│   [Back to Review]      [Publish Anyway (not recommended)] │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 4: Integration into Campaign Builder

### File: `src/pages/CampaignBuilder.tsx`

1. Add new stage: `"qa-check"` between `"review"` and `"publishing"`
2. Update `handlePublish` to first transition to QA check
3. QA check component calls edge function
4. On completion, either show issues or proceed to publish

### Stage Flow Update

```typescript
type Stage = "chat" | "review" | "qa-check" | "publishing" | "success";
```

### Progress Steps Update

Add "QA Check" between Review and Publishing:
```
Questions → Review → QA Check → Publishing → Live
    1          2         3           4         5
```

---

## Part 5: QA Check Component Structure

### Props Interface

```typescript
interface QACheckScreenProps {
  workspace: any;
  answers: any;
  onBack: () => void;
  onProceed: () => void;
  onFixIssue: (issueType: string, issueData: any) => void;
}
```

### Internal State

```typescript
const [checkPhase, setCheckPhase] = useState<'running' | 'complete'>('running');
const [checks, setChecks] = useState<Check[]>([
  { id: 'meta', name: 'Meta Connection', status: 'pending' },
  { id: 'budget', name: 'Budget', status: 'pending' },
  { id: 'schedule', name: 'Schedule', status: 'pending' },
  { id: 'landing_page', name: 'Landing Page', status: 'pending' },
  { id: 'spelling', name: 'Spelling & Grammar', status: 'pending' },
]);
const [currentCheck, setCurrentCheck] = useState(0);
```

---

## Part 6: Edge Function Implementation

### Check Functions

1. **checkSpellingGrammar**: 
   - Collect all copy (headlines, descriptions, primary_copy)
   - Send to AI with prompt asking for spelling/grammar issues
   - Return list of issues with suggestions

2. **checkLandingPage**:
   - Use existing `checkUrlReachability` pattern
   - HEAD request with 10s timeout
   - Return status code and any errors

3. **checkBudget**:
   - Verify budget is set and > 0
   - Warn if unusually low (< $5/day) or high (> $1000/day)

4. **checkSchedule**:
   - Start date must be today or future
   - End date (if set) must be after start date
   - Warn if start date is > 30 days in future

5. **checkMetaConnection**:
   - Verify brand has meta_account_id and page_id
   - Already done client-side but double-check

---

## Part 7: Copy Checking Details

### What Gets Checked

- All headlines from all angles
- All descriptions from all angles
- All primary copy from all angles
- Item-level final copy (if exists)

### AI Prompt for Spelling/Grammar

```text
You are a copy editor. Review the following ad copy for spelling and grammar errors.
Return a JSON array of issues found. Each issue should have:
- field: which field (headline_1, description_2, etc.)
- original: the problematic text
- suggestion: the corrected text
- reason: brief explanation (e.g., "typo", "grammar", "punctuation")

If no issues found, return an empty array.

COPY TO CHECK:
[copy content]
```

---

## Part 8: Mobile Considerations

The QA Check screen will be fully responsive:
- Stack check items vertically
- Expandable issue details
- Full-width action buttons
- Safe area handling for bottom actions

---

## Part 9: Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/QACheckScreen.tsx` | Create | Main QA check component |
| `supabase/functions/qa-preflight-check/index.ts` | Create | Server-side validation |
| `src/pages/CampaignBuilder.tsx` | Modify | Add qa-check stage, update flow |
| `src/components/MobileCampaignBuilder.tsx` | Modify | Add QA check for mobile flow |
| `src/components/CampaignReview.tsx` | Modify | Update publish button to trigger QA |

---

## Part 10: Check Animations

Each check will animate through states:

1. **Pending**: Gray circle icon, faded text
2. **Running**: Animated spinner, "Checking..." text
3. **Passed**: Green checkmark with scale-in animation
4. **Warning**: Amber warning icon, expandable details
5. **Failed**: Red X icon, expandable details with fix button

Stagger the check animations to create a sequential feel even though some checks may complete instantly.

---

## Summary

This QA check system provides:
- Visual confidence through animated progress
- AI-powered spelling/grammar checking
- URL reachability verification
- Budget and schedule validation
- Clear actionable feedback for issues
- Seamless integration into existing flow
- Mobile-responsive design

Users will feel confident their ads are thoroughly checked before going live, reducing errors and improving campaign quality.

