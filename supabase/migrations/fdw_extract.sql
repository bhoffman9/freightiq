-- ============================================================================
-- FDW EXTRACT — staging processing state
-- Adds the columns the extraction worker (api/fdw-extract.js) uses to drive a
-- claim/complete queue over fdw_import_staging. Idempotent: safe to re-run.
--
--   processed     — false until the extractor has handled the row (landed facts
--                   OR quarantined it). The worker selects processed=false.
--   processed_at  — when it was handled (success or quarantine).
--   extract_error — last failure reason. Set on transient failure while LEAVING
--                   processed=false so the next cron run retries the row.
-- ============================================================================

alter table fdw_import_staging add column if not exists processed boolean not null default false;
alter table fdw_import_staging add column if not exists processed_at timestamptz;
alter table fdw_import_staging add column if not exists extract_error text;

-- Partial index so the worker's "next batch of unprocessed" scan stays cheap as
-- the staging table grows (processed rows are kept permanently for audit).
create index if not exists fdw_import_staging_unprocessed_idx
  on fdw_import_staging (created_at)
  where processed = false;
