-- Project by Tirta | Release hardening | 2026-10-01
-- Idempotent repair for employee deactivation, QR verification, ESS attendance, and private photos.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Employee lifecycle: structured deactivation reason.
-- -----------------------------------------------------------------------------
alter table public.karyawan
  add column if not exists alasan_keluar_kode text;

alter table public.hris_employee_history
  add column if not exists efektif_mulai date default current_date;

alter table public.hris_employee_history
  add column if not exists alasan text;

create index if not exists idx_karyawan_status_aktif
  on public.karyawan(status_aktif);

-- Keep the lifecycle history trigger compatible with both legacy and current schemas.
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
        case when coalesce(new.status_aktif,true)=false then new.tanggal_keluar else old.tanggal_keluar end,
        case when coalesce(new.status_aktif,true)=false then new.alasan_keluar else old.alasan_keluar end,
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

-- -----------------------------------------------------------------------------
-- Private profile photos: final state is private-read.
-- Supervisors/HRD with people.read may view employee photos through signed URLs.
-- Registration uploads stay limited to the short-lived registration/ namespace.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  2097152,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_photos_anon_insert" on storage.objects;
drop policy if exists "profile_photos_registration_anon_insert" on storage.objects;
drop policy if exists "profile_photos_authenticated_insert" on storage.objects;
drop policy if exists "profile_photos_authenticated_select" on storage.objects;
drop policy if exists "profile_photos_authenticated_update" on storage.objects;
drop policy if exists "profile_photos_authenticated_delete" on storage.objects;
drop policy if exists "profile_photos_registration_anon_delete" on storage.objects;

-- Registration must use an opaque UUID filename.
create policy "profile_photos_registration_anon_insert"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = 'registration'
  and (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\.(jpe?g|png|webp)$'
);

create policy "profile_photos_registration_anon_delete"
on storage.objects
for delete
to anon, authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = 'registration'
);

create policy "profile_photos_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and (
    (
      public.hris_has_permission('people.write')
      and (
        ((storage.foldername(name))[1] = 'avatars'
          and (storage.foldername(name))[2] ~ '^employee-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\.(jpe?g|png|webp)$')
        or (storage.foldername(name))[1] = auth.uid()::text
      )
    )
    or ((storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text)
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

create policy "profile_photos_authenticated_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    public.hris_has_permission('people.read')
    or (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[2] = auth.uid()::text
  )
);

create policy "profile_photos_authenticated_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    (
      public.hris_has_permission('people.write')
      and (
        ((storage.foldername(name))[1] = 'avatars'
          and (storage.foldername(name))[2] ~ '^employee-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\.(jpe?g|png|webp)$')
        or (storage.foldername(name))[1] = auth.uid()::text
      )
    )
    or (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[2] = auth.uid()::text
  )
)
with check (
  bucket_id = 'profile-photos'
  and (
    (
      public.hris_has_permission('people.write')
      and (
        ((storage.foldername(name))[1] = 'avatars'
          and (storage.foldername(name))[2] ~ '^employee-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\.(jpe?g|png|webp)$')
        or (storage.foldername(name))[1] = auth.uid()::text
      )
    )
    or (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[2] = auth.uid()::text
  )
);

create policy "profile_photos_authenticated_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    (
      public.hris_has_permission('people.write')
      and (
        ((storage.foldername(name))[1] = 'avatars'
          and (storage.foldername(name))[2] ~ '^employee-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\.(jpe?g|png|webp)$')
        or (storage.foldername(name))[1] = auth.uid()::text
      )
    )
    or (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[2] = auth.uid()::text
  )
);

-- -----------------------------------------------------------------------------
-- Secure ID Card QR verification. Public verification includes the employee's recorded exit reason when inactive.
-- -----------------------------------------------------------------------------
create table if not exists public.hris_id_card_tokens (
  id uuid primary key default gen_random_uuid(),
  id_karyawan text not null unique
    references public.karyawan(id_karyawan)
    on update cascade
    on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz null
);

create index if not exists ix_hris_id_card_tokens_employee
  on public.hris_id_card_tokens(id_karyawan);
create index if not exists ix_hris_id_card_tokens_revoked
  on public.hris_id_card_tokens(revoked_at);

alter table public.hris_id_card_tokens enable row level security;

drop policy if exists hris_id_card_tokens_admin_select on public.hris_id_card_tokens;
create policy hris_id_card_tokens_admin_select
on public.hris_id_card_tokens
for select
to authenticated
using (public.hris_has_permission('people.read'));

