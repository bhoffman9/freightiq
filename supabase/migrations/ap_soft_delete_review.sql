-- Soft-delete + review-queue support for AP invoices (already applied via dbrun).
-- deleted_at: non-null => in Trash (recoverable). needs_review: auto-ingested
-- anomaly held out of the payable list until approved. Both filtered by the API.
alter table invoices add column if not exists deleted_at timestamptz;
create index if not exists idx_invoices_deleted on invoices(deleted_at);

alter table invoices add column if not exists needs_review boolean not null default false;
create index if not exists idx_invoices_review on invoices(needs_review) where needs_review;
