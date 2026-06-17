# Dictionary feature — deployment steps

The "Везде / Everything" scope in the **Words** screen is backed by a
full Chinese-English dictionary (CC-CEDICT, ~125k entries) plus an OpenAI
fallback for names / slang / neologisms missing from the dictionary.

Three things need to be deployed in order before the feature is live:

## 1. Apply the database migration

```bash
cd MandarinAI
npx supabase db push
```

This creates:

- `public.dictionary` — master table (hanzi PK, pinyin, meanings_en[], freq, hsk_level, …)
- `public.dictionary_translations` — per-language meaning cache (en/es/pt/ru/zh/uk/de/pl)
- `public.search_dictionary(q, q_norm, lang, max_results)` — ranked search RPC

Indexes used:

- `idx_dictionary_hanzi_prefix` — prefix LIKE on hanzi
- `idx_dictionary_pinyin_norm` — prefix LIKE on normalised pinyin
- `idx_dictionary_meanings_trgm` — GIN trgm for substring search on meanings
- `idx_dictionary_freq` — sort key for unfiltered listings

## 2. Import CC-CEDICT into the `dictionary` table

CC-CEDICT.u8 is already in the sister repo
(`../ChineseLens/scripts/data/cedict.txt`). One-shot import:

```bash
# Dry-run — parses, dedupes, prints stats. Doesn't touch Supabase.
node scripts/import-cedict-to-supabase.mjs

# Real upload — needs EXPO_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
# in .env. Uploads in batches of 500 rows; ~5–10 min total for ~115k rows.
node scripts/import-cedict-to-supabase.mjs --upload
```

If a batch fails (transient network, rate limit), the script prints
`--resume <hanzi>` — pass that flag to skip ahead to the failing batch:

```bash
node scripts/import-cedict-to-supabase.mjs --upload --resume 网红
```

Upsert is idempotent, so re-running the whole script overwrites cleanly.

## 3. Deploy the two new edge functions

```bash
supabase functions deploy dict-search --no-verify-jwt
supabase functions deploy dict-ai-fallback --no-verify-jwt
```

Both verify the caller JWT manually against `/auth/v1/user` (ES256 gateway
gotcha — see [memory: supabase_es256.md](../../../.claude/memory/feedback_supabase_es256.md)).

### Environment variables

`dict-search` reads `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` — all already set on the project's edge runtime.

`dict-ai-fallback` additionally needs `OPENAI_API_KEY`. If it's not already
set:

```bash
supabase secrets set OPENAI_API_KEY=sk-…
```

## 4. Smoke-test in the app

1. Reload the running expo/dev build.
2. Open **Учить → Слова** → switch the top chip to **Везде**.
3. Type test queries:
   - `你好` — should return 你好 + nearby hanzi
   - `ni hao` — same result via pinyin (no tone marks needed)
   - `привет` (or your native lang) — should show a `Ищем как "hello"` banner
     and return 你好 / 嗨 / etc.
   - `绝绝子` (slang not in CEDICT) — should fall back to AI and show a single
     row with an `AI` badge

## Architecture sketch

```
                            ┌─ Везде scope ─────────────────────────┐
client (browse.tsx)         │                                       │
   │                        ▼                                       │
   ├── searchDictionary() ──► supabase/functions/dict-search        │
   │       (debounce 280ms)        │                                │
   │                               ├── RPC search_dictionary        │
   │                               │      → dictionary  (rank)      │
   │                               │      → dictionary_translations │
   │                               │                                │
   │                               └── if non-CJK + few hits:       │
   │                                     Google Translate auto→en   │
   │                                     retry RPC                  │
   │                                                                │
   ├── aiFallbackLookup() ─► supabase/functions/dict-ai-fallback    │
   │       (only on 0 hits)        │                                │
   │                               └── OpenAI gpt-4o-mini           │
   │                                     returns DictEntry          │
   │                                                                │
   └── result rows render ─► WordDetailSheet (multi-meaning list)   │
                            │                                       │
                            └── tap heart → addWord() → saved_words │
                                                                    │
                            ─ Сохранённые scope: local filter ──────┤
                            ─ HSK scope: cached fetchAllCatalog ────┤
                            ─ По теме scope: same + topic filter ───┘
```

Lazy-translation flow: when `dict-search` returns rows whose `source_lang`
is still `"en"` (cache miss in the user's language), the edge function
fires off a background `googleTranslate()` + upsert into
`dictionary_translations` per row. The *next* user searching the same word
gets pre-localised meanings instantly. No upfront translation cost.

## Costs

- **CEDICT import**: free (one-time CPU + supabase bandwidth).
- **Per dict search**: free (Postgres RPC + optional Google Translate fallback).
- **Per AI fallback call**: ~$0.0002 with gpt-4o-mini (only fires when CEDICT
  returns zero — should be rare).
- **Lazy translations**: free Google endpoint, no per-call cost.

## Known limitations

- Frequency ranking is approximated by hanzi length + HSK level (lower length
  + HSK level = higher rank). For a real Subtlex-CH frequency dump, replace
  the `freq` column population in `scripts/import-cedict-to-supabase.mjs`.
- CEDICT doesn't ship example sentences. The detail sheet only shows the
  meaning list. Example sentences would require a separate corpus (e.g.
  Tatoeba).
- AI fallback runs sequentially — no streaming, no batching. With more usage
  we can move it to a background queue.
- The dictionary is **online-only**. If you need offline, bundle the parsed
  JSON in the app shell at build time (~10 MB compressed).
