
# Transform Lumi into an App Navigation Helper

## Overview

This plan transforms Lumi from a creative/strategy generation assistant into a smart app navigation helper that:
1. Understands what the user is trying to accomplish
2. Provides clickable action buttons to navigate to the right place
3. Gives clear, step-by-step directions
4. Detects problems and directs users to submit bug reports

---

## Part 1: New System Prompt for Navigation Helper

### Current Behavior
Lumi currently acts as a Meta Ads creative/strategy assistant that helps generate copy, hooks, and campaign advice.

### New Behavior
Lumi becomes a **concierge** that:
- Analyzes the user's current page and progress
- Understands their intent from their message
- Provides **action buttons** that navigate them to the right place
- Gives **clear directions** on how to accomplish tasks
- Detects frustration/bugs and guides to bug report

### New System Prompt Structure

```
You are Lumi, a helpful app navigation assistant for Your Ad Assistant.

YOUR ROLE:
- Help users navigate the app and understand features
- Provide action buttons that take them directly where they need to go
- Give clear, step-by-step directions when needed
- Detect problems/bugs and guide them to submit a bug report

APP STRUCTURE (key pages):
- /start - Home: Overview of brand progress, quick actions
- /dashboard - My Brand: Brand info, offers, audience psychology, Meta connection
- /campaigns - My Ads: View and manage ad campaigns
- /create - New Ad Wizard: 3-step process to create a new campaign
- /creative-studio - Creative Studio: Generate angles, concepts, copy for campaigns
- /data - Results: View performance metrics and optimization insights
- /content-library - Concept Library: Browse saved creative concepts
- /settings - Account settings and preferences
- /glossary - Ads terminology glossary

WHEN RESPONDING:
1. First understand what the user wants to accomplish
2. Determine which page/feature will help them
3. Provide an ACTION BUTTON to navigate there (use the navigate_to tool)
4. Give 1-2 sentence directions on what to do when they arrive

BUG DETECTION:
If user describes something broken, not loading, or not working:
- Acknowledge their frustration
- Explain you can help navigate the app but can't fix bugs
- Direct them to use the bug report button (🐞) in the chat header

TONE: Warm, helpful, concise. Like a friendly concierge.
```

---

## Part 2: Enhanced Tool Calling for Navigation Actions

### New Tool: `navigate_and_guide`

Instead of just follow-up text buttons, Lumi will return **navigation actions** that render as prominent buttons:

```typescript
tools: [
  {
    type: 'function',
    function: {
      name: 'navigate_and_guide',
      description: 'Provide navigation guidance to help the user accomplish their goal',
      parameters: {
        type: 'object',
        properties: {
          response: {
            type: 'string',
            description: 'Brief explanation of what to do (1-3 sentences)'
          },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { 
                  type: 'string', 
                  enum: ['navigate', 'action', 'bug_report']
                },
                label: { type: 'string' },
                route: { type: 'string' },
                description: { type: 'string' }
              }
            },
            description: 'Actions the user can take. Max 3.'
          },
          followups: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                message: { type: 'string' }
              }
            },
            description: 'Follow-up questions (optional, max 2)'
          }
        },
        required: ['response', 'actions']
      }
    }
  }
]
```

---

## Part 3: Update LumiContext for Actions

### Extend Message Interface

```typescript
export interface NavigationAction {
  type: 'navigate' | 'action' | 'bug_report';
  label: string;
  route?: string;
  description?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  followups?: FollowUp[];
  actions?: NavigationAction[];  // NEW: Navigation actions
}
```

---

## Part 4: Update LumiAssistant UI to Render Action Buttons

### New Action Button Rendering

Add a section after the message content that renders prominent navigation buttons:

```typescript
{/* Navigation Action Buttons */}
{message.actions && message.actions.length > 0 && (
  <div className="flex flex-wrap gap-2 mt-3">
    {message.actions.map((action, idx) => (
      <Button
        key={idx}
        onClick={() => {
          if (action.type === 'navigate' && action.route) {
            navigate(action.route);
            handleCloseChat();
          } else if (action.type === 'bug_report') {
            setBugReportOpen(true);
          }
        }}
        className="gap-2"
        variant={action.type === 'navigate' ? 'default' : 'outline'}
      >
        {action.type === 'navigate' && <ArrowRight className="h-4 w-4" />}
        {action.type === 'bug_report' && <Bug className="h-4 w-4" />}
        {action.label}
      </Button>
    ))}
  </div>
)}
```

