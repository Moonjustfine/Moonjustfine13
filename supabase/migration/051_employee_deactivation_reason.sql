-- Employee deactivation reason + lifecycle history enhancement
-- Project by Tirta | 2026-09-30
-- Safe/idempotent migration for existing deployments.

create extension if not exists pgcrypto;

alter table public.karyawan
  add column if not exists alasan_keluar_kode text;

alter table public.hris_employee_history
  add column if not exists efektif_mulai date default current_date;

alter table public.hris_employee_history
  add column if not exists alasan text;

create index if not exists idx_karyawan_status_aktif
  on public.karyawan(status_aktif);

create or replace function public.hris_employee_change_history()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='UPDATE' then
    if coalesce(old.jabatan,'')<>coalesce(new.jabatan,'') then
      insert into public.hris_employee_history(
        id_karyawan,jenis,dari_nilai,ke_nilai,actor_email
      ) values (
        new.id_karyawan,'Jabatan',old.jabatan,new.jabatan,auth.jwt()->>'email'
      );
    end if;

    if coalesce(old.departemen,'')<>coalesce(new.departemen,'') then
      insert into public.hris_employee_history(
        id_karyawan,jenis,dari_nilai,ke_nilai,actor_email
      ) values (
        new.id_karyawan,'Departemen',old.departemen,new.departemen,auth.jwt()->>'email'
      );
    end if;

    if coalesce(old.status_aktif,true)<>coalesce(new.status_aktif,true) then
      insert into public.hris_employee_history(
        id_karyawan,jenis,dari_nilai,ke_nilai,efektif_mulai,alasan,actor_email
      ) values (
        new.id_karyawan,
        'Status',
        old.status_aktif::text,
        new.status_aktif::text,
        case
          when coalesce(new.status_aktif,true)=false then new.tanggal_keluar
          else old.tanggal_keluar
        end,
        case
          when coalesce(new.status_aktif,true)=false then new.alasan_keluar
          else old.alasan_keluar
        end,
        auth.jwt()->>'email'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_employee_change_history on public.karyawan;
create trigger trg_employee_change_history
after update on public.karyawan
for each row execute function public.hris_employee_change_history();

notify pgrst, 'reload schema';
