# Cleanup & Streamlining Plan

I verified your audit against the live project. Almost all of it holds up, with three corrections worth knowing before we start.

## What I confirmed

- All 28 flagged frontend components have zero references outside their own file — safe to delete.
- The 12 shadcn primitives (breadcrumb, carousel, chart, command, context-menu, drawer, form, input-otp, menubar, navigation-menu, pagination, resizable) are imported nowhere.
- `/onboarding-legacy` exists at `src/App.tsx:183` with no link to it anywhere in the app.
- Three active cron jobs all hit `send-weekly-reports`: daily 12:00, daily 08:00, Mondays 09:00. Confirmed real bug — reports fire 8x/week.
- `src/App.tsx` has 112 routes, all eagerly imported, zero `lazy()` usage.
- `src/lib/mcp/tools/` (2 files) has no importer anywhere in `src/` or `supabase/` — dead.
- `@hookform/resolvers` is in package.json and `zodResolver` appears nowhere in `src/`.

## Three corrections

1. **`components/ui/use-toast.ts` is NOT unused.** `CopyEditor.tsx` and `SmartCropSuggestions.tsx` import `toast` from it. We repoint those two to `@/hooks/use-toast`, then delete the shim.
2. **`founders.jpg` and `lib/upload-limits.ts` don't exist** in the project. The "founders" text hits in Sales/Settings are unrelated marketing copy. Nothing to delete.
3. **Edge function log retention is under a day**, so logs can't prove the 3 externally-triggered functions are unused. We keep `approve-from-email`, `build-template`, `validate-template` for now. Separately: `approve-from-email` looks corrupted — its internal URLs point at `/functions/v1/n` instead of its own name, so it would fail if an email link ever hit it. Worth a follow-up, not part of this cleanup.

Also: `process-template-requests` (the live cron, running every minute) does its template generation inline — it does not call `build-template`/`generate-template`/`validate-template`. So `generate-template` is safely deletable; the other two stay only out of caution.

## Execution order

### Phase 1 — Fix the cron bug (backend)
Drop `lumi-send-weekly-reports` (jobid 11) and `send-performance-reports` (jobid 46) via migration. Keep `send-weekly-reports-monday` (jobid 45).

### Phase 2 — Delete dead frontend (zero risk)
- 28 orphaned components (incl. `AdCopyLibrary.tsx`, the 3 legacy Production files, 4 unwired Mobile components).
- 12 unused shadcn primitives.
- `src/lib/mcp/` (both tool files).
- Migrate the 2 `use-toast` importers, then delete `components/ui/use-toast.ts`.
- Remove `@hookform/resolvers`.
- Typecheck after each group.

### Phase 3 — Remove legacy onboarding
Delete `src/pages/Onboarding.tsx` (891 lines), its import and `/onboarding-legacy` route in `App.tsx`.

### Phase 4 — Retire 10 dead edge functions
`generate-template`, `check-generation-readiness`, `expand-creative`, `generate-manager-report`, `generate-weekly-report`, `scrape-instagram-profile`, `send-bug-to-lovable`, `slack-lumi-chat`, `slack-notify`, `suggest-next-action` — delete the function and its `supabase/config.toml` block.

Note: `expand-creative` and `slack-*` were hardened in a past security pass; deleting them is still correct if nothing calls them, and I'll re-grep each one immediately before removal.

### Phase 5 — Lazy-load routes
Convert all `/admin/*` pages plus the heaviest authenticated pages (`CreativeStudio`, `Create`, `Data`, `ProductionManager` host pages) to `React.lazy()` with a shared `<Suspense>` fallback matching the current loading style. Public marketing routes (`/`, `/auth`, `/onboarding`) stay eager so first paint doesn't regress.

### Phase 6 — Consolidate KPI configs
`lib/campaign-kpi-config.ts` has exactly one consumer: `components/insights/CampaignInsightDetail.tsx`. Move what it needs into `lib/lumi-kpi-config.ts` and delete the old file.

### Not in this plan
Ad-preview consolidation across the 5 live files and the large-file refactors (GuidedOnboarding 3.1k lines, GenerateCreativeDialog 2.3k, etc.) are behavior-touching refactors of code users hit daily. I'd rather do those as separate, individually-testable passes after this cleanup lands.

## Verification

Typecheck after every phase, plus a browser pass over `/`, `/onboarding`, `/create`, `/data`, `/creative-studio` and one `/admin` route to confirm lazy loading and no missing imports.
