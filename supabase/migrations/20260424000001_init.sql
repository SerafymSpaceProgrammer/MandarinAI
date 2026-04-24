-- ============================================================
-- MandarinAI — Phase 1 (auth) migration
--
-- Shares the Supabase project with the ChineseLens extension.
-- The extension already provisioned:
--   • public.profiles (id, hsk_level, native_language, created_at,
--     tier, ls_customer_id, ls_subscription_id, ls_variant_id,
--     current_period_end, status, updated_at)
--   • trigger on_auth_user_created → public.handle_new_user() which
--     inserts a bare row into public.profiles for every new auth.users
--   • RLS policy "own profile" FOR ALL USING (auth.uid() = id)
--
-- This migration adds the mobile-only columns onto the same row so a
-- user signed up via the extension or the mobile app sees one profile
-- everywhere. Idempotent — safe to re-run.
-- ============================================================

alter table public.profiles add column if not exists display_name         text;
alter table public.profiles add column if not exists avatar_url           text;
alter table public.profiles add column if not exists daily_goal_minutes   int     default 15;
alter table public.profiles add column if not exists learning_goal        text;
alter table public.profiles add column if not exists notification_time    time;
alter table public.profiles add column if not exists notification_enabled boolean default true;
alter table public.profiles add column if not exists timezone             text    default 'UTC';
alter table public.profiles add column if not exists onboarding_completed boolean default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_native_language_check'
  ) then
    alter table public.profiles
      add constraint profiles_native_language_check
      check (native_language in ('en','es','pt','ru','zh'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_learning_goal_check'
  ) then
    alter table public.profiles
      add constraint profiles_learning_goal_check
      check (learning_goal is null or learning_goal in ('travel','work','hsk_exam','immigration','fun'));
  end if;
end$$;

-- Safety net: ensure every auth.users has a profile row (the extension's
-- on_auth_user_created trigger already does this for new signups; this
-- catches any legacy users created before the trigger existed).
insert into public.profiles (id)
select u.id
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