---

## Part 5: Context-Aware Quick Starters

### Replace Creative-Focused Starters with Navigation Starters

Current starters ask about creative/strategy help. New starters should focus on app navigation:

```typescript
const contextStarters: Record<string, { label: string; message: string }[]> = {
  dashboard: [
    { label: "How do I create an ad?", message: "I want to create a new ad campaign. Where do I start?" },
    { label: "Connect Meta account", message: "How do I connect my Meta ad account?" },
    { label: "Add my offer", message: "How do I add my product or service?" },
    { label: "What should I do next?", message: "I'm not sure what to do next. What's my next step?" },
  ],
  creative: [
    { label: "How does this work?", message: "How do I use the Creative Studio?" },
    { label: "Generate angles", message: "How do I generate creative angles for my ad?" },
    { label: "Write my ad copy", message: "Where do I write the copy for my ads?" },
    { label: "I'm stuck", message: "I'm confused about what to do here. Can you help?" },
  ],
  data: [
    { label: "Understand my metrics", message: "How do I understand my ad performance?" },
    { label: "What's working?", message: "How can I see which ads are performing best?" },
    { label: "Import campaigns", message: "How do I import my existing Meta campaigns?" },
    { label: "Something looks wrong", message: "The data doesn't look right. What should I do?" },
  ],
  campaigns: [
    { label: "Create new campaign", message: "How do I start a new ad campaign?" },
    { label: "Edit a campaign", message: "How do I edit one of my existing campaigns?" },
    { label: "Continue my work", message: "I was working on a campaign. How do I continue?" },
    { label: "Archive campaigns", message: "How do I archive old campaigns?" },
  ],
  // ... similar for other contexts
};
```

---

## Part 6: Proactive Welcome Message

### When Chat Opens, Show a Proactive Helper Message

Instead of waiting for user input, show a context-aware welcome:

```typescript
// When chat opens with no messages, show proactive guidance
const getWelcomeMessage = (context: string, userProgress: any) => {
  if (context === 'creative-studio' && !userProgress.hasAngles) {
    return "Welcome to Creative Studio! ✨\n\nTo get started, you'll need to:\n1. **Select or generate angles** (creative directions for your ads)\n2. **Add concepts** to your production checklist\n3. **Write your ad copy**\n\nWould you like me to walk you through it?";
  }
  // ... more context-specific welcomes
};
```

---

## Part 7: Update Edge Function (`lumi-chat`)

### New System Prompt

Replace the creative-focused prompt with a navigation helper prompt that:
- Knows all app routes and what they do
- Understands user intent
- Returns structured navigation actions
- Detects bug reports and redirects appropriately

### Enhanced Context Passing

