-- ============================================================
-- MandarinAI — General Chinese dictionary (CC-CEDICT + extensions)
--
-- A superset of `hsk_words` that covers ~125,000 entries from CC-CEDICT.
-- Provides hanzi/pinyin/meaning search regardless of HSK membership and
-- powers the "Везде / Everything" scope of the word browser.
--
-- Tables:
--   • dictionary               — master rows, simplified-hanzi PK
--   • dictionary_translations  — per-language meaning cache (mirror of
--                                hsk_word_translations but for the broader
--                                dictionary, including non-HSK entries)
--
-- RPC:
--   • search_dictionary(q, lang, max_results)
--       Ranked search by hanzi → pinyin → meaning, with localised
--       meanings joined from dictionary_translations when present.
-- ============================================================

create extension if not exists pg_trgm;

-- ──────────────────────────────────────────────────────────────────────────
-- Master table
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.dictionary (
  hanzi text primary key,                  -- simplified
  trad text,                                -- traditional (may equal hanzi)
  pinyin text not null,                     -- "nǐ hǎo" (toned, display form)
  pinyin_norm text not null,                -- "nihao" (lowercased, no tones, no spaces)
  meanings_en text[] not null default '{}', -- ordered list of english meanings
  -- Concatenated " · "-joined meanings string used for trgm/ilike search.
  -- Maintained by trigger (`array_to_string` isn't marked IMMUTABLE in PG 15,
  -- so a GENERATED column wouldn't work — trigger-on-write is the next-best
  -- option and keeps the index consistent with `meanings_en`).
  meanings_en_text text not null default '',
  freq int default 9999,                    -- frequency rank (smaller = more common)
  hsk_level int,                            -- mirrored from hsk_words on import
  source text default 'cedict' check (source in ('cedict','manual','ai')),
  created_at timestamptz default now()
);

create or replace function public.dictionary_sync_meanings_text()
returns trigger
language plpgsql
as $$
begin
  new.meanings_en_text := array_to_string(coalesce(new.meanings_en, '{}'::text[]), ' · ');
  return new;
end;
$$;

drop trigger if exists trg_dictionary_sync_meanings_text on public.dictionary;
create trigger trg_dictionary_sync_meanings_text
  before insert or update of meanings_en on public.dictionary
  for each row execute function public.dictionary_sync_meanings_text();

-- Prefix index on hanzi — supports `LIKE 'q%'` and exact match.
create index if not exists idx_dictionary_hanzi_prefix
  on public.dictionary (hanzi text_pattern_ops);

-- Same on pinyin_norm.
create index if not exists idx_dictionary_pinyin_norm
  on public.dictionary (pinyin_norm text_pattern_ops);

-- Trigram index on the meanings text for substring-ILIKE search.
create index if not exists idx_dictionary_meanings_trgm
  on public.dictionary using gin (meanings_en_text gin_trgm_ops);

-- Frequency-first ordering for "no query" lists.
create index if not exists idx_dictionary_freq
  on public.dictionary (freq);

alter table public.dictionary enable row level security;
drop policy if exists "anyone reads dictionary" on public.dictionary;
create policy "anyone reads dictionary"
  on public.dictionary for select using (true);

-- ──────────────────────────────────────────────────────────────────────────
-- Per-language meaning cache — same shape as hsk_word_translations but
-- can hold entries for any hanzi that exists in `dictionary`, including
-- ones not in HSK.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.dictionary_translations (
  hanzi text not null references public.dictionary(hanzi) on delete cascade,
  lang text not null check (lang in ('en','es','pt','ru','zh','uk','de','pl')),
  meanings text[] not null default '{}',
  source text default 'auto' check (source in ('auto','curated','user','ai')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (hanzi, lang)
);

create index if not exists idx_dict_translations_lang
  on public.dictionary_translations (lang);

alter table public.dictionary_translations enable row level security;
drop policy if exists "anyone reads dict_translations" on public.dictionary_translations;
create policy "anyone reads dict_translations"
  on public.dictionary_translations for select using (true);

-- ──────────────────────────────────────────────────────────────────────────
-- search_dictionary RPC — single round-trip cross-language search.
--
-- Inputs:
--   q             — the raw user query (any of: hanzi, pinyin, English/native word)
--   q_norm        — pre-normalized pinyin form of `q` (caller computes it)
--   lang          — user's native language code; used to pick localised meanings
--   max_results   — cap (default 30)
--
-- Output columns:
--   hanzi, pinyin, meanings (in `lang` if cached, else English),
--   meanings_en (always English, useful for ChatGPT fallback display),
--   hsk_level, freq, score, source_lang
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.search_dictionary(
  q text,
  q_norm text,
  lang text default 'en',
  max_results int default 30
)
returns table(
  hanzi text,
  pinyin text,
  meanings text[],
  meanings_en text[],
  hsk_level int,
  freq int,
  score int,
  source_lang text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q_trim text := nullif(trim(q), '');
  q_norm_trim text := nullif(trim(q_norm), '');
  -- Re-alias the `lang` parameter so it doesn't collide with the
  -- `dictionary_translations.lang` column in the join predicate (PG would
  -- otherwise raise "column reference 'lang' is ambiguous").
  target_lang text := lang;
begin
  if q_trim is null then
    return query
      select
        d.hanzi,
        d.pinyin,
        coalesce(t.meanings, d.meanings_en) as meanings,
        d.meanings_en,
        d.hsk_level,
        d.freq,
        0 as score,
        case when t.meanings is not null then target_lang else 'en' end as source_lang
      from public.dictionary d
      left join public.dictionary_translations t
        on t.hanzi = d.hanzi and t.lang = target_lang
      order by d.freq nulls last
      limit max_results;
    return;
  end if;

  return query
    with scored as (
      select
        d.hanzi,
        d.pinyin,
        d.meanings_en,
        d.meanings_en_text,
        d.hsk_level,
        d.freq,
        case
          when d.hanzi = q_trim then 1000
          when d.pinyin_norm = q_norm_trim then 800
          when d.hanzi like q_trim || '%' then 600
          when d.pinyin_norm like q_norm_trim || '%' then 500
          when d.hanzi like '%' || q_trim || '%' then 400
          when d.pinyin_norm like '%' || q_norm_trim || '%' then 300
          when d.meanings_en_text ilike '%' || q_trim || '%' then 200
          else -1
        end as s
      from public.dictionary d
      where
        d.hanzi like '%' || q_trim || '%'
        or d.pinyin_norm like '%' || q_norm_trim || '%'
        or (length(q_trim) >= 2 and d.meanings_en_text ilike '%' || q_trim || '%')
    )
    select
      s.hanzi,
      s.pinyin,
      coalesce(t.meanings, s.meanings_en) as meanings,
      s.meanings_en,
      s.hsk_level,
      s.freq,
      s.s as score,
      case when t.meanings is not null then target_lang else 'en' end as source_lang
    from scored s
    left join public.dictionary_translations t
      on t.hanzi = s.hanzi and t.lang = target_lang
    where s.s > 0
    order by s.s desc, s.freq nulls last, length(s.hanzi)
    limit max_results;
end;
$$;

grant execute on function public.search_dictionary(text, text, text, int) to anon, authenticated;
