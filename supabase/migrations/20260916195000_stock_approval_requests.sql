create table if not exists public.stock_approval_requests (
  id text primary key,
  product_id text not null,
  product_name text not null,
  product_category text,
  quantity numeric not null check (quantity > 0),
  action text not null check (action in ('IN', 'OUT')),
  reason text not null,
  requested_by text not null,
  requested_by_role text,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  note text
);

create index if not exists stock_approval_requests_pending_idx
  on public.stock_approval_requests (status, requested_at desc);

create or replace function public.approve_stock_request(
  p_request_id text,
  p_reviewer text
)
returns public.stock_approval_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.stock_approval_requests;
  product_row public.products;
  next_stock numeric;
begin
  select *
    into request_row
    from public.stock_approval_requests
   where id = p_request_id
     and status = 'pending'
   for update;

  if not found then
    raise exception 'STOCK_APPROVAL_ALREADY_PROCESSED';
  end if;

  select *
    into product_row
    from public.products
   where id = request_row.product_id
   for update;

  if not found then
    raise exception 'STOCK_PRODUCT_NOT_FOUND';
  end if;

  next_stock := case
    when request_row.action = 'OUT' then coalesce(product_row.stock, 0) - request_row.quantity
    else coalesce(product_row.stock, 0) + request_row.quantity
  end;

  if next_stock < 0 then
    raise exception 'STOCK_BALANCE_NEGATIVE';
  end if;

  update public.products
     set stock = next_stock
   where id = request_row.product_id;

  insert into public.inventory_logs (
    id, date, product_id, product_name, type, qty, note, by
  ) values (
    'LOG-' || gen_random_uuid()::text,
    now(),
    request_row.product_id,
    request_row.product_name,
    request_row.action,
    request_row.quantity,
    'อนุมัติจากระบบ: ' || request_row.reason || ' (' || p_reviewer || ')',
    p_reviewer
  );

  update public.stock_approval_requests
     set status = 'approved',
         reviewed_by = p_reviewer,
         reviewed_at = now(),
         note = 'อนุมัติแล้ว'
   where id = request_row.id;

  select *
    into request_row
    from public.stock_approval_requests
   where id = request_row.id;

  return request_row;
end;
$$;
