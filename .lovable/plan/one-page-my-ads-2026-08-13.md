# One page: "My Ads"

Today the same campaigns live in two places — **My Ads** (`/live-ads`, performance + recommendations) and **Campaigns** (`/campaigns`, drafts + every workspace). People bounce between them and can't tell which one to open.

Merge them into a single **My Ads** page with two sections: **Live** and **In progress**.

## Page structure (top to bottom)

```text
My Ads                                       [Date range ▾]  [Refresh]
Everything you're running and everything you're still building.

┌ Needs your attention ───────────────────────────────────┐
│ Up to 3 highest-impact recommendations, each with       │
│ "Approve" / "Not now". Hidden when there's nothing.     │
└──────────────────────────────────────────────────────────┘

▾ LIVE  (4)                            spend · results · avg cost
   [campaign card] [campaign card] [campaign card] [campaign card]

▸ IN PROGRESS  (2)
   [draft card] [draft card]

   Archived (3)   ← quiet toggle at the very bottom
```

Both sections are collapsible. **Live is open by default; In progress is open only when Live is empty** (a brand-new user should land on their drafts, not an empty state). Open/closed choice is remembered per user.

## Section 1 — Live

The current Live Ads content, unchanged in substance:

- One card per running campaign: name, purpose, status pill (Learning / Performing / Scaling ready / Underperforming / Fatigued), the KPI vs goal, and its single top recommendation in plain English.
- Card click opens the existing Closer Look page.
- A small summary strip on the section header: total spend, total results, average cost per result for the selected date range.
- Date range picker in the page header applies to Live only, with the existing note that recommendations use LUMI's 3/7/30-day analysis.

Empty state: "No ads running yet — finish a draft below and hit publish."

## Section 2 — In progress

The current Campaigns list, reframed as "everything not yet live":

- One card per draft workspace: name, offer, a 4-dot progress trail (Strategy → Creative → Copy → Ready to publish), last-edited time, and one primary button that resumes exactly where they left off ("Keep building" / "Add creative" / "Publish").
- The "Continue your ad?" resume banner sits at the top of this section instead of the page.
- Row menu keeps archive / restore / combine as they work today.
- Imported Meta campaigns that have no LUMI creative still show here with an "Imported" pill.

Empty state: "Nothing in progress. [Create new ad]"

## Small UX details that make it feel calm

- One clear primary action per card. No card has two competing buttons.
- Status is always a colored dot + a word — never color alone.
- Counts live in the section headers ("LIVE 4", "IN PROGRESS 2") so a collapsed section still tells you something.
- Sticky page header on scroll so the date range and Refresh stay reachable.
- The existing "Meta has campaigns LUMI doesn't know about" import banner moves directly under the page title.
- Mobile: sections stack, cards go full width, the summary strip wraps to two rows.

## Navigation change

Sidebar loses one item — **My Ads** and **Campaigns** become a single **My Ads** entry.

## Technical notes

- New page `src/pages/MyAds.tsx` composed of two extracted section components; the heavy logic in `src/pages/Performance.tsx` and `src/components/CampaignsList.tsx` moves in as-is rather than being rewritten.
- Route `/my-ads` becomes canonical. `/live-ads`, `/ad-performance`, and `/campaigns` redirect to it; `/live-ads/:campaignId` (Closer Look) stays exactly as it is.
- Live vs in-progress split keeps the existing rule: a workspace with a real numeric Meta campaign id is Live, everything else is In progress.
- `?addCreative=true` keeps working — it scopes the page to selectable cards as it does now.
- Section open/closed state stored in localStorage keyed by user, matching the brand-scoped storage pattern already used elsewhere.
- No schema changes, no edge function changes.
