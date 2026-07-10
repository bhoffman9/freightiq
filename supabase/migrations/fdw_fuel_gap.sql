-- fdw_fuel_gap.sql — close the opening fuel gap so FUEL_TOT can be derived from
-- the fuel-txn sum (making biweekly EFS statements flow through automatically).
--
-- The opening backfill only carried per-DRIVER fuel; unmapped office/warehouse
-- EFS cards ($10,849.93 / 2,321.80 gal) were in FUEL_TOT but had no txn rows.
-- This adds one 'unmapped' fuel row so sum(fuel_txns) == FUEL_TOT (603,068.29).
--
-- After this + the fdw-metrics change, fleet fuel = fdw_fleet_fuel(Jan1..today).
-- CAVEAT: the opening baseline covers fuel through ~Jul 5. Only ingest EFS
-- statements for periods AFTER that (biweekly statements go forward, so this
-- holds); a statement for a period <= Jul 5 would double-count the baseline.
-- Idempotent.
begin;
delete from fdw_fuel_txn where statement_id = 'OPENING-2026-07-05' and card_no = 'unmapped';
insert into fdw_fuel_txn(statement_id, card_no, driver_id, txn_date, kind, gallons, amount, raw_desc)
values('OPENING-2026-07-05', 'unmapped', null, '2026-07-05', 'fuel', 2321.80, 10849.93,
       'opening unmapped EFS cards (warehouse/office) — reconciles FUEL_TOT');
commit;
-- verify (expect 603068.29 / 111256.42):
-- select round(sum(amount),2) fuel, round(sum(gallons),2) gal from fdw_fuel_txn where kind='fuel';
