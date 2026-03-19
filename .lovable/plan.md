## Smart Location Targeting Prompt for Non-Local Campaigns
(Completed — see previous plan for details)

## Fix Weekly Reports and Auto-Optimizations
(Completed)

### What was done

1. **`run-optimization-report` now supports service-role mode** — When called with the service-role key (from cron/schedule-digests), it skips user JWT auth and looks up userId from the brand record. Interactive dashboard calls still use normal user auth.

2. **`schedule-digests` uses service-role key** — Now calls `run-optimization-report` with the service-role key instead of anon key, so real reports are generated in cron context (no more empty stub reports).

3. **Hourly cron job created** — `schedule-digests` is triggered every hour via pg_cron. The function internally handles timezone-aware day/time matching.

4. **`apply-optimizations` edge function created** — After each digest report, schedule-digests calls this function to queue (or auto-apply) optimization recommendations from the report into the `pending_optimizations` table.

5. **`pending_optimizations` table created** — Stores queued recommendations with status (pending/approved/rejected/applied), auto_applied flag, and meta_action payload.

6. **`auto_optimize` preference added to `digest_settings`** — When enabled, high-priority actions are auto-applied. When disabled (default), actions are queued for manual user approval.

7. **Pending optimizations UI added to Data page** — Shows a "Pending Actions" section with Approve/Dismiss buttons for manual actions, and Undo for auto-applied actions. Auto-optimize toggle added to the digest settings dialog.
