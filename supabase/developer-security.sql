create or replace function public.wipe_developer_transaction_data(p_employee_id text, p_confirmation text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  table_name text;
  table_names text[] := array[
    'sales',
    'drawer_logs',
    'route_settlements',
    'payroll',
    'cooler_transactions',
    'maintenance_logs',
    'inventory_logs',
    'inbox_entries'
  ];
begin
  if p_confirmation <> 'DELETE' then
    return false;
  end if;

  if not exists (
    select 1
    from public.employees e
    where e.id::text = p_employee_id
      and e."isActive" = true
      and e.role = 'ผู้พัฒนาโปรแกรม'
  ) then
    return false;
  end if;

  foreach table_name in array table_names
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('delete from public.%I', table_name);
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.wipe_developer_transaction_data(text, text) from public;
grant execute on function public.wipe_developer_transaction_data(text, text) to authenticated;
