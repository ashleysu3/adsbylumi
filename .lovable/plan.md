
## Plan: Add "Have an invite code?" Button to Home Page Header

### Overview
Add a prominent button next to the existing "Log In" button in the Sales page header that directs users with invite codes directly to the signup flow.

### Changes Required

**File: `src/pages/Auth.tsx`**
1. Add URL parameter support to detect when users are coming from the "Have an invite code?" flow
2. Check for a `signup=true` query parameter on mount
3. If present, automatically set `isLogin` to `false` to show the signup form

**File: `src/pages/Sales.tsx`**
1. Add a second button in the header next to "Log In"
2. Style it as the primary/accent button to stand out (using the `lumi` or `glow` variant)
3. Button text: "Have an invite code?"
4. Navigate to `/auth?signup=true` to trigger the signup form

### Implementation Details

**Header Layout Update (Sales.tsx)**
```jsx
<div className="flex items-center gap-2 sm:gap-3">
  <Button 
    onClick={() => navigate("/auth?signup=true")} 
    variant="lumi" 
    className="rounded-full text-sm sm:text-base px-4 sm:px-6"
  >
    Have an invite code?
  </Button>
  <Button 
    onClick={() => navigate("/auth")} 
    variant="outline" 
    className="rounded-full text-sm sm:text-base px-4 sm:px-6"
  >
    Log In
  </Button>
</div>
```

**Auth Page Update (Auth.tsx)**
```jsx
// Add useSearchParams or parse location.search
const searchParams = new URLSearchParams(window.location.search);
const startWithSignup = searchParams.get('signup') === 'true';

// Initialize state based on URL param
const [isLogin, setIsLogin] = useState(!startWithSignup);
```

### Mobile Considerations
- On smaller screens, the "Have an invite code?" text might be long
- Could shorten to "Got a code?" on mobile using responsive classes
- Ensure both buttons remain touch-friendly with proper min-height

### Visual Hierarchy
- "Have an invite code?" button: Primary/Lumi variant (stands out)
- "Log In" button: Outline variant (secondary action)
- This makes the invite code path more discoverable for new users who have received codes
