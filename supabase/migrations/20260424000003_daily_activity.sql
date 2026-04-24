-- ============================================================
-- MandarinAI — Phase 3 (home + daily plan)
--
-- daily_activity is the source of truth for the streak and for home-screen
-- stats. One row per (user, local date). Updated whenever the user completes
-- something that should count as "engagement today" (review, lesson, etc.)
-- ============================================================

create table if not exists public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  minutes_studied int default 0,
  words_reviewed int default 0,
  words_learned int default 0,
  characters_learned int default 0,
  conversations_completed int default 0,
  exercises_completed int default 0,
  xp_earned int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date)
);

create index if not exists idx_daily_activity_user_date
  on public.daily_activity (user_id, date desc);

alter table public.daily_activity enable row level security;

drop policy if exists "own daily activity" on public.daily_activity;
create policy "own daily activity" on public.daily_activity
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
