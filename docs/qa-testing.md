# LUMI QA & Testing Methodology

A repeatable way to prove a change works before a user finds out it doesn't.
Four layers, cheapest first.

---

## Layer 1 — Type + unit checks

```
tsgo                 # TypeScript, whole project
bunx vitest run      # unit tests in src/**/*.test.ts
```

Catches: broken imports, bad props, pure-logic regressions (budget math, KPI
status rules, copy signatures).
Does not catch: anything that only shows up in a browser.

---

## Layer 2 — Edge function smoke suite

`supabase/functions/qa-harness/smoke_test.ts`

Contract checks against the deployed functions on the critical publish path
(`build-meta-campaign`, `qa-preflight-check`, `compose-ad`, `qa-harness`):

- unauthenticated calls are rejected
- invalid tokens are rejected
- CORS preflight answers with the right headers
- malformed bodies never produce a 5xx (a 5xx reaches the user as the opaque
  "Edge Function returned a non-2xx status code" toast)

These never create or spend anything.

---

## Layer 3 — Browser end-to-end runs

Playwright scripts in `tests/e2e/`. They drive the real app on
`http://localhost:8080` and assert on **observed UI state**, which is the only
layer that catches "I click the button and nothing happens".

| Script | Covers |
| --- | --- |
| `onboarding_flow.py` | Anonymous visitor → website capture → extraction → generated ad, never touching `/auth` |
| `publish_flow.py` | Seeded fixture → campaign builder → QA checks → Publish to Meta → terminal state |
| `cleanup.py` | Removes the fixture and every `[QA]` campaign from the ad account |

Run:

```
python3 tests/e2e/onboarding_flow.py
python3 tests/e2e/publish_flow.py
python3 tests/e2e/cleanup.py
```

Screenshots land in `tests/e2e/screenshots/`.

`publish_flow.py` needs an admin session. It reads the Supabase session that
Lovable injects into the sandbox — if it prints "No session injected", sign in
to the Lovable preview and re-run.

---

## Layer 4 — Real Meta account, zero spend

The highest-value check: publish a real campaign to your own ad account and
look at it in Ads Manager.

### How it stays safe

`build-meta-campaign` accepts a `qaTestMode: true` flag. It is **admin-only**,
and when set:

- the campaign is created **PAUSED**, regardless of the launch choice
- the campaign name gets a **`[QA] `** prefix

So a QA run produces a real campaign — real objective, budget, ad sets,
placements, creative, pixel — that cannot deliver an impression or spend a cent.

### The fixture

`qa-harness` (admin-only edge function) manages a deterministic test brand.

| Action | Effect |
| --- | --- |
| `seed` | Creates/resets the `LUMI QA` brand, a `QA Workshop` offer, and a publish-ready workspace. Meta credentials (ad account, page, IG, pixel) are copied from your first connected real brand, so it points at your real ad account. |
| `status` | Reports the fixture state and any Meta campaign IDs it produced. |
| `cleanup` | Deletes every `[QA]`-prefixed campaign on the ad account, then drops the fixture workspaces, offer and brand. |

Seeded copy is fixed and pre-approved (a matching `approved_copy_signature`), so
runs are reproducible and the preflight copy gate does not block them.

### What to verify by hand in Ads Manager

After `publish_flow.py` reports success, open your ad account and confirm on the
`[QA]` campaign:

1. Status is **Paused** (if it is anything else, stop and file a bug)
2. Objective matches the workspace objective
3. Budget is the daily amount from the fixture ($5), not a lifetime budget
4. Audience is Broad, targeting the expected country
5. Placements are Advantage+
6. Each ad has the right image/video, headline, primary text and CTA
7. The pixel and conversion event are attached to the ad set

Then run `cleanup.py`.

---

## When each layer runs

- **Every change**: Layer 1.
- **Any edge function change**: Layers 1–2.
- **Anything touching campaigns, publish, QA checks, creative or onboarding**:
  Layers 1–3 automatically, before reporting the work as done.
- **Before a release, or after a publish-path bug fix**: all four, ending with a
  manual Ads Manager review.

---

## Adding a test

Copy an existing script in `tests/e2e/`. The shared helpers in `lumi_e2e.py`
handle session restore (`restore_session`), edge function calls
(`call_function`), and console capture (`collect_console`). Use the `check()`
pattern so every run prints a readable PASS/FAIL list and exits non-zero on
failure.

Prefer role-based selectors (`get_by_role("button", name="...")`) over CSS —
they break loudly when a label changes instead of silently passing.
