

## Post-launch celebration + KPI walkthrough flow

After a user publishes their first campaign, replace the current static success screen with a two-part celebratory experience:

1. **Celebration success screen** (refreshed `CampaignSuccess.tsx`)
2. **Guided KPI & Goal-Setting Walkthrough modal** that auto-opens on top, educates the user, and saves a goal to the database

### User flow

```text
Click "Publish to Meta"
  → publishing spinner
  → 🎉 Celebration success screen (confetti + Lumi sparkle moment)
  → After ~1.2s, a multi-step walkthrough modal slides in automatically
     (only on FIRST campaign launch — gated by a per-user flag)
  → Step 1: "Meet your KPIs" (educates on what CTR / CPC / CPL / ROAS / CPM mean,
            tailored to the campaign's objective using lumi-kpi-config)
  → Step 2: "Here's your benchmark" (shows healthy/attention/critical ranges
            from the existing benchmark data)
  → Step 3: "Set your success goal" (pre-fills from GoalSetupModal's
            suggestGoals() logic — user can adjust threshold, then Save)
  → Step 4: "How Lumi watches this for you" (explains the diagnostic system,
            green/yellow/red status, fatigue alerts, weekly reports)
  → Step 5: "⏳ Give it at least 3 days" (firm guidance: do not pause, edit,
            or judge performance before 72 hours / 1,000 impressions —
            quotes the existing learning-phase rule)
  → "Got it — take me to my dashboard" → /data?campaign={id}
```

### What the celebration screen looks like

- Larger, animated headline using `font-display` and the `bg-gradient-lumi` text treatment (matches the Welcome page styling)
- `framer-motion` confetti burst + floating Sparkles on mount (one-shot)
- Big "🚀 Your campaign is LIVE" headline with the campaign name underneath
- Keep the existing pause/active toggle, campaign details card, and "View in Ads Manager" link
- Replace the bland "Next Steps" list with a single warm CTA: **"Let's set your success goal →"** that opens the walkthrough manually if the user dismissed it
- Keep "Back to Dashboard" as a secondary action

### What the walkthrough modal looks like

A new component `src/components/PostLaunchWalkthrough.tsx`:

- Built on existing `Dialog` + step indicator pattern (matches `MetaCampaignBuilder` style)
- 5 steps with progress dots at the top
- Each step uses `LumiSpark` / `SparkleIcon` for warm Lumi-led tone
- Step 3 reuses the existing `suggestGoals()` logic and KPI options from `GoalSetupModal.tsx` — extracted into a shared helper so we have one source of truth for benchmarks/suggestions
- Step 5 visually emphasizes the **3-day minimum** with a "Don't touch it!" callout card and a checklist (no pausing, no budget changes, no creative swaps for 72 hrs)
- "Skip for now" link in the footer at every step (still saves any partial goal entered)

### "First launch only" gating

The walkthrough auto-opens **only** on a user's first-ever live campaign so it doesn't become noise. After that it's manually accessible from the success screen CTA.

- Add a column `first_campaign_launched_at timestamptz` to the `profiles` table (nullable). On successful publish, if it's null, set it to `now()` and trigger the walkthrough. If it already has a value, skip auto-open but show the manual CTA.
- Migration is the only DB change needed; goal saving uses the existing `campaign_goals` upsert.

### Technical changes

1. **DB migration** — add `profiles.first_campaign_launched_at timestamptz null`.
2. **New file** `src/components/PostLaunchWalkthrough.tsx` — 5-step Dialog component. Receives `workspace`, `campaignId`, `objective`, `offerPrice`, `templateSlug`, and `onClose`. Saves goal to `campaign_goals` via the same upsert pattern used in `GoalSetupModal`.
3. **New file** `src/lib/goal-suggestions.ts` — extract `suggestGoals()` and `KPI_OPTIONS` from `GoalSetupModal.tsx` so both modal and walkthrough share the same logic. Update `GoalSetupModal.tsx` to import from it.
4. **Edit** `src/components/CampaignSuccess.tsx`:
   - Add `framer-motion` celebration animation + confetti burst on mount
   - Apply `font-display` + gradient text to headline (match Welcome page)
   - Add new prop `onOpenWalkthrough: () => void` and a primary CTA button that calls it
   - On mount, check `profiles.first_campaign_launched_at`; if null, mark it now and call `onOpenWalkthrough()` after a 1.2s delay
5. **Edit** `src/pages/CampaignBuilder.tsx`:
   - Add `walkthroughOpen` state
   - Render `<PostLaunchWalkthrough>` alongside `<CampaignSuccess>` in both desktop + mobile branches
   - Pass campaign objective (resolved from `workspace.campaign_templates` / `final_answers.optimizationEvent`) and offer price/template slug into the walkthrough
6. **No edge function changes.** Goal save uses the existing `campaign_goals` table + RLS policies that already work for `GoalSetupModal`.

### Reused infrastructure

- `lumi-kpi-config.ts` — for KPI labels, friendly names, and benchmark ranges shown in step 2
- `campaign_goals` table + existing upsert pattern from `GoalSetupModal`
- `framer-motion` (already in the project, used on Welcome and FreeTrial pages)
- Existing learning-phase rule from project knowledge: "Avoid decisions before 3 days or 1000 impressions" — quoted verbatim in step 5

### Files touched

- `supabase/migrations/<timestamp>_add_first_campaign_launched_at.sql` (new)
- `src/lib/goal-suggestions.ts` (new)
- `src/components/PostLaunchWalkthrough.tsx` (new)
- `src/components/CampaignSuccess.tsx` (edit — celebration + auto-trigger)
- `src/components/insights/GoalSetupModal.tsx` (edit — import from shared helper)
- `src/pages/CampaignBuilder.tsx` (edit — wire walkthrough state)