Pass more context about user's current state:
- Current page
- Brand completion status
- Campaign progress
- What actions are available

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/lumi-chat/index.ts` | Complete rewrite of system prompt, new tool schema for navigation actions |
| `src/contexts/LumiContext.tsx` | Add `NavigationAction` interface to Message type |
| `src/components/LumiAssistant.tsx` | Update UI to render action buttons, update context starters, add proactive welcome |
| `src/components/LumiChat.tsx` | Same updates for drawer-based chat component |

---

## Part 8: Implementation Details

### Edge Function Updates

**New System Prompt:**
```typescript
const LUMI_NAVIGATOR_PROMPT = `You are Lumi, a friendly app navigation assistant for Your Ad Assistant - an app that helps people create Meta ads.

YOUR ROLE: Help users navigate the app and accomplish their goals. You are NOT a creative generator - you guide users to the right place in the app.

APP STRUCTURE:
• Home (/start) - Overview, quick actions, see what to do next
• My Brand (/dashboard) - Brand info, offers, audience psychology, Meta connection
• My Ads (/campaigns) - View/manage ad campaigns and workspaces
• New Ad (/create) - 3-step wizard to create a new campaign
• Creative Studio (/creative-studio) - Generate angles, concepts, and ad copy
• Results (/data) - Performance metrics and optimization insights
• Concept Library (/content-library) - Saved creative concepts
• Settings (/settings) - Account and preferences

RESPONSE RULES:
1. Keep responses SHORT (2-3 sentences max)
2. ALWAYS provide at least one action button for navigation
3. Give simple directions on what to do when they arrive
4. If user describes a bug/problem, direct them to the bug report button

DETECTING BUGS:
If user mentions: not loading, broken, error, doesn't work, can't click, stuck
→ Acknowledge frustration
→ Say you can't fix bugs but the team can
→ Provide a "Report Bug" action button

TONE: Friendly concierge. Simple language. No jargon.`;
```

**New Tool Schema:**
```typescript
{
  type: 'function',
  function: {
    name: 'navigate_and_guide',
    parameters: {
      type: 'object',
      properties: {
        response: { type: 'string' },
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['navigate', 'bug_report'] },
              label: { type: 'string' },
              route: { type: 'string' },
              description: { type: 'string' }
            }
          }
        },
        followups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              message: { type: 'string' }
            }
          }
        }
      }
    }
  }
}
```

### Frontend Action Button Rendering

Add after message content in both `LumiAssistant.tsx` and `LumiChat.tsx`:

```typescript
{/* Navigation Actions */}
{message.actions && message.actions.length > 0 && (
  <div className="flex flex-col gap-2 mt-3 ml-8">
    {message.actions.map((action, idx) => (
      <Button
        key={idx}
        onClick={() => {
          if (action.type === 'navigate' && action.route) {
            navigate(action.route);
            setChatOpen(false);
          } else if (action.type === 'bug_report') {
            setBugReportOpen(true);
          }
        }}
        className={cn(
          "justify-start gap-2",
          action.type === 'navigate' 
            ? "bg-gradient-lumi text-white hover:opacity-90" 
            : "variant-outline"
        )}
      >
        {action.type === 'navigate' && <ArrowRight className="h-4 w-4" />}
        {action.type === 'bug_report' && <Bug className="h-4 w-4" />}
        <span>{action.label}</span>
      </Button>
    ))}
  </div>
)}
```

---

## Part 9: Updated Context Starters

All starters should focus on "how do I..." navigation questions:

```typescript
const contextStarters = {
  dashboard: [
    { label: "Create an ad", message: "How do I create a new ad?" },
    { label: "Add my offer", message: "Where do I add my product or offer?" },
    { label: "Connect Meta", message: "How do I connect my Meta account?" },
    { label: "What's next?", message: "What should I do next?" },
  ],
  'creative-studio': [
    { label: "Get started", message: "How do I get started here?" },
    { label: "Generate angles", message: "How do I create creative angles?" },
    { label: "Write copy", message: "Where do I write my ad copy?" },
    { label: "I'm stuck", message: "I'm stuck. What should I do?" },
  ],
  data: [
    { label: "See performance", message: "How do I see my ad performance?" },
    { label: "Import campaigns", message: "How do I import my Meta campaigns?" },
    { label: "Optimize ads", message: "How do I know which ads to optimize?" },
    { label: "Something wrong", message: "Something doesn't look right here." },
  ],
  campaigns: [
    { label: "New campaign", message: "How do I create a new campaign?" },
    { label: "Continue work", message: "How do I continue a campaign I started?" },
    { label: "Archive", message: "How do I archive old campaigns?" },
    { label: "Help", message: "I need help understanding this page." },
  ],
  settings: [
    { label: "Billing", message: "Where do I manage my subscription?" },
    { label: "Meta settings", message: "How do I change my Meta connection?" },
    { label: "Email reports", message: "How do I set up weekly email reports?" },
    { label: "Help", message: "What can I do on this page?" },
  ],
  start: [
    { label: "Get started", message: "I'm new. Where do I start?" },
    { label: "Create an ad", message: "How do I create my first ad?" },
    { label: "Learn more", message: "What can this app do?" },
    { label: "Help", message: "I need help finding something." },
  ],
};
```

---

## Summary

| Component | Changes |
|-----------|---------|
| **Edge Function** | New navigation-focused system prompt, new tool schema with `actions` array |
| **LumiContext** | Add `NavigationAction` type to Message interface |
| **LumiAssistant.tsx** | Render action buttons, update starters, add proactive welcome |
| **LumiChat.tsx** | Same updates as LumiAssistant |

The result will be a Lumi that acts as a helpful concierge - understanding what users want to do and guiding them there with clear buttons and directions, rather than trying to generate creative content itself.
