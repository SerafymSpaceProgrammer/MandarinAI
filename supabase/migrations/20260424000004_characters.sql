-- ============================================================
-- MandarinAI — Phase 5 (character trainer)
--
-- Two new tables:
--   • characters_dict — global, read-only per-character reference
--     (pinyin readings, meanings, hsk_level, stroke_count, mnemonic).
--     Populated incrementally; seed set ships with this migration.
--   • user_characters — per-user progression state, one row per
--     (user_id, hanzi). step_completed 0–5 mirrors the 5-step flow
--     (Learn → Recognize → Pronounce → Write → Produce → mastered).
-- ============================================================

create table if not exists public.characters_dict (
  hanzi text primary key,
  pinyin text[] not null,
  meanings text[] not null,
  hsk_level int,
  frequency_rank int,
  stroke_count int,
  radicals jsonb,
  mnemonic_en text,
  mnemonic_image_url text,
  stroke_order_svg text,
  created_at timestamptz default now()
);

create index if not exists idx_characters_dict_hsk
  on public.characters_dict (hsk_level, frequency_rank);

alter table public.characters_dict enable row level security;
drop policy if exists "anyone reads dict" on public.characters_dict;
create policy "anyone reads dict" on public.characters_dict for select using (true);

create table if not exists public.user_characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  hanzi text not null,
  step_completed int default 0 check (step_completed between 0 and 5),
  mnemonic_user_override text,
  due_at timestamptz default now(),
  reps int default 0,
  last_seen_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, hanzi)
);

create index if not exists idx_user_characters_due
  on public.user_characters (user_id, due_at);

alter table public.user_characters enable row level security;
drop policy if exists "own characters" on public.user_characters;
create policy "own characters" on public.user_characters for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
