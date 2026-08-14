-- fdw_bank_morning — one PINNED 7:00 AM America/Los_Angeles bank snapshot per day.
--
-- Why this exists and why fdw_cash_snapshot could not be used as-is:
-- plaid-sync runs 3x daily and UPSERTS fdw_cash_snapshot on snapshot_date, so
-- that row always ends up holding the LAST sync of the day (21:00 UTC = 2 PM
-- PDT). There was no way to read "the balance at 7 AM" out of it — the morning
-- value was overwritten by lunchtime. This table is written once per day, only
-- by the run that lands at local hour 7, and is never overwritten by later syncs.
--
-- money_in / money_out EXCLUDE internal transfers between Ben's own nine
-- accounts. On 2026-08-13 alone there were $96K of book transfers (3028 -> 0703
-- x2, 3028 -> 4842, 1927 -> 0703 x2); counting those gross would have inflated
-- both sides by ~$96K and made the report useless.
--
-- Plaid sign convention (verified against real rows 2026-08-14):
--   amount > 0 = money OUT   e.g. "Penske Truck Rental" +35,791.03
--   amount < 0 = money IN    e.g. "REAL TIME PAYMENT CREDIT RECD" -19,514.38
-- money_in / money_out below are stored as POSITIVE magnitudes.

create table if not exists fdw_bank_morning (
  snapshot_date       date primary key,
  captured_at         timestamptz not null default now(),
  local_hour          int,                  -- America/Los_Angeles hour at capture (should be 7)
  total               numeric(14,2),        -- sum of the nine real accounts
  prev_total          numeric(14,2),        -- previous morning's total
  delta               numeric(14,2),        -- total - prev_total
  money_in            numeric(14,2),        -- external credits since the previous morning (positive)
  money_out           numeric(14,2),        -- external debits since the previous morning (positive)
  internal_transfers  numeric(14,2),        -- book transfers excluded from in/out (positive)
  txn_count           int,
  pending_count       int,
  balance_age_min     int,                  -- age of the underlying plaid-sync balances
  accounts            jsonb,                -- [{last4,label,balance,prev,delta}]
  flows               jsonb,                -- {byAccount:[...], topIn:[...], topOut:[...]}
  created_at          timestamptz not null default now()
);

comment on table fdw_bank_morning is
  'Pinned 07:00 America/Los_Angeles bank balance snapshot. One row per day, never overwritten by later plaid-syncs. in/out exclude internal transfers between own accounts.';

create index if not exists fdw_bank_morning_date_idx on fdw_bank_morning (snapshot_date desc);
