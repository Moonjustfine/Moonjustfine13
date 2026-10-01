create table if not exists public.hris_admin_theme_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null check (theme in ('aurora','professional')),
  updated_at timestamptz not null default now()
);

alter table public.hris_admin_theme_preferences enable row level security;

drop policy if exists hris_admin_theme_preferences_select_own on public.hris_admin_theme_preferences;
create policy hris_admin_theme_preferences_select_own on public.hris_admin_theme_preferences
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists hris_admin_theme_preferences_insert_own on public.hris_admin_theme_preferences;
create policy hris_admin_theme_preferences_insert_own on public.hris_admin_theme_preferences
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists hris_admin_theme_preferences_update_own on public.hris_admin_theme_preferences;
create policy hris_admin_theme_preferences_update_own on public.hris_admin_theme_preferences
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists hris_admin_theme_preferences_delete_own on public.hris_admin_theme_preferences;
create policy hris_admin_theme_preferences_delete_own on public.hris_admin_theme_preferences
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.hris_admin_theme_preferences to authenticated;
