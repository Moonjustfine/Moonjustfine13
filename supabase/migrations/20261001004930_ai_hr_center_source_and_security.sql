-- Project by Tirta | AI HR Center source-of-truth + security hardening | 2026-10-01
-- This migration mirrors the AI center objects already present in production,
-- adds missing permission definitions/mappings, and removes a legacy policy
-- dependency on the canonical public permission helper.

create extension if not exists pgcrypto;

create table if not exists public.hris_ai_center_settings_v1 (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default true,
  provider text not null default 'openai',
  model text not null default 'gpt-5.6',
  temperature numeric(3,2) not null default 0.20 check (temperature >= 0 and temperature <= 2),
  max_output_tokens integer not null default 1800 check (max_output_tokens between 256 and 16000),
  allowed_modules jsonb not null default '["assistant","analytics","insights","reports","feedback","recruitment","attendance","turnover","payroll","people"]'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into public.hris_ai_center_settings_v1 (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.hris_ai_center_audit_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  role_name text,
  action text not null,
  module text,
  status text not null default 'success',
  model text,
  question_chars integer not null default 0 check (question_chars >= 0),
  response_chars integer not null default 0 check (response_chars >= 0),
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists ix_hris_ai_center_audit_created_at
  on public.hris_ai_center_audit_v1(created_at desc);
create index if not exists ix_hris_ai_center_audit_user_id
  on public.hris_ai_center_audit_v1(user_id, created_at desc);

alter table public.hris_ai_center_settings_v1 enable row level security;
alter table public.hris_ai_center_audit_v1 enable row level security;

drop policy if exists ai_center_settings_select on public.hris_ai_center_settings_v1;
create policy ai_center_settings_select
on public.hris_ai_center_settings_v1
for select to authenticated
using (public.hris_has_permission('ai_hr_settings'));

drop policy if exists ai_center_settings_update on public.hris_ai_center_settings_v1;
create policy ai_center_settings_update
on public.hris_ai_center_settings_v1
for update to authenticated
using (public.hris_has_permission('ai_hr_settings'))
with check (public.hris_has_permission('ai_hr_settings'));

drop policy if exists ai_center_audit_select on public.hris_ai_center_audit_v1;
create policy ai_center_audit_select
on public.hris_ai_center_audit_v1
for select to authenticated
using (public.hris_has_permission('ai_hr_audit'));

insert into public.hris_permissions (kode,nama,modul)
values
  ('ai_hr_center','AI HR Center','ai'),
  ('ai_hr_analytics','AI HR Analytics','ai'),
  ('ai_hr_reports','AI HR Reports','ai'),
  ('ai_hr_feedback','AI HR Feedback','ai'),
  ('ai_hr_recruitment','AI HR Recruitment','ai'),
  ('ai_hr_payroll','AI HR Payroll','ai'),
  ('ai_hr_people','AI HR People','ai'),
  ('ai_hr_audit','AI HR Audit','ai'),
  ('ai_hr_settings','AI HR Settings','ai')
on conflict (kode) do nothing;

-- Conservative role mapping: broad HR access, scoped Payroll/People/Analytics access.
insert into public.hris_role_permissions (role_name, permission_code)
values
  ('Super Admin','ai_hr_center'),('Super Admin','ai_hr_analytics'),('Super Admin','ai_hr_reports'),
  ('Super Admin','ai_hr_feedback'),('Super Admin','ai_hr_recruitment'),('Super Admin','ai_hr_payroll'),
  ('Super Admin','ai_hr_people'),('Super Admin','ai_hr_audit'),('Super Admin','ai_hr_settings'),
  ('Admin','ai_hr_center'),('Admin','ai_hr_analytics'),('Admin','ai_hr_reports'),
  ('Admin','ai_hr_feedback'),('Admin','ai_hr_recruitment'),('Admin','ai_hr_payroll'),
  ('Admin','ai_hr_people'),('Admin','ai_hr_audit'),
  ('HRD','ai_hr_center'),('HRD','ai_hr_analytics'),('HRD','ai_hr_reports'),
  ('HRD','ai_hr_feedback'),('HRD','ai_hr_recruitment'),('HRD','ai_hr_payroll'),('HRD','ai_hr_people'),
  ('HR Manager','ai_hr_center'),('HR Manager','ai_hr_analytics'),('HR Manager','ai_hr_reports'),
  ('HR Manager','ai_hr_feedback'),('HR Manager','ai_hr_recruitment'),('HR Manager','ai_hr_payroll'),
  ('HR Manager','ai_hr_people'),('HR Manager','ai_hr_audit'),
  ('Payroll','ai_hr_center'),('Payroll','ai_hr_analytics'),('Payroll','ai_hr_reports'),('Payroll','ai_hr_payroll'),
  ('Supervisor','ai_hr_center'),('Supervisor','ai_hr_analytics'),('Supervisor','ai_hr_people')
on conflict do nothing;

-- Replace legacy private-helper policies with the canonical public permission function.
drop policy if exists p_select_hris_ai_jobs_v35 on public.hris_ai_jobs_v35;
drop policy if exists p_insert_hris_ai_jobs_v35 on public.hris_ai_jobs_v35;
drop policy if exists p_update_hris_ai_jobs_v35 on public.hris_ai_jobs_v35;
drop policy if exists p_delete_hris_ai_jobs_v35 on public.hris_ai_jobs_v35;
drop policy if exists enterprise_select on public.hris_ai_jobs_v35;
drop policy if exists enterprise_insert on public.hris_ai_jobs_v35;
drop policy if exists enterprise_update on public.hris_ai_jobs_v35;
drop policy if exists enterprise_delete on public.hris_ai_jobs_v35;

create policy p_select_hris_ai_jobs_v35
on public.hris_ai_jobs_v35 for select to authenticated
using (public.hris_has_permission('ai_hr_center') or public.hris_has_permission('ai.automation'));

create policy p_insert_hris_ai_jobs_v35
on public.hris_ai_jobs_v35 for insert to authenticated
with check (public.hris_has_permission('ai_hr_center') or public.hris_has_permission('ai.automation'));

create policy p_update_hris_ai_jobs_v35
on public.hris_ai_jobs_v35 for update to authenticated
using (public.hris_has_permission('ai_hr_center') or public.hris_has_permission('ai.automation'))
with check (public.hris_has_permission('ai_hr_center') or public.hris_has_permission('ai.automation'));

create policy p_delete_hris_ai_jobs_v35
on public.hris_ai_jobs_v35 for delete to authenticated
using (public.hris_has_permission('ai_hr_center') or public.hris_has_permission('ai.automation'));

notify pgrst, 'reload schema';
