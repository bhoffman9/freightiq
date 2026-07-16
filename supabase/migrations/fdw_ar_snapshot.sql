-- Daily A/R snapshot so "AR as of <date>" works going forward. The Alvys load
-- API has no payment dates, so historical AR can't be reconstructed — we snapshot
-- the live AR each morning instead. One row per calendar date (upsert).
CREATE TABLE IF NOT EXISTS fdw_ar_snapshot (
  snapshot_date date PRIMARY KEY,
  total_ar    numeric,
  load_count  int,
  ce_ar       numeric,
  sf_ar       numeric,
  aging       jsonb,
  by_status   jsonb,
  by_customer jsonb,
  rows        jsonb,
  created_at  timestamptz DEFAULT now()
);
