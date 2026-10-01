-- Theme scope correction:
-- Aurora Glass is a global theme shared by HR/Admin and Employee Portal.
-- Professional HRIS is admin-only and never changes the Employee Portal theme.

alter table public.hris_user_preferences
  drop constraint if exists hris_user_preferences_theme_check;

alter table public.hris_user_preferences
  add constraint hris_user_preferences_theme_check
  check (theme in ('sun','moon','galaxy','blackhole','nebula','aurora'));

alter table public.hris_company_settings
  drop constraint if exists hris_company_settings_employee_portal_theme_check;

alter table public.hris_company_settings
  add constraint hris_company_settings_employee_portal_theme_check
  check (employee_portal_theme in ('sun','moon','galaxy','blackhole','nebula','aurora'));

alter table public.hris_admin_theme_preferences
  drop constraint if exists hris_admin_theme_preferences_theme_check;

delete from public.hris_admin_theme_preferences where theme = 'aurora';

alter table public.hris_admin_theme_preferences
  add constraint hris_admin_theme_preferences_theme_check
  check (theme = 'professional');

create or replace function public.hris_get_employee_portal_theme()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_theme text;
begin
  select employee_portal_theme into v_theme
  from public.hris_company_settings
  where id=1;
  return case
    when v_theme in ('sun','moon','galaxy','blackhole','nebula','aurora') then v_theme
    else 'sun'
  end;
end;
$$;

create or replace function public.hris_get_public_app_theme()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_theme text;
begin
  select employee_portal_theme into v_theme
  from public.hris_company_settings
  where id=1;
  return case
    when v_theme in ('sun','moon','galaxy','blackhole','nebula','aurora') then v_theme
    else 'sun'
  end;
end;
$$;

create or replace function public.hris_set_employee_portal_theme(p_theme text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_email text;
begin
  if p_theme not in ('sun','moon','galaxy','blackhole','nebula','aurora') then
    raise exception 'Tema Portal Karyawan tidak valid';
  end if;
  v_email=lower(coalesce(auth.jwt()->>'email',''));
  if not exists (
    select 1 from public.hris_users
    where lower(email)=v_email and status='Aktif' and role='Super Admin'
  ) then
    raise exception 'Hanya Super Admin yang dapat mengubah tema Portal Karyawan';
  end if;
  update public.hris_company_settings
     set employee_portal_theme=p_theme, updated_at=now()
   where id=1;
  if not found then raise exception 'Pengaturan perusahaan dengan id=1 tidak ditemukan'; end if;
end;
$$;

revoke all on function public.hris_set_employee_portal_theme(text) from public;
grant execute on function public.hris_set_employee_portal_theme(text) to authenticated;