create or replace function public.ensure_id_card_verification_token(
  p_id_karyawan text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := trim(coalesce(p_id_karyawan, ''));
  v_token text;
begin
  if auth.uid() is null or not public.hris_has_permission('people.read') then
    raise exception 'not authorized' using errcode='42501';
  end if;

  if v_id = '' then
    raise exception 'employee id is required';
  end if;

  if not exists (select 1 from public.karyawan where id_karyawan = v_id) then
    raise exception 'employee not found';
  end if;

  select token into v_token
  from public.hris_id_card_tokens
  where id_karyawan = v_id
    and revoked_at is null
  limit 1;

  if v_token is not null then
    return v_token;
  end if;

  insert into public.hris_id_card_tokens (id_karyawan, token, updated_at, revoked_at)
  values (v_id, encode(gen_random_bytes(24), 'hex'), now(), null)
  on conflict (id_karyawan)
  do update set updated_at = now(), revoked_at = null
  returning token into v_token;

  return v_token;
end;
$$;

revoke all on function public.ensure_id_card_verification_token(text) from public;
grant execute on function public.ensure_id_card_verification_token(text) to authenticated;

create or replace function public.verify_employee_id_card(
  p_token text
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'found', true,
    'id_karyawan', k.id_karyawan,
    'nama', k.nama,
    'jabatan', coalesce(k.jabatan, ''),
    'departemen', coalesce(k.departemen, ''),
    'status_aktif', coalesce(k.status_aktif, false),
    'status_karyawan',
      coalesce(
        nullif(k.status_karyawan, ''),
        case when coalesce(k.status_aktif, false) then 'Aktif' else 'Nonaktif' end
      ),
    'deactivation_reason_code',
      case when coalesce(k.status_aktif, false) then null else k.alasan_keluar_kode end,
    'deactivation_reason',
      case when coalesce(k.status_aktif, false) then null else nullif(trim(coalesce(k.alasan_keluar, '')), '') end,
    'deactivation_effective_date',
      case when coalesce(k.status_aktif, false) then null else k.tanggal_keluar::text end,
    'company_name',
      coalesce(
        (select cs.company_name
           from public.hris_company_settings cs
          where cs.id = 1
          limit 1),
        'Project by Tirta'
      )
  )
  from public.hris_id_card_tokens t
  join public.karyawan k on k.id_karyawan = t.id_karyawan
  where t.token = trim(coalesce(p_token, ''))
    and t.revoked_at is null
  limit 1;
$$;

revoke all on function public.verify_employee_id_card(text) from public;
grant execute on function public.verify_employee_id_card(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- ESS attendance must use the public helper that exists in the repo.
-- Server time remains authoritative in Asia/Jakarta.
-- -----------------------------------------------------------------------------
create or replace function public.hris_ess_clock_in(
  p_id_karyawan text, p_tanggal date, p_jam time without time zone,
  p_lat numeric, p_long numeric, p_accuracy numeric, p_selfie text,
  p_lokasi text default 'GPS'::text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_now timestamp without time zone;
  v_tanggal date;
  v_jam time without time zone;
begin
  if auth.uid() is null
     or p_id_karyawan is null
     or p_id_karyawan <> public.hris_ess_employee_id() then
    raise exception 'Akses absensi ditolak' using errcode='42501';
  end if;

  v_now := clock_timestamp() at time zone 'Asia/Jakarta';
  v_tanggal := v_now::date;
  v_jam := v_now::time(0);

  if p_tanggal is distinct from v_tanggal then
    raise exception 'Tanggal absensi harus tanggal Jakarta hari ini';
  end if;

  if not exists (
    select 1 from public.karyawan
    where id_karyawan = p_id_karyawan and status_aktif = true
  ) then
    raise exception 'Akun karyawan tidak aktif' using errcode='42501';
  end if;

  if exists (
    select 1 from public.absensi
    where id_karyawan = p_id_karyawan
      and tanggal = v_tanggal
      and jam_masuk is not null
  ) then
    raise exception 'Anda sudah melakukan clock-in untuk tanggal ini';
  end if;

  insert into public.absensi(
    id_karyawan,tanggal,jam_masuk,status,latitude,longitude,
    lokasi_masuk,akurasi_masuk,selfie_masuk,sumber,keterangan
  ) values (
    p_id_karyawan,v_tanggal,v_jam,'Hadir',p_lat,p_long,
    p_lokasi,p_accuracy,p_selfie,'ESS','Clock-in ESS'
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.hris_ess_clock_out(
  p_id_karyawan text, p_tanggal date, p_jam time without time zone,
  p_lat numeric, p_long numeric, p_accuracy numeric, p_selfie text,
  p_lokasi text default 'GPS'::text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_now timestamp without time zone;
  v_tanggal date;
  v_jam time without time zone;
begin
  if auth.uid() is null
     or p_id_karyawan is null
     or p_id_karyawan <> public.hris_ess_employee_id() then
    raise exception 'Akses absensi ditolak' using errcode='42501';
  end if;

  v_now := clock_timestamp() at time zone 'Asia/Jakarta';
  v_tanggal := v_now::date;
  v_jam := v_now::time(0);

  if p_tanggal is distinct from v_tanggal then
    raise exception 'Tanggal absensi harus tanggal Jakarta hari ini';
  end if;

  if not exists (
    select 1 from public.karyawan
    where id_karyawan = p_id_karyawan and status_aktif = true
  ) then
    raise exception 'Akun karyawan tidak aktif' using errcode='42501';
  end if;

  select id into v_id
  from public.absensi
  where id_karyawan = p_id_karyawan
    and tanggal = v_tanggal
    and jam_masuk is not null
    and jam_pulang is null
  order by created_at desc
  limit 1;

  if v_id is null then
    raise exception 'Clock-in aktif tidak ditemukan untuk tanggal ini';
  end if;

  update public.absensi
  set jam_pulang=v_jam,
      latitude=coalesce(p_lat,latitude),
      longitude=coalesce(p_long,longitude),
      lokasi_pulang=p_lokasi,
      akurasi_pulang=p_accuracy,
      selfie_pulang=p_selfie,
      sumber='ESS',
      updated_at=now()
  where id=v_id;

  return v_id;
end;
$$;

revoke all on function public.hris_ess_clock_in(text,date,time,numeric,numeric,numeric,text,text) from public;
revoke all on function public.hris_ess_clock_out(text,date,time,numeric,numeric,numeric,text,text) from public;
grant execute on function public.hris_ess_clock_in(text,date,time,numeric,numeric,numeric,text,text) to authenticated;
grant execute on function public.hris_ess_clock_out(text,date,time,numeric,numeric,numeric,text,text) to authenticated;

notify pgrst, 'reload schema';
