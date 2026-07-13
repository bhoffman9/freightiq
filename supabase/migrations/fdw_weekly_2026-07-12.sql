-- fdw_weekly_2026-07-12.sql — weekly drop, week ending Jul 12 2026.
-- Fleet scalars + period advance + fuel true-up. (Per-driver snapshot, income,
-- rosters, contractors generated separately.) Idempotent.
begin;

-- advance current period to Jul 12
update fdw_period set is_current = false where is_current = true;
insert into fdw_period(period_end, period_start, is_current)
  values('2026-07-12','2026-01-01', true)
  on conflict(period_end) do update set is_current = true;

-- fleet metrics (SF). LABOR/hours from Jul 12 payroll (excl office+OTR); fuel
-- from EFS YTD (excl OTR cards); miles from Samsara IFTA+overlay; categories from
-- QBO YTD. STORAGE HELD at 56,935.40 — QBO returned $0 (parser drop), not real.
insert into fdw_fleet_metrics(entity_id, period_end, labor, fuel_tot, gallons, miles,
  fleet_local, fleet_regional, truck_count, total_hrs, ins_tot, truck_tot, trailer_tot,
  truck_maint, trail_maint, storage, uniforms, ins_week)
values('sf','2026-07-12', 1246986.03, 635569.07, 117198.37, 833239, 154815, 678425,
  30, 39715.65, 163284.16, 507278.59, 223268.07, 7783.45, 7069.94, 57145.68, 10863.06, 6375)
on conflict(entity_id, period_end) do update set labor=excluded.labor, fuel_tot=excluded.fuel_tot,
  gallons=excluded.gallons, miles=excluded.miles, fleet_local=excluded.fleet_local,
  fleet_regional=excluded.fleet_regional, truck_count=excluded.truck_count, total_hrs=excluded.total_hrs,
  ins_tot=excluded.ins_tot, truck_tot=excluded.truck_tot, trailer_tot=excluded.trailer_tot,
  truck_maint=excluded.truck_maint, trail_maint=excluded.trail_maint, storage=excluded.storage,
  uniforms=excluded.uniforms;

-- fuel true-up: fuel is derived from fuel_txns (fuel loop). Opening baseline is
-- ~$603,068 thru Jul 5; add the Jul 6-12 fleet delta so fdw_fleet_fuel = 635,569.07.
-- fdw_fuel_txn.statement_id FKs to fdw_efs_statement, so seed the statement first.
insert into fdw_efs_statement(statement_id, period_start, period_end, total_amount, total_gallons)
  values('WEEK-2026-07-12','2026-07-06','2026-07-12', 32500.78, 5941.95)
  on conflict(statement_id) do update set total_amount=excluded.total_amount, total_gallons=excluded.total_gallons;
delete from fdw_fuel_txn where statement_id = 'WEEK-2026-07-12';
insert into fdw_fuel_txn(statement_id, card_no, driver_id, txn_date, kind, gallons, amount, raw_desc)
  values('WEEK-2026-07-12','week', null, '2026-07-12','fuel', 5941.95, 32500.78,
         'week ending Jul 12 fleet fuel delta: EFS 633,085.31 + Mudflap 2,483.76 = 635,569.07 - prior 603,068.29');

commit;
-- verify: select round(fuel::numeric,2) from fdw_fleet_fuel('2026-01-01', date '2026-07-13');  -- expect 635569.07
