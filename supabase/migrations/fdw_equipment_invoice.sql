-- fdw_equipment_invoice.sql — landing table for parsed equipment-lessor invoices
-- (Penske/Ryder/TCI/TEC/Idealease trucks; McKinney/Utility/Xtra/Premier/Ten
-- trailers). Fed by fdw-extract's AI invoice parser. One row per source file,
-- deduped on raw_ref. anon-read (dashboard is app-password gated).
create table if not exists fdw_equipment_invoice (
  id uuid primary key default gen_random_uuid(),
  source text not null,                 -- truck_penske, trailer_mckinney, ...
  category text,                        -- 'truck' | 'trailer'
  vendor text,                          -- normalized vendor name from the doc
  invoice_no text,
  invoice_date date,
  due_date date,
  unit_ids text,                        -- comma-joined unit/VIN list on the invoice
  amount numeric,                       -- invoice total (USD)
  service_period_start date,
  service_period_end date,
  confidence text,                      -- ai self-report: high|medium|low
  raw_ref text unique,                  -- storage path — dedup key
  run_id uuid,
  extracted jsonb,                      -- full ai payload for audit
  created_at timestamptz default now()
);
create index if not exists fdw_equip_inv_source_idx on fdw_equipment_invoice(source);
create index if not exists fdw_equip_inv_date_idx on fdw_equipment_invoice(invoice_date);
alter table fdw_equipment_invoice enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='fdw_equipment_invoice' and policyname='anon_read_equip') then
    create policy anon_read_equip on fdw_equipment_invoice for select using (true);
  end if;
end $$;
