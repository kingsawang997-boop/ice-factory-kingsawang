-- Run this in Supabase SQL Editor after setting SUPABASE_SERVICE_ROLE_KEY on the server.
-- The service role bypasses RLS; browser clients must not be able to change approval decisions.

create table if not exists public.inbox_entries (
  id text primary key,
  type text not null,
  title text,
  message text,
  created_at timestamptz not null default now(),
  requested_by text,
  requested_by_id text,
  product_id text,
  product_name text,
  qty integer,
  status text not null default 'pending',
  approved_by text,
  approved_at timestamptz,
  rejected_by text,
  rejected_at timestamptz
);

alter table public.inbox_entries add column if not exists requested_by_id text;
alter table public.inbox_entries add column if not exists type text;
alter table public.inbox_entries add column if not exists title text;
alter table public.inbox_entries add column if not exists message text;
alter table public.inbox_entries add column if not exists created_at timestamptz not null default now();
alter table public.inbox_entries add column if not exists requested_by text;
alter table public.inbox_entries add column if not exists product_id text;
alter table public.inbox_entries add column if not exists product_name text;
alter table public.inbox_entries add column if not exists qty integer;
alter table public.inbox_entries add column if not exists status text not null default 'pending';
alter table public.inbox_entries add column if not exists approved_by text;
alter table public.inbox_entries add column if not exists approved_at timestamptz;
alter table public.inbox_entries add column if not exists rejected_by text;
alter table public.inbox_entries add column if not exists rejected_at timestamptz;

create index if not exists inbox_entries_type_status_idx
  on public.inbox_entries (type, status, created_at desc);

alter table public.inbox_entries enable row level security;

revoke update, delete on table public.inbox_entries from anon, authenticated;
grant select, insert on table public.inbox_entries to anon, authenticated;

drop policy if exists "stock approval requests can be read" on public.inbox_entries;
create policy "stock approval requests can be read"
  on public.inbox_entries for select
  to anon, authenticated
  using (type = 'stock_approval');

drop policy if exists "stock approval requests can be created" on public.inbox_entries;
create policy "stock approval requests can be created"
  on public.inbox_entries for insert
  to anon, authenticated
  with check (type = 'stock_approval');

-- Approval mutations run only through /api/stock-approvals/approve with the service role.
