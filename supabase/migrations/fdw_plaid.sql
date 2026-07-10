-- fdw_plaid.sql — Plaid bank-feed integration (raw daily cash, kept SEPARATE
-- from QBO accounting truth). Run after fdw_data_warehouse.sql.
--
-- Access tokens are SECRETS: fdw_plaid_item has RLS enabled with NO anon policy,
-- so only the service role can read it. fdw_bank_feed_txn (raw bank txns) already
-- exists from the base schema; we extend it with account fields + a category.

create table if not exists fdw_plaid_item (
  item_id       text primary key,
  access_token  text not null,          -- SECRET — service role only
  institution   text,
  accounts      jsonb default '[]',     -- [{account_id, name, mask, type, subtype}]
  sync_cursor   text,                   -- transactions/sync incremental cursor
  last_sync_at  timestamptz,
  created_at    timestamptz not null default now()
);
alter table fdw_plaid_item enable row level security;
-- intentionally NO anon policy: holds access tokens, service key only.

alter table fdw_bank_feed_txn add column if not exists account_id   text;
alter table fdw_bank_feed_txn add column if not exists account_name text;
alter table fdw_bank_feed_txn add column if not exists category     text;
alter table fdw_bank_feed_txn add column if not exists institution  text;
