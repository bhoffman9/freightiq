-- fdw_weekly_rosters_2026-07-12.sql — ATL/OTR rosters + contractors, wk end Jul 12.
-- driver_pay / contractor amounts are EXACT (fleet deltas + PaycheckHistory).
-- fuel_amt + driver_hours are BEST-EFFORT estimates (exact card/hour deltas TODO).
begin;

-- ATL week (Jul 6-12): LaDyle, Pacitti(→ATL from OTR), Tucker, Johnson, Wainwright + ENM
insert into fdw_op_weekly(op,week_start,week_end,drivers,contractors,driver_pay,driver_hours,fuel_amt,fuel_gallons,contractor_pay,note,trust)
values('atl','2026-07-06','2026-07-12',
  '["Logan LaDyle","Pacitti Michael R","Tucker Robert","Johnson Christopher","Wainwright Michael W"]'::jsonb,
  '[{"name":"ENM Trucking LLC","entity":"ENM Trucking LLC","total":1850}]'::jsonb,
  10377.08, 304, 3000, 0, 1850,
  'driver_pay EXACT: LaDyle 1826.04 + Tucker 2254.15 + Johnson 1647.41 + Wainwright 2177.23 + Pacitti 2472.25 (loaded, from PaycheckHistory Jul 10 gross 2227.25 x1.11). Pacitti moved OTR->ATL. fuel_amt + hours ESTIMATED — replace with exact card/hour deltas.',
  'high')
on conflict(op,week_start) do update set week_end=excluded.week_end,drivers=excluded.drivers,contractors=excluded.contractors,driver_pay=excluded.driver_pay,driver_hours=excluded.driver_hours,fuel_amt=excluded.fuel_amt,fuel_gallons=excluded.fuel_gallons,contractor_pay=excluded.contractor_pay,note=excluded.note;

-- OTR week (Jul 6-12): Baker + Dawson (Pacitti now ATL, not here)
insert into fdw_op_weekly(op,week_start,week_end,drivers,contractors,driver_pay,driver_hours,fuel_amt,fuel_gallons,contractor_pay,note,trust)
values('otr','2026-07-06','2026-07-12','["Baker Anthony","Dawson Brian"]'::jsonb,'[]'::jsonb,
  4376.84, 80, 2500, 0, 0,
  'driver_pay EXACT (loaded): Baker 2309.02 (gross 2080.20 x1.11) + Dawson 2067.82 (gross 1862.90 x1.11). fuel_amt ESTIMATED (cards 27450/17451) — replace with exact.',
  'high')
on conflict(op,week_start) do update set week_end=excluded.week_end,drivers=excluded.drivers,contractors=excluded.contractors,driver_pay=excluded.driver_pay,driver_hours=excluded.driver_hours,fuel_amt=excluded.fuel_amt,fuel_gallons=excluded.fuel_gallons,contractor_pay=excluded.contractor_pay,note=excluded.note;

-- Contractor snapshot (period_end 2026-07-12): weekly = this week's cash, total = prior + weekly.
-- (car/health all-in components carried from prior — recompute via build_paycheck_grid if needed.)
insert into fdw_contractor_snapshot(name,period_end,role,weekly,total,active,trust) values
 ('Jon Marcus Zengotita','2026-07-12','contractor',2800,77700,true,'high'),
 ('Mellody Abrego','2026-07-12','contractor',2250,76354.07,true,'high'),
 ('Gabriel Colon','2026-07-12','contractor',2348.29,57844.17,true,'high'),
 ('Hilda Salman','2026-07-12','contractor',1730,49799.32,true,'high'),
 ('Maria Con','2026-07-12','contractor',650,15900,true,'high'),
 ('Logic Consultants','2026-07-12','contractor',500,13000,true,'high'),
 ('ENM Trucking','2026-07-12','contractor',1850,16650,true,'high'),
 ('Elizabeth Delgado','2026-07-12','contractor',900,21729.61,true,'high'),
 ('Christopher Simpson','2026-07-12','contractor',834.97,21074.29,true,'high'),
 ('Debra Adamson','2026-07-12','contractor',1750,29348.24,true,'high'),
 ('Erika Valencio','2026-07-12','contractor',1730,1730,true,'high'),
 ('Kevin Deveraux','2026-07-12','agent',500,3000,true,'high')
on conflict(name,period_end) do update set role=excluded.role,weekly=excluded.weekly,total=excluded.total,active=excluded.active;

commit;
