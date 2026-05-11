## What's actually wrong

Molly's retrospective for **"New York City Half Day Workshop May 12"** says "Insufficient data — Spend $0.00, 0 results." But the underlying Meta campaign is fine:

- Workspace: `3eaed5c7-9400-48a9-9cb8-0d4cde70d725`
- Stored Meta campaign id: `120245294056280264` ✅ correct one
- Live Meta data for that exact campaign id: **$469 spend, 97,628 impressions, 4,217 clicks, 3,423 landing-page views** (Apr 3 → May 11)
- Token is currently valid (expires 2026‑06‑28)
- Retro row was written on **2026‑05‑01** with `total_spend: 0, total_results: 0, duration_days: 21, data_quality: "insufficient"`

I re-queried Meta with several time ranges, including the one her retro implies (Apr 11 → May 1 = 21 days) — Meta returns $249 spend / 53k impressions / 2,411 clicks. So Meta is not the problem now, and almost certainly wasn't the problem then either; the May‑1 generation either hit a transient Meta error or used a stale/empty token, and `generate-campaign-retrospective` happily persisted the empty result as a finished "insufficient data" retrospective.

## Step 1 — Unblock Molly right now (no code)

She just needs the retrospective regenerated against current Meta data. Two equivalent options:

1. From `/retrospectives`, click **Open** on the campaign card → in the retrospective view, click **Regenerate** (the existing button on `CampaignRetrospective` / `RetrospectiveSetupDialog`).
2. Or delete the bad retrospective JSON for that workspace and click **Create retrospective** again from the tray.

Either path will rerun the edge function with a live token and write a proper retro (~$469 spend, 4,217 clicks, real CPC vs the $0.50 goal — which she clearly beat: actual CPC ≈ $0.11).

I can do option 2 server-side immediately if you want — one update on `campaign_workspaces.retrospective_json = null` for that workspace id, then she clicks Create.

## Step 2 — Prevent this from happening to anyone else (small code change)

In `supabase/functions/generate-campaign-retrospective/index.ts`, the function currently writes a retrospective even when `fetchCampaignPerformance` returns `null` or returns totals with `spend === 0`. That's how a transient Meta hiccup turns into a permanent "Insufficient data" card.

Proposed guard (server-only, ~15 lines):

1. If `performance === null` (Meta fetch threw or returned non-OK), return a 200 + `{ error: "Couldn't reach Meta to pull this campaign's results. Please try again." }` and **do not** persist anything.
2. If `performance.totals.spend === 0` AND the requested window is non-trivial (≥ 3 days), do a **fallback probe** with `date_preset=maximum` for the same campaign id. If lifetime spend > 0 but the windowed call returned 0, treat it as a Meta delivery glitch and return the same retryable error instead of saving an empty retro. If lifetime is also 0, then the campaign genuinely never spent — write the "insufficient" retro as today.
3. Add a `console.warn('[retrospective] refused to persist empty retro for campaign X (lifetime spend=$Y)')` so we can see this in logs.

This keeps the existing "honest insufficient data" behavior for campaigns that truly never spent, while killing the silent-failure mode that bit Molly.

## Out of scope

- No UI changes. The existing **Regenerate** button is enough; we're just making sure regeneration can't write garbage.
- No schema changes, no new env vars.
- No changes to `list-campaigns-for-retrospective` or `send-retrospective-email`.

## Verification after Step 2

- Manually invoke `generate-campaign-retrospective` for Molly's workspace — confirm it writes a real retro with ~$469 spend and a "goal hit" verdict on CPC.
- Force a failure (bad token) and confirm the function now returns the retryable error instead of persisting zeros.
