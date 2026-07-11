-- fdw_income_wire.sql — extra columns + YTD-totals table so the Income tab can
-- reconstruct INCOME_2026 fully from the warehouse (weekly chart needs label +
-- carrier; top-level KPIs need YTD totals from QBO). Run after fdw_data_warehouse.sql.

alter table fdw_income_week add column if not exists label   text;
alter table fdw_income_week add column if not exists carrier numeric(14,2);

-- YTD income totals (one row per period_end), populated by fdw-qbo-sync from the
-- QBO P&L fiq object. Feeds INCOME_2026 top-level KPIs.
create table if not exists fdw_income_totals (
  period_end    date primary key references fdw_period(period_end),
  ce numeric(14,2), sf numeric(14,2), di numeric(14,2), ce_east numeric(14,2),
  revenue numeric(14,2), cogs numeric(14,2), gross_profit numeric(14,2),
  total_exp numeric(14,2), net_op_income numeric(14,2), net_income numeric(14,2),
  carrier_pay numeric(14,2), merchant_fees numeric(14,2), flexent_fees numeric(14,2),
  run_id uuid
);
alter table fdw_income_totals enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
                 and tablename='fdw_income_totals' and policyname='anon_read')
  then create policy anon_read on fdw_income_totals for select using (true); end if;
end $$;
