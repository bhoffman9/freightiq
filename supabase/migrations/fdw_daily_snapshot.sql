-- Unified point-in-time metrics log. ONE row per day captures every headline
-- number that matters "as of" a date, so we can always answer "what was X on
-- date D". Scalar columns drive the trend charts; `payload` holds full detail
-- (aging buckets, by-status, by-vendor, per-account cash) without needing a
-- migration each time we add a metric.
--
-- AP is reconstructable from invoices+payments, so /api/daily-snapshot?backfill=1
-- seeds AP (and cash where bank history exists) retroactively. AR/pipeline/cash
-- accumulate forward from the first cron run (Alvys/Plaid have no dated history).
--
-- Run once in the Supabase SQL editor, then hit /api/daily-snapshot?backfill=1
-- (Authorization: Bearer CRON_SECRET) to seed AP history.
create table if not exists fdw_daily_snapshot (
  snapshot_date   date primary key,
  ap_total        numeric,   -- open A/P (invoices − payments as-of)
  ap_past_due     numeric,
  ar_total        numeric,   -- Alvys delivered/in-transit outstanding
  ar_past_due     numeric,   -- AR aged > 30 days
  pipeline_total  numeric,   -- Alvys booked pipeline across all statuses
  pipeline_loads  integer,
  cash_total      numeric,   -- sum of bank balances (Plaid)
  driver_payroll  numeric,   -- latest weekly fleet+ATL driver loaded cost
  payload         jsonb,     -- full detail: {ap:{aging,byVendor}, ar:{aging,byStatus}, cash:{accounts}, pipeline:{byStatus}}
  sources         jsonb,     -- which feeds succeeded this run {ap:true, ar:false,...}
  created_at      timestamptz not null default now()
);
comment on table fdw_daily_snapshot is 'Unified daily point-in-time metrics log (AP/AR/pipeline/cash/payroll). Scalars for trends, payload for detail.';
