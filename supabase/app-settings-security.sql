create or replace function public.update_app_settings(
  p_employee_id text,
  p_status text,
  p_next_billing_date date,
  p_developer_contact text,
  p_app_logo text,
  p_font_size text,
  p_theme_color text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('active', 'locked') then
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

  insert into public.app_settings (
    id,
    status,
    next_billing_date,
    developer_contact,
    app_logo,
    font_size,
    theme_color
  )
  values (
    'system_config',
    p_status,
    p_next_billing_date,
    p_developer_contact,
    coalesce(p_app_logo, ''),
    p_font_size,
    p_theme_color
  )
  on conflict (id) do update set
    status = excluded.status,
    next_billing_date = excluded.next_billing_date,
    developer_contact = excluded.developer_contact,
    app_logo = excluded.app_logo,
    font_size = excluded.font_size,
    theme_color = excluded.theme_color,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.update_app_settings(text, text, date, text, text, text, text) from public;
grant execute on function public.update_app_settings(text, text, date, text, text, text, text) to authenticated;
