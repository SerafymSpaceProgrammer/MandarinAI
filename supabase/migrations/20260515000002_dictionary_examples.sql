-- Cached AI-generated example sentences for any Mandarin word — both HSK
-- catalog entries and CC-CEDICT dictionary entries. The exercise generator
-- reads from here for word-order and fill-blank exercises, which need a
-- `context_sentence` to tokenize. Saved words bring their own context;
-- HSK/dictionary words do not, so we lazy-generate one per hanzi via OpenAI
-- and cache the result here forever (the example never goes stale).

create table if not exists public.dictionary_examples (
  hanzi text primary key,
  sentence text not null,
  source text not null default 'ai' check (source in ('ai','curated','user')),
  created_at timestamptz default now()
);

alter table public.dictionary_examples enable row level security;

drop policy if exists "anyone reads dict_examples" on public.dictionary_examples;
create policy "anyone reads dict_examples"
  on public.dictionary_examples for select using (true);
