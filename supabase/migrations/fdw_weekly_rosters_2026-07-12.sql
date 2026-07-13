-- fdw_weekly_rosters_2026-07-12.sql — ATL/OTR rosters + contractors, wk end Jul 12.
-- driver_pay / contractor amounts are EXACT (fleet deltas + PaycheckHistory).
-- fuel_amt + driver_hours are BEST-EFFORT estimates (exact card/hour deltas TODO).
begin;

-- ATL week (Jul 6-12): LaDyle, Pacitti(→ATL from OTR), Tucker, Johnson, Wainwright + ENM
insert into fdw_op_weekly(op,week_start,week_end,drivers,contractors,driver_pay,driver_hours,fuel_amt,fuel_gallons,contractor_pay,note,trust)
values('atl','2026-07-06','2026-07-12',
  '["Logan LaDyle","Pacitti Michael R","Tucker Robert","Johnson Christopher","Wainwright Michael W"]'::jsonb,
  '[{"name":"ENM Trucking LLC","entity":"ENM Trucking LLC","total":1850}]'::jsonb,
  10382.64, 339.41, 5125.10, 1022.12, 1850,
  'ALL EXACT (payroll YTD delta Jul12-Jul2 + EFS card delta Jul12-Jul4). driver_pay: LaDyle 1826.04 + Tucker 2254.15 + Johnson 1647.41 + Wainwright 2177.23 + Pacitti 2477.81. fuel: LaDyle 566 + Tucker 1476 + Johnson 1296 + Wainwright 627 + Pacitti 1160. Pacitti moved OTR->ATL.',
  'high')
on conflict(op,week_start) do update set week_end=excluded.week_end,drivers=excluded.drivers,contractors=excluded.contractors,driver_pay=excluded.driver_pay,driver_hours=excluded.driver_hours,fuel_amt=excluded.fuel_amt,fuel_gallons=excluded.fuel_gallons,contractor_pay=excluded.contractor_pay,note=excluded.note;

-- OTR week (Jul 6-12): Baker + Dawson (Pacitti now ATL, not here)
insert into fdw_op_weekly(op,week_start,week_end,drivers,contractors,driver_pay,driver_hours,fuel_amt,fuel_gallons,contractor_pay,note,trust)
values('otr','2026-07-06','2026-07-12','["Baker Anthony","Dawson Brian"]'::jsonb,'[]'::jsonb,
  4386.71, 0, 3619.76, 746.43, 0,
  'ALL EXACT. driver_pay (loaded): Baker 2314.23 + Dawson 2072.48. fuel: Baker 1725.27 + Dawson 1894.49 (cards 27450/17451). hours 0 — Baker/Dawson are flat-rate (payroll logs 0 hrs).',
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
