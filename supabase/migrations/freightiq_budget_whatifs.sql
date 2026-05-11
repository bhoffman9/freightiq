-- FreightIQ Budgeting tab — shared what-if scenarios for the simulator.
-- One-time setup: paste this into the Supabase SQL editor for project
-- bhdaiddrfeqtwjlsfifx and click Run.

create table if not exists public.freightiq_budget_whatifs (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  amount      numeric not null check (amount >= 0),
  frequency   text not null check (frequency in ('weekly','monthly')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists freightiq_budget_whatifs_active_idx
  on public.freightiq_budget_whatifs (active, created_at desc);

-- RLS: match the existing FreightIQ pattern (wide-open access via service key).
-- The serverless API uses SUPABASE_SERVICE_KEY which bypasses RLS, but enabling
-- the policy makes the table behave correctly if the anon key is ever used.
alter table public.freightiq_budget_whatifs enable row level security;

drop policy if exists freightiq_budget_whatifs_all on public.freightiq_budget_whatifs;
create policy freightiq_budget_whatifs_all
  on public.freightiq_budget_whatifs
  for all
  using (true)
  with check (true);
