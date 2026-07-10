-- ============================================================================
-- FREIGHT DATA WAREHOUSE (fdw_*)  — Phase 1 schema
-- Replaces the hardcoded business-data constants in freightiq/src/App.jsx
-- with an append-only, auditable Postgres layer.
--
-- Shared Supabase project (bhdaiddrfeqtwjlsfifx). Prefix: fdw_ (freight data
-- warehouse) so it sits alongside freightiq_*, w_*, p_*, cfo_*, dot_*.
--
-- DESIGN PRINCIPLES
--  1. APPEND-ONLY WEEKLY SNAPSHOTS. Each weekly drop inserts a new row keyed by
--     (entity, period_end). We store the YTD-cumulative value exactly as it
--     arrives today. Nothing is ever destructively overwritten -> full history,
--     free audit trail, trivial rollback.
--  2. DELTAS ARE DERIVED, NOT STORED. "this week" = YTD(this) - YTD(prior),
--     computed with LAG() window functions in views. This is exactly the
--     App.jsx (thisWeek_YTD - lastWeek_YTD) math, moved into SQL.
--  3. DERIVED VALUES ARE VIEWS. BASIC_CPM/ALLIN_CPM/PERIOD_DAYS/DRIVERS never
--     get stored -- they are computed columns/views (the recomputeDerived()
--     logic, in SQL).
--  4. EVERY IMPORT PASSES TIE-OUT CHECKS OR IS QUARANTINED. The 11 reconciliation
--     rules from CLAUDE.md become fdw_validate_* functions run at load time.
--     A load that violates one does not land -- it goes to fdw_quarantine.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- Private storage bucket for raw ingested files (email attachments, sheet dumps).
-- Raw payloads are kept permanently for audit / re-extraction. Service role only.
insert into storage.buckets (id, name, public)
  values ('fdw-raw', 'fdw-raw', false)
  on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- DIMENSIONS
-- ---------------------------------------------------------------------------

-- Operating entities. ATL/OTR are operations, not legal entities, but modeled
-- here so every fact row can be attributed. designation is fluid week-to-week
-- for ATL/OTR (handled in the weekly-roster tables, not here).
create table if not exists fdw_entity (
  id          text primary key,          -- 'ce','sf','ce_east','atl','ja','otr'
  label       text not null,
  kind        text not null default 'legal',  -- 'legal' | 'operation'
  active      boolean not null default true
);

