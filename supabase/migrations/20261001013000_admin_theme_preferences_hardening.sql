drop index if exists public.ix_hris_ai_center_audit_created_at;
drop index if exists public.ix_hris_ai_center_audit_user_id;

create index if not exists idx_hris_ai_center_settings_updated_by
  on public.hris_ai_center_settings_v1(updated_by);

drop policy if exists hris_admin_theme_preferences_select_own on public.hris_admin_theme_preferences;
create policy hris_admin_theme_preferences_select_own on public.hris_admin_theme_preferences
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists hris_admin_theme_preferences_insert_own on public.hris_admin_theme_preferences;
create policy hris_admin_theme_preferences_insert_own on public.hris_admin_theme_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists hris_admin_theme_preferences_update_own on public.hris_admin_theme_preferences;
create policy hris_admin_theme_preferences_update_own on public.hris_admin_theme_preferences
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists hris_admin_theme_preferences_delete_own on public.hris_admin_theme_preferences;
create policy hris_admin_theme_preferences_delete_own on public.hris_admin_theme_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);
