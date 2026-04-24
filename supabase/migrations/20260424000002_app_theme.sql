-- ============================================================
-- MandarinAI — add app_theme preference to profiles
-- ============================================================

alter table public.profiles
  add column if not exists app_theme text default 'system';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_app_theme_check'
  ) then
    alter table public.profiles
      add constraint profiles_app_theme_check
      check (app_theme in ('system','light','dark','sakura','bamboo','midnight','parchment'));
  end if;
end$$;
