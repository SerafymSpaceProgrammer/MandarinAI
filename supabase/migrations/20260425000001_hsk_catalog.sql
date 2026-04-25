-- ============================================================
-- MandarinAI — HSK catalog
--
-- Master list of HSK vocabulary covering both the legacy 6-level
-- syllabus and the new 9-level HSK 3.0. One row per hanzi (so a word
-- that appears in both old and new is stored once, with both level
-- columns populated). Translations live in a side table so we can
-- lazy-fill them per language without bloating the master row.
--
-- All tables are public-readable. Writes happen only via the
-- translate-meaning edge function (service-role) when populating the
-- cache; topic + word-topic seed data is loaded by migrations later.
-- ============================================================

create table if not exists public.hsk_words (
  hanzi text primary key,
  pinyin text not null,
  hsk_old int check (hsk_old between 1 and 6),
  hsk_new int check (hsk_new between 1 and 9),
  pos text[],
  frequency_rank int,
  created_at timestamptz default now()
);

create index if not exists idx_hsk_words_old on public.hsk_words (hsk_old) where hsk_old is not null;
create index if not exists idx_hsk_words_new on public.hsk_words (hsk_new) where hsk_new is not null;
create index if not exists idx_hsk_words_freq on public.hsk_words (frequency_rank);

alter table public.hsk_words enable row level security;
drop policy if exists "anyone reads hsk_words" on public.hsk_words;
create policy "anyone reads hsk_words" on public.hsk_words for select using (true);

create table if not exists public.hsk_word_translations (
  hanzi text not null references public.hsk_words(hanzi) on delete cascade,
  lang text not null check (lang in ('en','es','pt','ru','zh')),
  meanings text[] not null default '{}',
  source text default 'auto' check (source in ('auto','curated','user')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (hanzi, lang)
);

create index if not exists idx_hsk_translations_lang on public.hsk_word_translations (lang);

alter table public.hsk_word_translations enable row level security;
drop policy if exists "anyone reads hsk translations" on public.hsk_word_translations;
create policy "anyone reads hsk translations" on public.hsk_word_translations for select using (true);

create table if not exists public.hsk_topics (
  id text primary key,
  name jsonb not null default '{}',
  emoji text,
  description jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.hsk_topics enable row level security;
drop policy if exists "anyone reads topics" on public.hsk_topics;
create policy "anyone reads topics" on public.hsk_topics for select using (true);

create table if not exists public.hsk_word_topics (
  hanzi text not null references public.hsk_words(hanzi) on delete cascade,
  topic_id text not null references public.hsk_topics(id) on delete cascade,
  primary key (hanzi, topic_id)
);

create index if not exists idx_hsk_word_topics_topic on public.hsk_word_topics (topic_id);

alter table public.hsk_word_topics enable row level security;
drop policy if exists "anyone reads word topics" on public.hsk_word_topics;
create policy "anyone reads word topics" on public.hsk_word_topics for select using (true);