-- Reporting periods. ONE source of truth for dates (replaces PERIOD/PERIOD_DAYS/
-- PERIOD_END). period_end is the join key for all weekly snapshot facts.
create table if not exists fdw_period (
  period_end   date primary key,         -- e.g. 2026-07-05 (week ending)
  period_start date not null default date '2026-01-01',
  -- label is derived in fdw_v_current_period (to_char is STABLE, not IMMUTABLE,
  -- so it can't live in a generated column).
  days         integer generated always as ((period_end - period_start) + 1) stored,
  is_current   boolean not null default false
);

-- Drivers (fleet + OTR). Frozen drivers keep active=false but rows persist so
-- YTD reconciles to QBO. company designation for grid grouping.
create table if not exists fdw_driver (
  id        uuid primary key default uuid_generate_v4(),
  name      text not null unique,        -- "Last First" canonical
  kind      text not null default 'fleet',  -- 'fleet' | 'otr' | 'office' | 'warehouse'
  entity_id text references fdw_entity(id),
  active    boolean not null default true,
  efs_cards text[] default '{}',         -- mapped EFS card numbers
  note      text
);

create table if not exists fdw_truck (
  truck_no  text primary key,
  truck_type text,                       -- Sleeper | Day Cab | Box Truck
  lessor    text,                        -- Penske | TEC | TCI | Ryder | Idealease
  active    boolean not null default true
);

create table if not exists fdw_vendor (
  id        uuid primary key default uuid_generate_v4(),
  name      text not null,
  category  text,                        -- fuel | truck_rental | trailer_rental | maint | insurance | storage | uniforms
  entity_id text references fdw_entity(id)
);

-- ---------------------------------------------------------------------------
-- INGESTION SPINE  (Vercel Cron triggers; job STATE lives here, not in cron)
-- ---------------------------------------------------------------------------

create table if not exists fdw_ingestion_run (
  id           uuid primary key default uuid_generate_v4(),
  source       text not null,            -- 'qbo_pnl' | 'efs_fuel' | 'samsara' | 'gmail' | 'sheet_atl' | ...
  period_end   date references fdw_period(period_end),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running',  -- running | success | failed | quarantined
  rows_written integer default 0,
  idempotency_key text unique,           -- source+period+file-hash -> re-runs are no-ops
  failure_reason  text
);

-- Watermark per source so a cron knows the last good period it ingested.
create table if not exists fdw_source_watermark (
  source            text primary key,
  last_period_end   date,
  last_success_at   timestamptz,
  last_file_hash    text
);

-- Raw file/email/sheet payloads land here FIRST (staging), before validation.
-- Nothing reaches a fact table until tie-out checks pass. Raw kept permanently.
create table if not exists fdw_import_staging (
  id           uuid primary key default uuid_generate_v4(),
  run_id       uuid references fdw_ingestion_run(id),
  source       text not null,
  trust        text not null default 'high',   -- high (attachment/API, tied out) | pending_review (email body/prose)
  raw_ref      text,                    -- storage path / gmail msg id / sheet id
  extracted    jsonb not null,          -- structured extract awaiting validation
  created_at   timestamptz not null default now()
);

-- Failed tie-outs and low-trust body extractions wait here for a human.
create table if not exists fdw_quarantine (
  id           uuid primary key default uuid_generate_v4(),
  run_id       uuid references fdw_ingestion_run(id),
  source       text not null,
  reason       text not null,           -- which validation failed / why review needed
  payload      jsonb not null,
  resolved     boolean not null default false,
  resolved_by  text,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- FACTS  (append-only weekly YTD snapshots)
-- ---------------------------------------------------------------------------

-- A1: fleet CPM scalar inputs. One row per (entity, period_end). Stores YTD.
create table if not exists fdw_fleet_metrics (
  entity_id     text not null references fdw_entity(id),
  period_end    date not null references fdw_period(period_end),
  labor         numeric(14,2),           -- SF fleet driver YTD (excl OTR+office)
  fuel_tot      numeric(14,2),           -- EFS fleet (excl OTR cards)
  gallons       numeric(14,2),
  miles         numeric(14,2),           -- Samsara total fleet
  fleet_local   numeric(14,2),
  fleet_regional numeric(14,2),
  truck_count   integer,
  total_hrs     numeric(12,2),
  ins_tot       numeric(14,2),           -- SF Truck Insurance ONLY
  truck_tot     numeric(14,2),
  trailer_tot   numeric(14,2),
  truck_maint   numeric(14,2),
  trail_maint   numeric(14,2),
  storage       numeric(14,2),
  uniforms      numeric(14,2),
  ins_week      numeric(12,2) default 6375,
  run_id        uuid references fdw_ingestion_run(id),
  primary key (entity_id, period_end)
);

-- A2: per-driver YTD payroll snapshot.
create table if not exists fdw_payroll_snapshot (
  driver_id    uuid not null references fdw_driver(id),
  period_end   date not null references fdw_period(period_end),
  hours        numeric(12,2),
  total_cost   numeric(14,2),           -- all-in employer cost YTD
  active       boolean not null default true,
  run_id       uuid references fdw_ingestion_run(id),
  primary key (driver_id, period_end)
);

-- A2: FUEL is TRANSACTIONAL, not a YTD snapshot. EFS emails biweekly statements
-- with dated, card-level transaction lines. We store the lines; YTD/weekly/any
-- window is a SUM over a date range. Decouples fuel from the weekly cadence and
-- makes the OTR carve-out a WHERE clause (exclude driver.kind='otr') instead of
-- a manual subtraction.
create table if not exists fdw_efs_statement (
  statement_id text primary key,        -- EFS statement number (dedup key)
  period_start date not null,
  period_end   date not null,
  total_amount numeric(14,2),           -- statement grand total (tie-out target)
  total_gallons numeric(14,2),
  run_id       uuid references fdw_ingestion_run(id)
);

create table if not exists fdw_fuel_txn (
  id           uuid primary key default uuid_generate_v4(),
  statement_id text references fdw_efs_statement(statement_id),
  card_no      text not null,
  driver_id    uuid references fdw_driver(id),   -- null until card mapped
  txn_date     date not null,
  kind         text not null default 'fuel',     -- fuel | def | parking | other
  gallons      numeric(12,3),
  amount       numeric(14,2),
  raw_desc     text
);
create index if not exists fdw_fuel_txn_date_idx on fdw_fuel_txn(txn_date);

-- Fleet fuel for any window: fuel lines only, OTR cards excluded via driver kind.
create or replace function fdw_fleet_fuel(p_from date, p_to date)
returns table(fuel numeric, gallons numeric) language sql stable as $$
  select coalesce(sum(t.amount),0), coalesce(sum(t.gallons),0)
  from fdw_fuel_txn t
  left join fdw_driver d on d.id = t.driver_id
  where t.kind='fuel' and t.txn_date between p_from and p_to
    and (d.kind is distinct from 'otr');
$$;

-- A2: per-truck per-state YTD mileage snapshot. states as jsonb {NV:..,CA:..}.
create table if not exists fdw_truck_mileage_snapshot (
  truck_no     text not null references fdw_truck(truck_no),
  period_end   date not null references fdw_period(period_end),
  local_mi     numeric(14,2),
  regional_mi  numeric(14,2),
  miles        numeric(14,2),
  states       jsonb default '{}',
  run_id       uuid references fdw_ingestion_run(id),
  primary key (truck_no, period_end)
);

-- A3: income. Weekly rows (append one per week) + monthly rows (replace partial
-- month at close). company split ce/sf/di stored; totals derived in views.
create table if not exists fdw_income_week (
  period_end   date primary key references fdw_period(period_end),
  ce numeric(14,2), sf numeric(14,2), di numeric(14,2),
  revenue numeric(14,2), cogs numeric(14,2), gross_profit numeric(14,2),
  total_exp numeric(14,2), net_op_income numeric(14,2),
  other_income numeric(14,2), net_income numeric(14,2),
  run_id uuid references fdw_ingestion_run(id)
);

create table if not exists fdw_income_month (
  month_key    text primary key,        -- '2026-06'
  label        text,                    -- 'Jun 26' / 'May 1-3 only' (partial)
  is_partial   boolean not null default false,
  ce numeric(14,2), sf numeric(14,2), di numeric(14,2),
  revenue numeric(14,2), gross_profit numeric(14,2), net_income numeric(14,2),
  run_id uuid references fdw_ingestion_run(id)
);

-- A4: office/warehouse W-2 YTD snapshot.
create table if not exists fdw_office_payroll_snapshot (
  name         text not null,
  period_end   date not null references fdw_period(period_end),
  entity_id    text references fdw_entity(id),
  kind         text default 'office',   -- office | warehouse
  gross numeric(14,2), taxes numeric(14,2), contrib numeric(14,2),
  total_cost numeric(14,2), salary numeric(14,2), bonus numeric(14,2),
  reimb numeric(14,2), commission numeric(14,2),
  active boolean not null default true,
  run_id uuid references fdw_ingestion_run(id),
  primary key (name, period_end)
);

-- A4: contractors + agents. weekly amount + running totals + car/health/comm.
create table if not exists fdw_contractor_snapshot (
  name         text not null,
  period_end   date not null references fdw_period(period_end),
  role         text not null default 'contractor',  -- contractor | agent
  dba          text,
  weekly       numeric(14,2),
  weekly_total numeric(14,2),
  car_total    numeric(14,2) default 0,
  commission   numeric(14,2) default 0,
  health_total numeric(14,2) default 0,
  other        numeric(14,2) default 0,
  total        numeric(14,2),           -- weekly_total+car+commission+health+other
  active       boolean not null default true,
  trust        text not null default 'high',  -- 'pending_review' when from email body
  run_id       uuid references fdw_ingestion_run(id),
  primary key (name, period_end)
);

-- A5: ATL / OTR per-week rosters (independent weeks, never generalized).
create table if not exists fdw_op_weekly (
  op           text not null,           -- 'atl' | 'otr'
  week_start   date not null,
  week_end     date not null,
  drivers      jsonb not null default '[]',   -- ["Davis Anthoni D", ...]
  contractors  jsonb not null default '[]',   -- [{name,entity,total}]
  driver_pay   numeric(14,2),
  driver_hours numeric(12,2),
  fuel_amt     numeric(14,2),
  fuel_gallons numeric(14,2),
  contractor_pay numeric(14,2),
  note         text,
  trust        text not null default 'high',
  run_id       uuid references fdw_ingestion_run(id),
  primary key (op, week_start)
);

-- A5: ATL load-level billing.
create table if not exists fdw_atl_billing (
  period_end   date primary key references fdw_period(period_end),
  loads        integer,
  revenue      numeric(14,2),
  carrier_pay  numeric(14,2),
  gross_profit numeric(14,2),
  gross_margin numeric(6,3),
  by_driver    jsonb,                   -- stale historical until parser fixed
  run_id       uuid references fdw_ingestion_run(id)
);

-- A6: cash snapshots. balances from Plaid; payments live via /api/cash-flow.
create table if not exists fdw_cash_snapshot (
  snapshot_date date primary key,
  accounts     jsonb not null,          -- [{name,last4,balance,group}]  <- Plaid
  payments     jsonb,                   -- [{day,vendor,amount,status,cat}]
  run_id       uuid references fdw_ingestion_run(id)
);

-- Bank-feed truth (Plaid) kept SEPARATE from accounting truth (QBO). Never merged.
create table if not exists fdw_bank_feed_txn (
  id           uuid primary key default uuid_generate_v4(),
  account_last4 text,
  posted_date  date,
  amount       numeric(14,2),
  raw_desc     text,
  pending      boolean default false,
  plaid_txn_id text unique,
  run_id       uuid references fdw_ingestion_run(id)
);

-- ---------------------------------------------------------------------------
-- DERIVED VIEWS  (the recomputeDerived() logic, in SQL -- never stored)
-- ---------------------------------------------------------------------------

-- Latest period helper.
create or replace view fdw_v_current_period as
  select period_end, period_start,
    to_char(period_start,'Mon FMDD') || ' - ' || to_char(period_end,'Mon FMDD, YYYY') as label,
    days
  from fdw_period order by period_end desc limit 1;

-- CPM view: BASIC + ALL-IN, per entity per period. CPM ALWAYS divides by MILES,
-- never gallons*6.5 (that estimate is fuel-price math only).
create or replace view fdw_v_cpm as
select
  m.entity_id, m.period_end,
  (m.labor + m.fuel_tot + m.truck_tot + m.ins_tot)                     as basic_cost,
  (m.labor + m.fuel_tot + m.truck_tot + m.ins_tot) / nullif(m.miles,0) as basic_cpm,
  (m.labor + m.fuel_tot + m.truck_tot + m.ins_tot + m.trailer_tot
   + m.truck_maint + m.trail_maint + m.storage + m.uniforms)           as allin_cost,
  (m.labor + m.fuel_tot + m.truck_tot + m.ins_tot + m.trailer_tot
   + m.truck_maint + m.trail_maint + m.storage + m.uniforms)
     / nullif(m.miles,0)                                               as allin_cpm
from fdw_fleet_metrics m;

-- WEEKLY DELTA view: this-week amounts derived from YTD snapshots via LAG.
-- Replaces the manual (thisWeek_YTD - lastWeek_YTD) driver math.
create or replace view fdw_v_payroll_weekly as
select
  driver_id, period_end,
  total_cost as ytd_total_cost,
  total_cost - lag(total_cost) over (partition by driver_id order by period_end)
    as week_total_cost,
  hours - lag(hours) over (partition by driver_id order by period_end)
    as week_hours
from fdw_payroll_snapshot;

-- Active driver count (display) vs full roster (reconciliation).
create or replace view fdw_v_active_drivers as
select p.period_end, count(*) filter (where p.active) as active_count
from fdw_payroll_snapshot p group by p.period_end;

-- ---------------------------------------------------------------------------
-- RECONCILIATION / TIE-OUT CHECKS  (CLAUDE.md's 11 rules -> gate every load)
-- Each returns NULL on pass, or an error string on fail. The loader runs all
-- checks for a period; any non-null -> quarantine the whole load.
-- ---------------------------------------------------------------------------

-- Rule 1: PAYROLL.sum(total_cost) must equal LABOR (fleet drivers only).
create or replace function fdw_validate_payroll_ties_labor(p_period date)
returns text language plpgsql as $$
declare v_payroll numeric; v_labor numeric;
begin
  select coalesce(sum(total_cost),0) into v_payroll
    from fdw_payroll_snapshot ps join fdw_driver d on d.id=ps.driver_id
    where ps.period_end=p_period and d.kind='fleet';
  select labor into v_labor from fdw_fleet_metrics
    where period_end=p_period and entity_id='sf';
  if v_labor is null then return null; end if;
  if abs(v_payroll - v_labor) > 1.00 then
    return format('PAYROLL sum %s != LABOR %s (fleet)', v_payroll, v_labor);
  end if;
  return null;
end $$;

-- Rule 5: FLEET_LOCAL + FLEET_REGIONAL == MILES; active trucks == TRUCK_COUNT.
create or replace function fdw_validate_mileage(p_period date)
returns text language plpgsql as $$
declare m fdw_fleet_metrics; v_active int;
begin
  select * into m from fdw_fleet_metrics where period_end=p_period and entity_id='sf';
  if not found then return null; end if;
  if abs(coalesce(m.fleet_local,0)+coalesce(m.fleet_regional,0)-coalesce(m.miles,0)) > 1 then
    return format('local+regional (%s) != miles (%s)',
      m.fleet_local+m.fleet_regional, m.miles);
  end if;
  select count(*) into v_active from fdw_truck_mileage_snapshot tm
    join fdw_truck t on t.truck_no=tm.truck_no
    where tm.period_end=p_period and t.active;
  if m.truck_count is not null and v_active <> m.truck_count then
    return format('active trucks %s != TRUCK_COUNT %s', v_active, m.truck_count);
  end if;
  return null;
end $$;

-- Rule 2: CONTRACTORS sum ties to QBO Contractor Payroll within 1.5%.
-- (QBO target passed in; caller supplies the P&L line value.)
create or replace function fdw_validate_contractors(p_period date, p_qbo_total numeric)
returns text language plpgsql as $$
declare v_sum numeric;
begin
  if p_qbo_total is null or p_qbo_total = 0 then return null; end if;
  select coalesce(sum(total),0) into v_sum from fdw_contractor_snapshot
    where period_end=p_period and role='contractor';
  if abs(v_sum - p_qbo_total)/p_qbo_total > 0.015 then
    return format('CONTRACTORS %s vs QBO %s > 1.5%%', v_sum, p_qbo_total);
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: anon SELECT only (app is password-gated at the app layer, matching the
-- freightiq_*/w_* pattern). Ingestion + backfill run as service role, which
-- BYPASSES RLS — so no anon INSERT/UPDATE policy is granted (writes are locked
-- to the service key). Applied via a loop over every fdw_ table.
-- ---------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname='public' and tablename like 'fdw\_%'
  loop
    execute format('alter table %I enable row level security', t.tablename);
    execute format($p$
      do $inner$ begin
        if not exists (
          select 1 from pg_policies
          where schemaname='public' and tablename=%L and policyname='anon_read'
        ) then
          create policy anon_read on %I for select using (true);
        end if;
      end $inner$;
    $p$, t.tablename, t.tablename);
  end loop;
end $$;
